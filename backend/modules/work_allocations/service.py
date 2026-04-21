from fastapi import HTTPException
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import WorkAllocationCreate, WorkAllocationUpdate


async def _enrich(wa: dict, res_map: dict) -> dict:
    """Calcule planned_cost et consumed_cost à la lecture."""
    resource = res_map.get(wa.get("resource_id", ""), {})
    tjm = resource.get("tjm_eur") or 0
    wa["planned_cost_eur"] = round(wa.get("planned_md", 0) * tjm, 2)
    wa["consumed_cost_eur"] = round(wa.get("consumed_md", 0) * tjm, 2)
    wa["resource_name"] = resource.get("name")
    wa["resource_role"] = resource.get("role")
    wa["tjm_eur"] = tjm
    return wa


async def _res_map(tenant_id: str) -> dict:
    resources = await db.resources.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1, "name": 1, "role": 1, "tjm_eur": 1, "team_id": 1, "team": 1},
    ).to_list(None)
    return {r["resource_id"]: r for r in resources}


async def list_work_allocations(project_id: str, current_user: TokenPayload) -> list:
    # Vérifier que le projet appartient au tenant
    proj = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    # Récupérer les task_ids du projet
    tasks = await db.tasks.find(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "task_id": 1},
    ).to_list(None)
    task_ids = [t["task_id"] for t in tasks]

    was = await db.work_allocations.find(
        {"task_id": {"$in": task_ids}}, {"_id": 0}
    ).to_list(None)

    res_map = await _res_map(current_user.tenant_id)
    return [await _enrich(wa, res_map) for wa in was]


async def create_work_allocation(data: WorkAllocationCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    # Vérifier que la task appartient au tenant
    task = await db.tasks.find_one(
        {"task_id": data.task_id, "tenant_id": current_user.tenant_id}
    )
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    # Vérifier que la ressource appartient au tenant
    resource = await db.resources.find_one(
        {"resource_id": data.resource_id, "tenant_id": current_user.tenant_id}
    )
    if not resource:
        raise HTTPException(status_code=404, detail="Ressource introuvable")

    doc = {
        "work_allocation_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.work_allocations.insert_one(doc)
    doc.pop("_id", None)
    res_map = {data.resource_id: resource}
    return await _enrich(doc, res_map)


async def update_work_allocation(wa_id: str, data: WorkAllocationUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.work_allocations.update_one(
        {"work_allocation_id": wa_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Allocation introuvable")
    updated = await db.work_allocations.find_one({"work_allocation_id": wa_id}, {"_id": 0})
    res_map = await _res_map(current_user.tenant_id)
    return await _enrich(updated, res_map)


async def delete_work_allocation(wa_id: str, current_user: TokenPayload) -> None:
    require_write(current_user)
    result = await db.work_allocations.delete_one(
        {"work_allocation_id": wa_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Allocation introuvable")
