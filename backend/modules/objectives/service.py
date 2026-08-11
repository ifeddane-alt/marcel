import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload

VALID_STATUSES = ["actif", "atteint", "abandonne"]

_PROJECT_FIELDS = {"_id": 0, "project_id": 1, "name": 1, "code": 1, "budget_total": 1,
                   "budget_consumed": 1, "status_rag": 1, "objective_ids": 1,
                   "start_date": 1, "end_date_forecast": 1, "end_date_initial": 1}


def _elapsed_pct(start, end) -> int:
    from datetime import date
    try:
        sd = datetime.strptime(str(start)[:10], "%Y-%m-%d").date()
        ed = datetime.strptime(str(end)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return 0
    if ed <= sd:
        return 100
    pct = (date.today() - sd).days / (ed - sd).days * 100
    return max(0, min(100, round(pct)))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_write(user: TokenPayload) -> None:
    if user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(403, "Droits insuffisants pour gérer les objectifs stratégiques")


async def list_objectives(user: TokenPayload) -> list:
    objectives = await db.strategic_objectives.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(None)
    projects = await db.projects.find({"tenant_id": user.tenant_id}, _PROJECT_FIELDS).to_list(None)
    pids = [p["project_id"] for p in projects]
    ms_stats = {}
    async for row in db.milestones.aggregate([
        {"$match": {"project_id": {"$in": pids}}},
        {"$group": {"_id": "$project_id", "total": {"$sum": 1},
                    "done": {"$sum": {"$cond": [{"$in": ["$status", ["achieved", "done"]]}, 1, 0]}}}},
    ]):
        ms_stats[row["_id"]] = {"done": row["done"], "total": row["total"]}
    for p in projects:
        p["progress"] = _elapsed_pct(p.get("start_date"), p.get("end_date_forecast") or p.get("end_date_initial"))
    for o in objectives:
        linked = [p for p in projects if o["objective_id"] in (p.get("objective_ids") or [])]
        rag = {"green": 0, "orange": 0, "red": 0}
        for p in linked:
            if p.get("status_rag") in rag:
                rag[p["status_rag"]] += 1
        o["projects"] = [
            {"project_id": p["project_id"], "name": p["name"], "code": p.get("code"),
             "status_rag": p.get("status_rag"), "budget_total": p.get("budget_total") or 0,
             "progress": p["progress"],
             "milestones_done": ms_stats.get(p["project_id"], {}).get("done", 0),
             "milestones_total": ms_stats.get(p["project_id"], {}).get("total", 0)}
            for p in linked
        ]
        o["project_count"] = len(linked)
        o["budget_total"] = sum(p.get("budget_total") or 0 for p in linked)
        o["budget_consumed"] = sum(p.get("budget_consumed") or 0 for p in linked)
        weight_sum = sum(p.get("budget_total") or 0 for p in linked)
        if weight_sum:
            o["progress_avg"] = round(sum(p["progress"] * (p.get("budget_total") or 0) for p in linked) / weight_sum)
        elif linked:
            o["progress_avg"] = round(sum(p["progress"] for p in linked) / len(linked))
        else:
            o["progress_avg"] = 0
        o["milestones_done"] = sum(ms_stats.get(p["project_id"], {}).get("done", 0) for p in linked)
        o["milestones_total"] = sum(ms_stats.get(p["project_id"], {}).get("total", 0) for p in linked)
        o["rag"] = rag
    return objectives


async def get_alignment(user: TokenPayload) -> dict:
    projects = await db.projects.find({"tenant_id": user.tenant_id}, _PROJECT_FIELDS).to_list(None)
    total = len(projects)
    budget_total = sum(p.get("budget_total") or 0 for p in projects)
    aligned = [p for p in projects if p.get("objective_ids")]
    unaligned = [p for p in projects if not p.get("objective_ids")]
    budget_aligned = sum(p.get("budget_total") or 0 for p in aligned)
    return {
        "total_projects": total,
        "aligned_projects": len(aligned),
        "alignment_pct": round(len(aligned) / total * 100) if total else 0,
        "budget_total": budget_total,
        "budget_aligned": budget_aligned,
        "budget_alignment_pct": round(budget_aligned / budget_total * 100) if budget_total else 0,
        "unaligned": [
            {"project_id": p["project_id"], "name": p["name"], "code": p.get("code"),
             "budget_total": p.get("budget_total") or 0}
            for p in unaligned
        ],
    }


async def create_objective(data: dict, user: TokenPayload) -> dict:
    _require_write(user)
    title = (data.get("title") or "").strip()
    if not title:
        raise HTTPException(422, "Le titre de l'objectif est obligatoire")
    status = data.get("status") or "actif"
    if status not in VALID_STATUSES:
        raise HTTPException(422, f"Statut invalide: {status}")
    doc = {
        "objective_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "title": title,
        "description": data.get("description") or "",
        "pillar": data.get("pillar") or "",
        "horizon": data.get("horizon") or "",
        "owner": data.get("owner") or "",
        "status": status,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.strategic_objectives.insert_one(doc)
    doc.pop("_id", None)
    from core.audit import log_audit
    await log_audit(user, "created", "objective", doc["objective_id"], title)
    return doc


async def update_objective(objective_id: str, data: dict, user: TokenPayload) -> dict:
    _require_write(user)
    old = await db.strategic_objectives.find_one(
        {"objective_id": objective_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not old:
        raise HTTPException(404, "Objectif introuvable")
    updates = {}
    for field in ["title", "description", "pillar", "horizon", "owner", "status"]:
        if field in data and data[field] is not None:
            updates[field] = data[field]
    if "title" in updates and not (updates["title"] or "").strip():
        raise HTTPException(422, "Le titre de l'objectif est obligatoire")
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(422, "Statut invalide")
    updates["updated_at"] = _now()
    await db.strategic_objectives.update_one(
        {"objective_id": objective_id, "tenant_id": user.tenant_id}, {"$set": updates}
    )
    updated = await db.strategic_objectives.find_one({"objective_id": objective_id}, {"_id": 0})
    from core.audit import log_audit, diff_changes
    changes = diff_changes(old, updates)
    if changes:
        await log_audit(user, "updated", "objective", objective_id, updated.get("title", ""), changes)
    return updated


async def delete_objective(objective_id: str, user: TokenPayload) -> None:
    _require_write(user)
    old = await db.strategic_objectives.find_one(
        {"objective_id": objective_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not old:
        raise HTTPException(404, "Objectif introuvable")
    await db.strategic_objectives.delete_one(
        {"objective_id": objective_id, "tenant_id": user.tenant_id}
    )
    await db.projects.update_many(
        {"tenant_id": user.tenant_id, "objective_ids": objective_id},
        {"$pull": {"objective_ids": objective_id}},
    )
    from core.audit import log_audit
    await log_audit(user, "deleted", "objective", objective_id, old.get("title", ""))


async def set_objective_projects(objective_id: str, project_ids: list, user: TokenPayload) -> dict:
    _require_write(user)
    obj = await db.strategic_objectives.find_one(
        {"objective_id": objective_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not obj:
        raise HTTPException(404, "Objectif introuvable")
    old_count = await db.projects.count_documents(
        {"tenant_id": user.tenant_id, "objective_ids": objective_id}
    )
    await db.projects.update_many(
        {"tenant_id": user.tenant_id, "project_id": {"$in": project_ids or []}},
        {"$addToSet": {"objective_ids": objective_id}},
    )
    await db.projects.update_many(
        {"tenant_id": user.tenant_id, "project_id": {"$nin": project_ids or []}, "objective_ids": objective_id},
        {"$pull": {"objective_ids": objective_id}},
    )
    from core.audit import log_audit
    await log_audit(user, "projects_linked", "objective", objective_id, obj.get("title", ""), [
        {"field": "projets rattachés", "old": old_count, "new": len(project_ids or [])},
    ])
    return {"objective_id": objective_id, "project_count": len(project_ids or [])}
