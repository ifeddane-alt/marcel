from fastapi import HTTPException
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write, require_admin
from .schemas import TeamCreate, TeamUpdate


async def list_teams(current_user: TokenPayload) -> list:
    teams = await db.teams.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    # Enrichir avec le nom du manager
    resource_ids = [t["manager_resource_id"] for t in teams if t.get("manager_resource_id")]
    if resource_ids:
        resources = await db.resources.find(
            {"resource_id": {"$in": resource_ids}}, {"_id": 0, "resource_id": 1, "name": 1}
        ).to_list(None)
        res_map = {r["resource_id"]: r["name"] for r in resources}
        for t in teams:
            t["manager_name"] = res_map.get(t.get("manager_resource_id", ""), None)
    else:
        for t in teams:
            t["manager_name"] = None
    return teams


async def create_team(data: TeamCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    doc = {
        "team_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.teams.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_team(team_id: str, data: TeamUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.teams.update_one(
        {"team_id": team_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Équipe introuvable")
    updated = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    return updated


async def delete_team(team_id: str, current_user: TokenPayload) -> None:
    require_admin(current_user)
    result = await db.teams.delete_one(
        {"team_id": team_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Équipe introuvable")
