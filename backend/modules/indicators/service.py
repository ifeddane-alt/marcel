import uuid
from datetime import datetime, timezone, date, timedelta
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload
from core.simple_crud import require_dsi_write

_DONE = ("completed", "done")
_OPEN_RISK = ("identifié", "en cours")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _elapsed_pct(start, end) -> int:
    try:
        sd = datetime.strptime(str(start)[:10], "%Y-%m-%d").date()
        ed = datetime.strptime(str(end)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return 0
    if ed <= sd:
        return 100
    return max(0, min(100, round((date.today() - sd).days / (ed - sd).days * 100)))


def _physical_progress(tasks: list, milestones: list, elapsed: int) -> float:
    """Avancement physique 0..1 : JH tâches, sinon jalons, sinon temps écoulé."""
    jh_p = sum(t.get("jh_planned") or 0 for t in tasks)
    jh_c = sum(t.get("jh_consumed") or 0 for t in tasks)
    if jh_p > 0:
        return min(jh_c / jh_p, 1.0)
    if milestones:
        done = sum(1 for m in milestones if m.get("status") in ("achieved", "done"))
        return done / len(milestones)
    return elapsed / 100


def _common(p: dict, tasks: list, milestones: list, risks: list) -> dict:
    elapsed = _elapsed_pct(p.get("start_date"), p.get("end_date_forecast") or p.get("end_date_baseline"))
    physical = round(_physical_progress(tasks, milestones, elapsed) * 100)
    today = date.today().isoformat()
    late_ms = sum(1 for m in milestones
                  if m.get("status") not in ("achieved", "done")
                  and (m.get("date_forecast") or m.get("date_baseline") or "9999")[:10] < today)
    open_risks = [r for r in risks if r.get("status") in _OPEN_RISK]
    budget_total = p.get("budget_total") or 0
    budget_consumed = p.get("budget_consumed") or 0
    return {
        "status_rag": p.get("status_rag"),
        "elapsed_pct": elapsed,
        "physical_pct": physical,
        "budget_total": budget_total,
        "budget_consumed": budget_consumed,
        "budget_pct": round(budget_consumed / budget_total * 100) if budget_total > 0 else 0,
        "eac": p.get("eac") or p.get("budget_forecast"),
        "jh_planned": p.get("jh_planned") or sum(t.get("jh_planned") or 0 for t in tasks),
        "jh_consumed": p.get("jh_consumed") or sum(t.get("jh_consumed") or 0 for t in tasks),
        "risks_open": len(open_risks),
        "risks_critical": sum(1 for r in open_risks if (r.get("criticality") or 0) >= 15),
        "milestones_total": len(milestones),
        "milestones_done": sum(1 for m in milestones if m.get("status") in ("achieved", "done")),
        "milestones_late": late_ms,
    }


def _evm(p: dict, tasks: list, milestones: list) -> dict:
    bac = p.get("budget_total") or 0
    ac = p.get("budget_consumed") or 0
    elapsed = _elapsed_pct(p.get("start_date"), p.get("end_date_forecast") or p.get("end_date_baseline"))
    physical = _physical_progress(tasks, milestones, elapsed)
    pv = bac * elapsed / 100
    ev = bac * physical
    cpi = round(ev / ac, 2) if ac > 0 else None
    spi = round(ev / pv, 2) if pv > 0 else None
    eac_evm = round(bac / cpi) if cpi and cpi > 0 else None
    return {
        "bac": bac, "pv": round(pv), "ev": round(ev), "ac": ac,
        "cpi": cpi, "spi": spi,
        "eac_evm": eac_evm,
        "vac": round(bac - eac_evm) if eac_evm is not None else None,
    }


async def _agile(project_id: str, tenant_id: str, tasks: list) -> dict:
    sprints = await db.project_sprints.find(
        {"project_id": project_id, "tenant_id": tenant_id}, {"_id": 0}
    ).sort("start_date", 1).to_list(None)
    closed = [s for s in sprints if s.get("status") == "termine" and (s.get("completed_points") or 0) > 0]
    velocities = [s.get("completed_points") or 0 for s in closed]
    last3 = velocities[-3:]
    velocity_avg = round(sum(last3) / len(last3), 1) if last3 else None
    trend = None
    if len(velocities) >= 2:
        trend = "up" if velocities[-1] > velocities[-2] else "down" if velocities[-1] < velocities[-2] else "flat"
    last = closed[-1] if closed else None
    completion = round((last["completed_points"] / last["committed_points"]) * 100) \
        if last and (last.get("committed_points") or 0) > 0 else None
    cutoff = (date.today() - timedelta(days=90)).isoformat()
    throughput = sum(1 for t in tasks if t.get("status") in _DONE
                     and (t.get("date_end_actual") or "")[:10] >= cutoff)
    open_tasks = [t for t in tasks if t.get("status") not in _DONE]
    ages = []
    for t in open_tasks:
        try:
            ages.append((date.today() - datetime.strptime(str(t["created_at"])[:10], "%Y-%m-%d").date()).days)
        except (ValueError, TypeError, KeyError):
            pass
    burnup, cum = [], 0
    for s in sprints:
        cum += s.get("completed_points") or 0
        burnup.append({"sprint": s.get("name"), "cumulative": cum, "committed": s.get("committed_points") or 0,
                       "completed": s.get("completed_points") or 0, "status": s.get("status")})
    return {
        "sprints_count": len(sprints),
        "velocity_avg": velocity_avg,
        "velocity_trend": trend,
        "last_sprint_completion_pct": completion,
        "wip": sum(1 for t in tasks if t.get("status") == "in_progress"),
        "throughput_90d": throughput,
        "avg_task_age_days": round(sum(ages) / len(ages)) if ages else None,
        "burnup": burnup,
    }


async def _safe_metrics(tenant_id: str) -> dict:
    sprints = await db.sprints.find(
        {"tenant_id": tenant_id, "status": {"$in": ["completed", "done", "termine", "closed"]}},
        {"_id": 0, "velocity_planned": 1, "velocity_actual": 1},
    ).to_list(None)
    ratios = [s["velocity_actual"] / s["velocity_planned"]
              for s in sprints if (s.get("velocity_planned") or 0) > 0 and s.get("velocity_actual") is not None]
    pis_active = await db.pis.count_documents({"tenant_id": tenant_id, "status": {"$nin": ["done", "completed"]}})
    return {
        "predictability_pct": round(sum(ratios) / len(ratios) * 100) if ratios else None,
        "sprints_measured": len(ratios),
        "pis_active": pis_active,
    }


async def get_project_indicators(project_id: str, user: TokenPayload) -> dict:
    p = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not p:
        raise HTTPException(404, "Projet introuvable")
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    milestones = await db.milestones.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    risks = await db.risks.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    method = p.get("methodology") or "waterfall"
    result = {
        "project_id": project_id,
        "methodology": method,
        "common": _common(p, tasks, milestones, risks),
    }
    if method in ("waterfall", "hybrid"):
        result["evm"] = _evm(p, tasks, milestones)
    if method in ("agile", "safe", "hybrid"):
        result["agile"] = await _agile(project_id, user.tenant_id, tasks)
    if method == "safe":
        result["safe"] = await _safe_metrics(user.tenant_id)
    return result


async def get_portfolio_indicators(user: TokenPayload) -> list:
    projects = await db.projects.find({"tenant_id": user.tenant_id}, {"_id": 0}).to_list(None)
    result = []
    for p in projects:
        pid = p["project_id"]
        tasks = await db.tasks.find({"project_id": pid}, {"_id": 0}).to_list(None)
        milestones = await db.milestones.find({"project_id": pid}, {"_id": 0}).to_list(None)
        risks = await db.risks.find({"project_id": pid}, {"_id": 0}).to_list(None)
        method = p.get("methodology") or "waterfall"
        row = {
            "project_id": pid, "name": p["name"], "code": p.get("code"),
            "methodology": method, **_common(p, tasks, milestones, risks),
        }
        if method in ("waterfall", "hybrid"):
            evm = _evm(p, tasks, milestones)
            row["cpi"], row["spi"] = evm["cpi"], evm["spi"]
        if method in ("agile", "safe", "hybrid"):
            ag = await _agile(pid, user.tenant_id, tasks)
            row["velocity_avg"] = ag["velocity_avg"]
            row["last_sprint_completion_pct"] = ag["last_sprint_completion_pct"]
            row["wip"] = ag["wip"]
        result.append(row)
    return result


# ─── Sprints projet (saisie agile) ───────────────────────────────────────────

_SPRINT_FIELDS = {"name", "start_date", "end_date", "committed_points", "completed_points", "status"}


async def list_sprints(project_id: str, user: TokenPayload) -> list:
    return await db.project_sprints.find(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("start_date", 1).to_list(None)


async def create_sprint(project_id: str, data: dict, user: TokenPayload) -> dict:
    require_dsi_write(user)
    if not (data.get("name") or "").strip():
        raise HTTPException(400, "Le nom du sprint est requis")
    doc = {
        "sprint_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "project_id": project_id,
        "status": "en_cours",
        **{k: v for k, v in data.items() if k in _SPRINT_FIELDS},
        "created_at": _now(),
    }
    await db.project_sprints.insert_one({**doc})
    doc.pop("_id", None)
    return doc


async def update_sprint(sprint_id: str, data: dict, user: TokenPayload) -> dict:
    require_dsi_write(user)
    res = await db.project_sprints.update_one(
        {"sprint_id": sprint_id, "tenant_id": user.tenant_id},
        {"$set": {k: v for k, v in data.items() if k in _SPRINT_FIELDS}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Sprint introuvable")
    return await db.project_sprints.find_one({"sprint_id": sprint_id}, {"_id": 0})


async def delete_sprint(sprint_id: str, user: TokenPayload) -> None:
    require_dsi_write(user)
    res = await db.project_sprints.delete_one({"sprint_id": sprint_id, "tenant_id": user.tenant_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Sprint introuvable")
