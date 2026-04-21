import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload

VALID_FAMILIES = ["epic_lifecycle", "epic_milestone", "transversal"]

FAMILY_TYPES = {
    "epic_lifecycle": [
        "kick_off", "review", "epic_analysis", "general_design", "detailed_design",
        "development", "sit", "uat", "cut_over", "hypercare", "change_management",
    ],
    "epic_milestone": ["go_no_go", "contractual", "roll_out", "key_deliverable", "go_live"],
    "transversal": ["dependency", "regulatory", "decomm"],
}


async def list_milestones(project_id: Optional[str], current_user: TokenPayload) -> list:
    if project_id:
        proj = await db.projects.find_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id}
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Projet introuvable")
        return await db.milestones.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    else:
        projects = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"project_id": 1, "_id": 0}
        ).to_list(None)
        pids = [p["project_id"] for p in projects]
        return await db.milestones.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)


async def create_milestone(data: dict, current_user: TokenPayload) -> dict:
    project_id = data.get("project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id requis")
    proj = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    family = data.get("family")
    if family and family not in VALID_FAMILIES:
        raise HTTPException(status_code=400, detail=f"Famille invalide: {family}")

    milestone_type = data.get("type")
    if family and milestone_type and milestone_type not in FAMILY_TYPES.get(family, []):
        raise HTTPException(
            status_code=400,
            detail=f"Type '{milestone_type}' invalide pour la famille '{family}'",
        )

    attribute = data.get("attribute")
    if attribute and attribute not in ("critical", "strategic"):
        attribute = None
    if attribute and current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        attribute = None

    milestone = {
        "milestone_id": str(uuid.uuid4()),
        "project_id": project_id,
        "tenant_id": current_user.tenant_id,
        "name": (data.get("name") or "").strip(),
        "date_baseline": data.get("date_baseline"),
        "date_forecast": data.get("date_forecast"),
        "date_actual": data.get("date_actual"),
        "status": data.get("status", "planned"),
        "is_governance": bool(data.get("is_governance", False)),
        "family": family,
        "type": milestone_type,
        "attribute": attribute,
        "comment": (data.get("comment") or "")[:500],
        "owner_resource_id": data.get("owner_resource_id"),
        "deliverable": data.get("deliverable"),
        "is_blocking": bool(data.get("is_blocking", False)),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.user_id,
    }
    await db.milestones.insert_one(milestone)
    milestone.pop("_id", None)
    return milestone


async def update_milestone(milestone_id: str, data: dict, current_user: TokenPayload) -> dict:
    existing = await db.milestones.find_one({"milestone_id": milestone_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Jalon introuvable")
    proj = await db.projects.find_one(
        {"project_id": existing["project_id"], "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=403, detail="Accès refusé")

    family = data.get("family", existing.get("family"))
    milestone_type = data.get("type", existing.get("type"))

    if family and family not in VALID_FAMILIES:
        raise HTTPException(status_code=400, detail=f"Famille invalide: {family}")
    if family and milestone_type and milestone_type not in FAMILY_TYPES.get(family, []):
        raise HTTPException(
            status_code=400,
            detail=f"Type '{milestone_type}' invalide pour la famille '{family}'",
        )

    attribute = data.get("attribute", existing.get("attribute"))
    if attribute and attribute not in ("critical", "strategic"):
        attribute = None
    if attribute and current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        attribute = existing.get("attribute")

    updates = {
        "name": (data.get("name", existing.get("name", ""))).strip(),
        "date_baseline": data.get("date_baseline", existing.get("date_baseline")),
        "date_forecast": data.get("date_forecast", existing.get("date_forecast")),
        "date_actual": data.get("date_actual", existing.get("date_actual")),
        "status": data.get("status", existing.get("status", "planned")),
        "is_governance": bool(data.get("is_governance", existing.get("is_governance", False))),
        "family": family,
        "type": milestone_type,
        "attribute": attribute,
        "comment": (data.get("comment", existing.get("comment")) or "")[:500],
        "owner_resource_id": data.get("owner_resource_id", existing.get("owner_resource_id")),
        "deliverable": data.get("deliverable", existing.get("deliverable")),
        "is_blocking": bool(data.get("is_blocking", existing.get("is_blocking", False))),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.milestones.update_one({"milestone_id": milestone_id}, {"$set": updates})
    return {**existing, **updates}


async def delete_milestone(milestone_id: str, current_user: TokenPayload) -> dict:
    existing = await db.milestones.find_one({"milestone_id": milestone_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Jalon introuvable")
    proj = await db.projects.find_one(
        {"project_id": existing["project_id"], "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=403, detail="Accès refusé")
    await db.milestones.delete_one({"milestone_id": milestone_id})
    return {"deleted": True, "milestone_id": milestone_id}
