from fastapi import HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import DecisionCreate, DecisionUpdate


async def list_decisions(
    project_id: Optional[str],
    governance_id: Optional[str],
    current_user: TokenPayload,
) -> list:
    query: dict = {"tenant_id": current_user.tenant_id}
    if project_id:
        query["project_id"] = project_id
    if governance_id:
        query["governance_id"] = governance_id
    return await db.decisions.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)


async def create_decision(data: DecisionCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    project = await db.projects.find_one(
        {"project_id": data.project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "project_id": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    doc = {
        "decision_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.decisions.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_decision(decision_id: str, data: DecisionUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucun champ à mettre à jour")
    result = await db.decisions.update_one(
        {"decision_id": decision_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Décision introuvable")
    updated = await db.decisions.find_one({"decision_id": decision_id}, {"_id": 0})
    return updated


async def delete_decision(decision_id: str, current_user: TokenPayload) -> None:
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    result = await db.decisions.delete_one(
        {"decision_id": decision_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Décision introuvable")
