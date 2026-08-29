"""Reforecast trimestriel (scope valorisé) + console budget cible."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from core.database import db
from core.audit import log_audit


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _quarter_of(month_iso: str) -> str:
    y, m = month_iso[:4], int(month_iso[5:7])
    return f"{y}-Q{(m - 1) // 3 + 1}"


async def _tjm_map(tenant_id: str) -> tuple:
    resources = await db.resources.find(
        {"tenant_id": tenant_id}, {"_id": 0, "resource_id": 1, "tjm_eur": 1, "contract_tjm": 1}).to_list(None)
    tjms = {}
    known = []
    for r in resources:
        t = r.get("tjm_eur") or r.get("contract_tjm") or 0
        tjms[r["resource_id"]] = t
        if t:
            known.append(t)
    default = round(sum(known) / len(known)) if known else 600
    return tjms, default


async def quarters_summary(year: int, tenant_id: str) -> dict:
    projects = await db.projects.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "project_id": 1, "name": 1, "code": 1, "status": 1,
         "budget_total": 1, "budget_consumed": 1, "eac": 1}).to_list(None)
    pids = [p["project_id"] for p in projects]
    allocs = await db.allocations.find(
        {"project_id": {"$in": pids}, "period_month": {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}},
        {"_id": 0, "project_id": 1, "resource_id": 1, "period_month": 1, "jh_allocated": 1, "jh_consumed": 1}).to_list(None)
    tjms, default_tjm = await _tjm_map(tenant_id)

    scope: dict = {}
    consumed: dict = {}
    for a in allocs:
        q = _quarter_of(a["period_month"])
        tjm = tjms.get(a["resource_id"]) or default_tjm
        key = (a["project_id"], q)
        scope[key] = scope.get(key, 0) + (a.get("jh_allocated") or 0) * tjm
        consumed[key] = consumed.get(key, 0) + (a.get("jh_consumed") or 0) * tjm

    stored = await db.forecasts.find(
        {"tenant_id": tenant_id, "quarter": {"$regex": f"^{year}-"}}, {"_id": 0}).to_list(None)
    stored_map = {(f["project_id"], f["quarter"]): f for f in stored}

    quarters = [f"{year}-Q{i}" for i in range(1, 5)]
    rows = []
    for p in projects:
        cells = []
        total_scope = 0
        for q in quarters:
            sv = round(scope.get((p["project_id"], q), 0))
            cv = round(consumed.get((p["project_id"], q), 0))
            st = stored_map.get((p["project_id"], q))
            total_scope += sv
            cells.append({
                "quarter": q, "scope_value": sv, "consumed_value": cv,
                "validated": bool(st and st.get("status") == "valide"),
                "adjustment": (st or {}).get("adjustment", 0),
                "final_value": (st or {}).get("final_value", sv),
            })
        rows.append({
            "project_id": p["project_id"], "name": p.get("name"), "code": p.get("code"),
            "status": p.get("status"), "budget_total": p.get("budget_total") or 0,
            "budget_consumed": p.get("budget_consumed") or 0, "eac": p.get("eac") or 0,
            "quarters": cells, "forecast_year": total_scope,
            "ecart_budget": round((p.get("budget_total") or 0) - total_scope),
        })
    rows.sort(key=lambda r: -(r["budget_total"]))
    return {"year": year, "default_tjm": default_tjm, "projects": rows,
            "totals": {
                "budget": sum(r["budget_total"] for r in rows),
                "forecast": sum(r["forecast_year"] for r in rows),
                "consumed": sum(r["budget_consumed"] for r in rows),
            }}


async def validate_reforecast(data: dict, user) -> dict:
    project_id, quarter = data["project_id"], data["quarter"]
    adjustment = float(data.get("adjustment") or 0)
    year = int(quarter[:4])
    summary = await quarters_summary(year, user.tenant_id)
    row = next((r for r in summary["projects"] if r["project_id"] == project_id), None)
    if not row:
        return {"error": "project not found"}
    cell = next(c for c in row["quarters"] if c["quarter"] == quarter)
    final = cell["scope_value"] + adjustment
    await db.forecasts.update_one(
        {"tenant_id": user.tenant_id, "project_id": project_id, "quarter": quarter},
        {"$set": {"scope_value": cell["scope_value"], "adjustment": adjustment,
                  "final_value": final, "status": "valide",
                  "validated_by": user.email, "validated_at": _now()},
         "$setOnInsert": {"forecast_id": str(uuid.uuid4()), "tenant_id": user.tenant_id,
                          "project_id": project_id, "quarter": quarter}},
        upsert=True)
    await log_audit(user, "reforecast_validated", "project", project_id, row.get("name", ""),
                    [{"field": quarter, "new": final}])
    return {"project_id": project_id, "quarter": quarter, "final_value": final, "status": "valide"}


# ─── Console budget cible ──────────────────────────────────────────────────────

async def get_levers(tenant_id: str, project_id: str = None) -> dict:
    q: dict = {"tenant_id": tenant_id}
    if project_id:
        q["project_id"] = project_id
    else:
        q["status"] = {"$nin": ["termine", "pause", "annule"]}
    projects = await db.projects.find(
        q, {"_id": 0, "project_id": 1, "name": 1, "code": 1, "status": 1,
            "budget_total": 1, "budget_consumed": 1}).to_list(None)
    pids = [p["project_id"] for p in projects]
    pmap = {p["project_id"]: p for p in projects}
    tjms, default_tjm = await _tjm_map(tenant_id)

    tasks = await db.tasks.find(
        {"project_id": {"$in": pids}, "scope_status": {"$in": ["sec", "etendu"]},
         "status": {"$nin": ["done", "termine"]}},
        {"_id": 0, "task_id": 1, "project_id": 1, "name": 1, "scope_status": 1,
         "resource_id": 1, "phase_estimates": 1}).to_list(None)

    levers = []
    for t in tasks:
        jh = sum(e.get("jh_estimated", 0) for e in (t.get("phase_estimates") or []))
        if jh <= 0:
            continue
        tjm = tjms.get(t.get("resource_id")) or default_tjm
        levers.append({
            "type": "task", "id": t["task_id"], "project_id": t["project_id"],
            "project_name": pmap[t["project_id"]].get("name"),
            "label": t.get("name", ""), "scope_status": t.get("scope_status"),
            "jh": jh, "value": round(jh * tjm),
        })
    if not project_id:
        raf_tasks = await db.tasks.find(
            {"project_id": {"$in": pids}, "status": {"$nin": ["done", "termine", "completed"]}},
            {"_id": 0, "project_id": 1, "resource_id": 1, "scope_status": 1,
             "jh_restants_estimes": 1, "jh_planned": 1, "jh_consumed": 1}).to_list(None)
        raf_map: dict = {}
        for t in raf_tasks:
            scope = (t.get("scope_status") or "").strip().lower()
            if scope == "out":
                continue
            raf = t.get("jh_restants_estimes")
            if raf is None:
                raf = max((t.get("jh_planned") or 0) - (t.get("jh_consumed") or 0), 0)
            if raf <= 0:
                continue
            tjm = tjms.get(t.get("resource_id")) or default_tjm
            e = raf_map.setdefault(t["project_id"], {"jh_total": 0.0, "val_total": 0.0, "jh_mvp": 0.0,
                                                     "val_mvp": 0.0, "jh_unq": 0.0, "val_unq": 0.0})
            e["jh_total"] += raf
            e["val_total"] += raf * tjm
            if scope == "sec":
                e["jh_mvp"] += raf
                e["val_mvp"] += raf * tjm
            elif not scope:
                e["jh_unq"] += raf
                e["val_unq"] += raf * tjm
        for p in projects:
            e = raf_map.get(p["project_id"])
            if not e or e["val_total"] <= 0:
                continue
            value_full = round(e["val_total"])
            levers.append({
                "type": "pause", "id": p["project_id"], "project_id": p["project_id"],
                "project_name": p.get("name"), "label": f"Mettre en pause — {p.get('name')}",
                "scope_status": None, "jh": round(e["jh_total"], 1), "value": value_full,
                "value_full": value_full, "jh_full": round(e["jh_total"], 1),
                "value_mvp": round(e["val_total"] - e["val_mvp"]),
                "jh_mvp_preserved": round(e["jh_mvp"], 1),
                "value_mvp_preserved": round(e["val_mvp"]),
                "jh_unqualified": round(e["jh_unq"], 1),
                "value_unqualified": round(e["val_unq"]),
            })
    levers.sort(key=lambda l: -l["value"])
    return {"levers": levers, "default_tjm": default_tjm}


async def apply_cuts(data: dict, user) -> dict:
    items = data.get("items", [])
    scenario_id = data.get("scenario_id")
    applied = {"tasks_out": 0, "projects_paused": 0, "total_saved": 0}
    details = []
    for it in items:
        if it["type"] == "task":
            task = await db.tasks.find_one(
                {"task_id": it["id"]}, {"_id": 0, "name": 1, "project_id": 1, "scope_status": 1})
            proj = task and await db.projects.find_one(
                {"project_id": task["project_id"], "tenant_id": user.tenant_id}, {"_id": 0, "project_id": 1})
            if not proj:
                continue
            await db.tasks.update_one({"task_id": it["id"]}, {"$set": {"scope_status": "out"}})
            applied["tasks_out"] += 1
            applied["total_saved"] += it.get("value", 0)
            details.append({"type": "task", "id": it["id"], "label": task.get("name", ""), "value": it.get("value", 0),
                            "restore": {"tasks": [{"task_id": it["id"], "prev_scope": task.get("scope_status")}]}})
        elif it["type"] == "reduce_mvp":
            proj = await db.projects.find_one(
                {"project_id": it["id"], "tenant_id": user.tenant_id}, {"_id": 0, "name": 1})
            if not proj:
                continue
            affected = await db.tasks.find(
                {"project_id": it["id"], "status": {"$nin": ["done", "termine", "completed"]},
                 "scope_status": {"$not": {"$regex": "^(sec|out)$", "$options": "i"}}},
                {"_id": 0, "task_id": 1, "scope_status": 1}).to_list(None)
            if affected:
                await db.tasks.update_many(
                    {"task_id": {"$in": [a["task_id"] for a in affected]}},
                    {"$set": {"scope_status": "out"}})
            applied["tasks_out"] += len(affected)
            applied["projects_reduced"] = applied.get("projects_reduced", 0) + 1
            applied["total_saved"] += it.get("value", 0)
            details.append({"type": "reduce_mvp", "id": it["id"],
                            "label": f"Réduction au MVP — {proj.get('name', '')}", "value": it.get("value", 0),
                            "restore": {"tasks": [{"task_id": a["task_id"], "prev_scope": a.get("scope_status")}
                                                  for a in affected]}})
        elif it["type"] == "pause":
            proj = await db.projects.find_one(
                {"project_id": it["id"], "tenant_id": user.tenant_id}, {"_id": 0, "name": 1, "status": 1})
            if not proj:
                continue
            await db.projects.update_one(
                {"project_id": it["id"], "tenant_id": user.tenant_id}, {"$set": {"status": "pause"}})
            applied["projects_paused"] += 1
            applied["total_saved"] += it.get("value", 0)
            details.append({"type": "pause", "id": it["id"], "label": proj.get("name", ""), "value": it.get("value", 0),
                            "restore": {"project_status": proj.get("status")}})
    cut_id = str(uuid.uuid4())
    await db.budget_cuts.insert_one({
        "cut_id": cut_id, "tenant_id": user.tenant_id,
        "target": data.get("target"), "total_saved": applied["total_saved"],
        "scenario_id": scenario_id,
        "details": details, "created_by": user.email, "created_at": _now()})
    if scenario_id:
        await db.cut_scenarios.update_one(
            {"scenario_id": scenario_id, "tenant_id": user.tenant_id},
            {"$set": {"status": "applied", "applied_at": _now(), "applied_cut_id": cut_id}})
    await log_audit(user, "budget_cuts_applied", "portfolio", "portfolio", "Console budget cible",
                    [{"field": "total_saved", "new": applied["total_saved"]}])
    return applied


async def list_cuts(tenant_id: str) -> list:
    return await db.budget_cuts.find({"tenant_id": tenant_id}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(None)


async def restore_cut(cut_id: str, user) -> dict:
    cut = await db.budget_cuts.find_one({"cut_id": cut_id, "tenant_id": user.tenant_id}, {"_id": 0})
    if not cut:
        raise HTTPException(status_code=404, detail="Coupe introuvable")
    if cut.get("restored"):
        raise HTTPException(status_code=409, detail="Cette coupe a déjà été restaurée")
    restored = {"tasks_restored": 0, "projects_reactivated": 0}
    for d in cut.get("details", []):
        info = d.get("restore") or {}
        if d["type"] in ("task", "reduce_mvp"):
            entries = info.get("tasks")
            if entries is None:
                if d["type"] == "task":
                    entries = [{"task_id": d["id"]}]
                else:  # legacy reduce_mvp sans mémoire : tâches out non terminées du projet
                    legacy = await db.tasks.find(
                        {"project_id": d["id"], "scope_status": "out",
                         "status": {"$nin": ["done", "termine", "completed"]}},
                        {"_id": 0, "task_id": 1}).to_list(None)
                    entries = [{"task_id": t["task_id"]} for t in legacy]
            for e in entries:
                prev = e.get("prev_scope")
                if prev in ("sec", "etendu", "out"):
                    update = {"$set": {"scope_status": prev}}
                elif "prev_scope" in e:
                    update = {"$unset": {"scope_status": ""}}   # non qualifiée à l'origine
                else:
                    update = {"$set": {"scope_status": "etendu"}}   # coupe legacy sans mémoire
                r = await db.tasks.update_one({"task_id": e["task_id"]}, update)
                restored["tasks_restored"] += r.matched_count
        elif d["type"] == "pause":
            prev = info.get("project_status") or "actif"
            r = await db.projects.update_one(
                {"project_id": d["id"], "tenant_id": user.tenant_id}, {"$set": {"status": prev}})
            restored["projects_reactivated"] += r.matched_count
    await db.budget_cuts.update_one(
        {"cut_id": cut_id, "tenant_id": user.tenant_id},
        {"$set": {"restored": True, "restored_by": user.email, "restored_at": _now()}})
    if cut.get("scenario_id"):
        await db.cut_scenarios.update_one(
            {"scenario_id": cut["scenario_id"], "tenant_id": user.tenant_id},
            {"$set": {"status": "draft"}, "$unset": {"applied_at": "", "applied_cut_id": ""}})
    await log_audit(user, "budget_cuts_restored", "portfolio", "portfolio", "Console budget cible",
                    [{"field": "cut_id", "new": cut_id}])
    return restored


# ─── Scénarios de coupe versionnés ────────────────────────────────────────────

async def list_scenarios(tenant_id: str) -> list:
    return await db.cut_scenarios.find(
        {"tenant_id": tenant_id}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(None)


async def save_scenario(data: dict, user) -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Nom du scénario requis")
    items = data.get("items") or []
    if not items:
        raise HTTPException(status_code=422, detail="Aucun levier sélectionné")
    lineage_id = data.get("lineage_id")
    version = 1
    if lineage_id:
        last = await db.cut_scenarios.find(
            {"tenant_id": user.tenant_id, "lineage_id": lineage_id},
            {"_id": 0, "version": 1}).sort("version", -1).limit(1).to_list(1)
        if not last:
            raise HTTPException(status_code=404, detail="Lignée de scénario introuvable")
        version = last[0]["version"] + 1
    else:
        lineage_id = str(uuid.uuid4())
    doc = {
        "scenario_id": str(uuid.uuid4()), "tenant_id": user.tenant_id,
        "lineage_id": lineage_id, "version": version, "name": name,
        "target": data.get("target"),
        "items": [{"type": it.get("type"), "id": it.get("id"), "mode": it.get("mode"),
                   "label": it.get("label", ""), "value_saved": it.get("value", 0)} for it in items],
        "total_saved": sum(it.get("value", 0) for it in items),
        "status": "draft", "created_by": user.email, "created_at": _now()}
    await db.cut_scenarios.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "cut_scenario_saved", "portfolio", "portfolio", f"Scénario {name} V{version}",
                    [{"field": "total_saved", "new": doc["total_saved"]}])
    return doc


async def delete_scenario(scenario_id: str, user) -> None:
    result = await db.cut_scenarios.delete_one({"scenario_id": scenario_id, "tenant_id": user.tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scénario introuvable")
