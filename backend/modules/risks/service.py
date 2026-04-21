from fastapi import HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import RiskCreate, RiskUpdate


async def list_risks(project_id: Optional[str], current_user: TokenPayload) -> list:
    query: dict = {"tenant_id": current_user.tenant_id}
    if project_id:
        query["project_id"] = project_id
    return await db.risks.find(query, {"_id": 0}).sort("criticality", -1).to_list(None)


async def create_risk(data: RiskCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    project = await db.projects.find_one(
        {"project_id": data.project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "project_id": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    doc = {
        "risk_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "criticality": data.probability * data.impact,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.risks.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_risk(risk_id: str, data: RiskUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "probability" in update_data or "impact" in update_data:
        existing = await db.risks.find_one(
            {"risk_id": risk_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Risque introuvable")
        prob = update_data.get("probability", existing["probability"])
        imp = update_data.get("impact", existing["impact"])
        update_data["criticality"] = prob * imp
    result = await db.risks.update_one(
        {"risk_id": risk_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Risque introuvable")
    updated = await db.risks.find_one({"risk_id": risk_id}, {"_id": 0})
    return updated


async def delete_risk(risk_id: str, current_user: TokenPayload) -> None:
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    result = await db.risks.delete_one({"risk_id": risk_id, "tenant_id": current_user.tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Risque introuvable")
