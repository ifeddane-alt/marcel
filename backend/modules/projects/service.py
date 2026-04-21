from fastapi import HTTPException
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import ProjectCreate, ProjectUpdate, BudgetRevisionCreate


def _sync_budget_aggregates(data: dict) -> dict:
    """Auto-compute budget_total/consumed/forecast from CAPEX+OPEX when provided."""
    capex_p = data.get("capex_planned", 0) or 0
    opex_p = data.get("opex_planned", 0) or 0
    capex_c = data.get("capex_consumed", 0) or 0
    opex_c = data.get("opex_consumed", 0) or 0
    eac = data.get("eac")
    if capex_p + opex_p > 0:
        data["budget_total"] = capex_p + opex_p
        data["budget_consumed"] = capex_c + opex_c
        data["budget_forecast"] = eac if eac else (capex_p + opex_p)
    elif eac is not None:
        data["budget_forecast"] = eac
    return data


async def list_projects(current_user: TokenPayload) -> list:
    return await db.projects.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)


async def get_project(project_id: str, current_user: TokenPayload) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return project


async def create_project(data: ProjectCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    doc = data.model_dump()
    doc = _sync_budget_aggregates(doc)
    project = {
        "project_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **doc,
        "budget_revision_history": [],
        "last_sync_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.insert_one(project)
    project.pop("_id", None)
    return project


async def update_project(project_id: str, data: ProjectUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data = _sync_budget_aggregates(update_data)
    result = await db.projects.update_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated


async def add_budget_revision(
    project_id: str,
    data: BudgetRevisionCreate,
    current_user: TokenPayload,
) -> dict:
    require_write(current_user)
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    old_eac = project.get("eac") or project.get("budget_forecast") or project.get("budget_total", 0)
    revision_entry = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "old_eac": old_eac,
        "new_eac": data.eac,
        "reason": data.reason,
        "author": data.author or current_user.email,
    }

    set_fields: dict = {"eac": data.eac, "budget_forecast": data.eac}
    if data.capex_planned is not None:
        set_fields["capex_planned"] = data.capex_planned
    if data.opex_planned is not None:
        set_fields["opex_planned"] = data.opex_planned
    if data.capex_planned or data.opex_planned:
        set_fields["budget_total"] = (data.capex_planned or project.get("capex_planned", 0)) + \
                                     (data.opex_planned or project.get("opex_planned", 0))

    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": set_fields,
            "$push": {"budget_revision_history": revision_entry},
        },
    )
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated


async def delete_project(project_id: str, current_user: TokenPayload) -> None:
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    await db.tasks.delete_many({"project_id": project_id, "tenant_id": current_user.tenant_id})
    await db.milestones.delete_many({"project_id": project_id})
    await db.allocations.delete_many({"project_id": project_id})
    result = await db.projects.delete_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Projet introuvable")
