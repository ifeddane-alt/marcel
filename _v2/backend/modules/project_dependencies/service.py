import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload

VALID_NATURES = ["deliverable", "resource", "technical", "regulatory", "budget", "data"]
VALID_STATUSES = ["identified", "in_progress", "resolved", "blocked"]
VALID_IMPACTS = ["low", "medium", "high", "critical"]
VALID_DIRECTIONS = ["inbound", "outbound"]


async def _check_project_access(project_id: str, tenant_id: str) -> dict:
    proj = await db.projects.find_one({"project_id": project_id, "tenant_id": tenant_id})
    if not proj:
        raise HTTPException(status_code=404, detail=f"Projet {project_id} introuvable")
    return proj


async def list_dependencies(project_id: str, current_user: TokenPayload) -> list:
    await _check_project_access(project_id, current_user.tenant_id)
    deps = await db.project_dependencies.find(
        {
            "$or": [
                {"source_project_id": project_id},
                {"target_project_id": project_id},
            ],
            "tenant_id": current_user.tenant_id,
        },
        {"_id": 0},
    ).to_list(None)

    # Enrich with project names
    all_pids = set()
    for d in deps:
        all_pids.add(d.get("source_project_id"))
        all_pids.add(d.get("target_project_id"))
    projs = await db.projects.find(
        {"project_id": {"$in": list(all_pids)}, "tenant_id": current_user.tenant_id},
        {"_id": 0, "project_id": 1, "name": 1},
    ).to_list(None)
    proj_map = {p["project_id"]: p["name"] for p in projs}

    for d in deps:
        d["source_project_name"] = proj_map.get(d.get("source_project_id"), "?")
        d["target_project_name"] = proj_map.get(d.get("target_project_id"), "?")

    return deps


async def list_all_dependencies(tenant_id: str) -> list:
    """Retourne toutes les dépendances d'un tenant (pour la roadmap)."""
    deps = await db.project_dependencies.find(
        {"tenant_id": tenant_id}, {"_id": 0}
    ).to_list(None)
    all_pids = set()
    for d in deps:
        all_pids.add(d.get("source_project_id"))
        all_pids.add(d.get("target_project_id"))
    projs = await db.projects.find(
        {"project_id": {"$in": list(all_pids)}, "tenant_id": tenant_id},
        {"_id": 0, "project_id": 1, "name": 1},
    ).to_list(None)
    proj_map = {p["project_id"]: p["name"] for p in projs}
    for d in deps:
        d["source_project_name"] = proj_map.get(d.get("source_project_id"), "?")
        d["target_project_name"] = proj_map.get(d.get("target_project_id"), "?")
    return deps


async def create_dependency(data: dict, current_user: TokenPayload) -> dict:
    source_pid = data.get("source_project_id")
    target_pid = data.get("target_project_id")
    if not source_pid or not target_pid:
        raise HTTPException(status_code=400, detail="source_project_id et target_project_id requis")
    if source_pid == target_pid:
        raise HTTPException(status_code=400, detail="Un projet ne peut pas dépendre de lui-même")

    await _check_project_access(source_pid, current_user.tenant_id)
    await _check_project_access(target_pid, current_user.tenant_id)

    nature = data.get("nature", "technical")
    if nature not in VALID_NATURES:
        raise HTTPException(status_code=400, detail=f"Nature invalide: {nature}")

    dep = {
        "dependency_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        "source_project_id": source_pid,
        "target_project_id": target_pid,
        "source_milestone_id": data.get("source_milestone_id"),
        "target_milestone_id": data.get("target_milestone_id"),
        "nature": nature,
        "description": data.get("description", ""),
        "target_date": data.get("target_date"),
        "status": data.get("status", "identified"),
        "impact": data.get("impact", "medium"),
        "direction": data.get("direction", "outbound"),
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.project_dependencies.insert_one(dep)
    dep.pop("_id", None)
    return dep


async def update_dependency(dep_id: str, data: dict, current_user: TokenPayload) -> dict:
    existing = await db.project_dependencies.find_one(
        {"dependency_id": dep_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Dépendance introuvable")

    nature = data.get("nature", existing.get("nature"))
    if nature not in VALID_NATURES:
        raise HTTPException(status_code=400, detail=f"Nature invalide: {nature}")

    updates = {
        "source_milestone_id": data.get("source_milestone_id", existing.get("source_milestone_id")),
        "target_milestone_id": data.get("target_milestone_id", existing.get("target_milestone_id")),
        "nature": nature,
        "description": data.get("description", existing.get("description", "")),
        "target_date": data.get("target_date", existing.get("target_date")),
        "status": data.get("status", existing.get("status", "identified")),
        "impact": data.get("impact", existing.get("impact", "medium")),
        "direction": data.get("direction", existing.get("direction", "outbound")),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.project_dependencies.update_one({"dependency_id": dep_id}, {"$set": updates})
    return {**existing, **updates}


async def delete_dependency(dep_id: str, current_user: TokenPayload) -> dict:
    existing = await db.project_dependencies.find_one(
        {"dependency_id": dep_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Dépendance introuvable")
    await db.project_dependencies.delete_one({"dependency_id": dep_id})
    return {"deleted": True, "dependency_id": dep_id}
