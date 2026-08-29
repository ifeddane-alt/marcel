"""Moteur de calcul des indicateurs branchés sur les données MARCEL."""
from datetime import date, datetime, timedelta, timezone

from core.database import db
from core.auth import TokenPayload

_DONE_MS = ("achieved",)
_OPEN_RISK = ("identifié", "en cours", "open", "actif")


def _eur(v) -> str:
    v = v or 0
    if abs(v) >= 1_000_000:
        return f"{v / 1_000_000:.1f} M€".replace(".", ",")
    if abs(v) >= 1_000:
        return f"{v / 1_000:.0f} k€"
    return f"{v:.0f} €"


def _pct(num, den):
    return round(num / den * 100) if den else None


def _today() -> str:
    return date.today().isoformat()


async def load_context(scope: str, context_id: str | None, user: TokenPayload) -> dict:
    t = user.tenant_id
    ctx = {"tenant_id": t}
    if scope == "project":
        p = await db.projects.find_one({"project_id": context_id, "tenant_id": t}, {"_id": 0})
        ctx["projects"] = [p] if p else []
        pids = [context_id]
    elif scope == "program":
        ctx["projects"] = await db.projects.find(
            {"program_id": context_id, "tenant_id": t}, {"_id": 0}).to_list(None)
        pids = [p["project_id"] for p in ctx["projects"]]
    else:
        ctx["projects"] = await db.projects.find({"tenant_id": t}, {"_id": 0}).to_list(None)
        pids = [p["project_id"] for p in ctx["projects"]]
    ctx["milestones"] = await db.milestones.find(
        {"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)
    ctx["risks"] = await db.risks.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)
    if scope == "project":
        ctx["sprints"] = await db.project_sprints.find(
            {"project_id": context_id}, {"_id": 0}).to_list(None)
    if scope in ("program",):
        ctx["dependencies"] = await db.project_dependencies.find(
            {"tenant_id": t, "$or": [{"source_project_id": {"$in": pids}},
                                     {"target_project_id": {"$in": pids}}]}, {"_id": 0}).to_list(None)
    if scope in ("portfolio", "dashboard"):
        ctx["dependencies"] = await db.project_dependencies.find(
            {"tenant_id": t}, {"_id": 0}).to_list(None)
        ctx["gates"] = await db.lifecycle_gates.find({"tenant_id": t}, {"_id": 0}).to_list(None)
        ctx["features"] = await db.tasks.find(
            {"tenant_id": t, "type": "feature", "pi_id": {"$ne": None}}, {"_id": 0}).to_list(None)
        month = date.today().strftime("%Y-%m")
        if not await db.allocations.count_documents({"period_month": month, "project_id": {"$in": pids}}):
            months = await db.allocations.distinct("period_month", {"project_id": {"$in": pids}})
            month = max(months) if months else month
        ctx["allocations"] = await db.allocations.find(
            {"period_month": month, "project_id": {"$in": pids}}, {"_id": 0}).to_list(None)
        since = (date.today() - timedelta(days=30)).isoformat()
        ctx["ts_resources"] = await db.timesheets.distinct(
            "resource_id", {"tenant_id": t, "date": {"$gte": since}})
    return ctx


# ─── Fonctions de calcul (synchrones, sur contexte préchargé) ─────────────────
def _project(ctx):
    return ctx["projects"][0] if ctx["projects"] else {}


def _evm(p, milestones):
    bac = p.get("budget_total") or 0
    ac = p.get("budget_consumed") or 0
    start, end = p.get("start_date"), p.get("end_date_forecast") or p.get("end_date_baseline")
    elapsed = 0
    if start and end and end > start:
        d0 = datetime.fromisoformat(start[:10]).date()
        d1 = datetime.fromisoformat(end[:10]).date()
        elapsed = min(max((date.today() - d0).days / max((d1 - d0).days, 1), 0), 1)
    total_ms = len(milestones)
    done_ms = sum(1 for m in milestones if m.get("status") in _DONE_MS)
    physical = done_ms / total_ms if total_ms else elapsed
    ev, pv = bac * physical, bac * elapsed
    cpi = round(ev / ac, 2) if ac > 0 else None
    spi = round(ev / pv, 2) if pv > 0 else None
    eac = p.get("eac") or (round(bac / cpi) if cpi else None)
    return {"bac": bac, "ac": ac, "ev": ev, "pv": pv, "cpi": cpi, "spi": spi, "eac": eac}


def _ms_due(milestones):
    today = _today()
    return [m for m in milestones if (m.get("date_forecast") or m.get("date_baseline") or "9999") < today]


def _ms_late(milestones):
    today = _today()
    out = []
    for m in milestones:
        if m.get("status") in _DONE_MS:
            continue
        d = m.get("date_forecast") or m.get("date_baseline")
        if m.get("status") == "delayed" or (d and d < today):
            out.append(m)
    return out


def bud01(ctx):
    return {"value": _project(ctx).get("budget_total"), "display": _eur(_project(ctx).get("budget_total"))}


def bud05(ctx):
    return {"value": _project(ctx).get("budget_consumed"), "display": _eur(_project(ctx).get("budget_consumed"))}


def bud08(ctx):
    e = _evm(_project(ctx), ctx["milestones"])
    return {"value": e["eac"], "display": _eur(e["eac"]) if e["eac"] else "—"}


def bud09(ctx):
    e = _evm(_project(ctx), ctx["milestones"])
    if not e["eac"] or not e["bac"]:
        return {"display": "—"}
    vac = e["bac"] - e["eac"]
    return {"value": vac, "display": f"{_eur(vac)} ({_pct(vac, e['bac'])}%)"}


def bud10(ctx):
    e = _evm(_project(ctx), ctx["milestones"])
    return {"value": e["cpi"], "display": str(e["cpi"]) if e["cpi"] is not None else "—"}


def bud13(ctx):
    ps = ctx["projects"]
    bac = sum(p.get("budget_total") or 0 for p in ps)
    ac = sum(p.get("budget_consumed") or 0 for p in ps)
    pct = _pct(ac, bac)
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{_eur(ac)} / {_eur(bac)}"}


def pla01(ctx):
    e = _evm(_project(ctx), ctx["milestones"])
    return {"value": e["spi"], "display": str(e["spi"]) if e["spi"] is not None else "—"}


def pla05(ctx):
    due = _ms_due(ctx["milestones"])
    held = sum(1 for m in due if m.get("status") in _DONE_MS)
    pct = _pct(held, len(due))
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{held}/{len(due)} jalons échus tenus"}


def pla06(ctx):
    late = _ms_late(ctx["milestones"])
    return {"value": len(late), "display": str(len(late)),
            "detail": ", ".join(m["name"][:25] for m in late[:3])}


def pla08(ctx):
    slips = []
    for p in ctx["projects"]:
        b, f = p.get("end_date_baseline"), p.get("end_date_forecast")
        if b and f:
            slips.append((datetime.fromisoformat(f[:10]) - datetime.fromisoformat(b[:10])).days)
    if not slips:
        return {"display": "—"}
    avg = round(sum(slips) / len(slips))
    return {"value": avg, "display": f"{avg:+d} j", "detail": f"{len(slips)} projets datés"}


def ris01(ctx):
    active = [r for r in ctx["risks"] if (r.get("status") or "").lower() in _OPEN_RISK]
    crit = sum(1 for r in active if (r.get("criticality") or 0) >= 4 or (r.get("criticality") or "") in ("critique", "haute"))
    return {"value": len(active), "display": str(len(active)), "detail": f"dont {crit} critiques"}


def ris04(ctx):
    high = [r for r in ctx["risks"] if (r.get("status") or "").lower() in _OPEN_RISK
            and ((isinstance(r.get("criticality"), (int, float)) and r["criticality"] >= 4)
                 or r.get("criticality") in ("critique", "haute"))]
    covered = sum(1 for r in high if r.get("mitigation_plan"))
    pct = _pct(covered, len(high))
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{covered}/{len(high)} risques majeurs couverts"}


def ris12(ctx):
    deps = ctx.get("dependencies", [])
    open_d = [d for d in deps if (d.get("status") or "") not in ("resolved", "résolue", "closed")]
    return {"value": len(open_d), "display": str(len(open_d))}


def agi01(ctx):
    closed = [s for s in ctx.get("sprints", []) if s.get("completed_points") is not None]
    if not closed:
        return {"display": "—"}
    avg = round(sum(s["completed_points"] or 0 for s in closed) / len(closed), 1)
    return {"value": avg, "display": f"{avg} pts/sprint", "detail": f"{len(closed)} sprints"}


def agi03(ctx):
    sp = [s for s in ctx.get("sprints", []) if s.get("committed_points")]
    committed = sum(s["committed_points"] or 0 for s in sp)
    completed = sum(s.get("completed_points") or 0 for s in sp)
    pct = _pct(completed, committed)
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{completed}/{committed} pts"}


def gou01(ctx):
    fields = ("description", "direction", "budget_total", "start_date", "end_date_forecast")
    ps = ctx["projects"]
    if not ps:
        return {"display": "—"}
    filled = sum(sum(1 for f in fields if p.get(f)) for p in ps)
    pct = _pct(filled, len(fields) * len(ps))
    return {"value": pct, "display": f"{pct}%"}


def gou02(ctx):
    limit = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    ps = ctx["projects"]
    stale = sum(1 for p in ps if (p.get("updated_at") or p.get("created_at") or "") < limit)
    pct = _pct(len(ps) - stale, len(ps))
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{stale} projet(s) non mis à jour depuis 30 j"}


def gou04(ctx):
    ps = ctx["projects"]
    counts = {"green": 0, "orange": 0, "red": 0}
    for p in ps:
        rag = (p.get("status_rag") or "").lower()
        if rag == "amber":
            rag = "orange"
        if rag in counts:
            counts[rag] += 1
    return {"value": counts, "display": f"{counts['green']} V · {counts['orange']} O · {counts['red']} R"}


def gou08(ctx):
    gates = ctx.get("gates", [])
    passed = sum(1 for g in gates if g.get("status") in ("go", "go_reserves"))
    pct = _pct(passed, len(gates))
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{passed}/{len(gates)} gates franchies"}


def cap05(ctx):
    per_res = {}
    for a in ctx.get("allocations", []):
        per_res[a["resource_id"]] = per_res.get(a["resource_id"], 0) + (a.get("allocation_rate") or 0)
    over = sum(1 for v in per_res.values() if v > 100)
    return {"value": over, "display": str(over), "detail": f"sur {len(per_res)} ressources allouées"}


def cap06(ctx):
    per_res = {}
    for a in ctx.get("allocations", []):
        per_res.setdefault(a["resource_id"], set()).add(a["project_id"])
    if not per_res:
        return {"display": "—"}
    avg = round(sum(len(v) for v in per_res.values()) / len(per_res), 1)
    multi = sum(1 for v in per_res.values() if len(v) > 3)
    return {"value": avg, "display": f"{avg} projets/pers.", "detail": f"{multi} pers. sur >3 projets"}


def cap08(ctx):
    allocated = {a["resource_id"] for a in ctx.get("allocations", [])}
    if not allocated:
        return {"display": "—"}
    with_ts = len(allocated & set(ctx.get("ts_resources", [])))
    pct = _pct(with_ts, len(allocated))
    return {"value": pct, "display": f"{pct}%", "detail": f"{with_ts}/{len(allocated)} ressources à jour (30 j)"}


def saf09(ctx):
    feats = ctx.get("features", [])
    done = sum(1 for f in feats if (f.get("status") or "").lower() in ("done", "completed", "terminé"))
    pct = _pct(done, len(feats))
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{done}/{len(feats)} features de PI livrées"}


def val09(ctx):
    ps = ctx["projects"]
    stopped = sum(1 for p in ps if (p.get("status") or "") in ("arrêté", "annulé", "stopped", "cancelled"))
    pct = _pct(stopped, len(ps))
    return {"value": pct, "display": f"{pct}%" if pct is not None else "—",
            "detail": f"{stopped}/{len(ps)} projets"}


_PORTFOLIO = {
    "BUD-13": bud13, "PLA-05": pla05, "PLA-06": pla06, "PLA-08": pla08,
    "RIS-01": ris01, "RIS-12": ris12,
    "GOU-01": gou01, "GOU-02": gou02, "GOU-04": gou04, "GOU-08": gou08,
    "CAP-05": cap05, "CAP-06": cap06, "CAP-08": cap08,
    "SAF-09": saf09, "VAL-09": val09,
}

REGISTRY = {
    "project": {
        "BUD-01": bud01, "BUD-05": bud05, "BUD-08": bud08, "BUD-09": bud09,
        "BUD-10": bud10, "BUD-13": bud13,
        "PLA-01": pla01, "PLA-05": pla05, "PLA-06": pla06,
        "RIS-01": ris01, "RIS-04": ris04,
        "AGI-01": agi01, "AGI-03": agi03,
    },
    "program": {
        "BUD-13": bud13, "PLA-05": pla05, "PLA-06": pla06,
        "RIS-01": ris01, "RIS-12": ris12,
    },
    "portfolio": _PORTFOLIO,
    "dashboard": _PORTFOLIO,
}

AUTO_IDS = sorted({i for m in REGISTRY.values() for i in m})
