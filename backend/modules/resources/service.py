from fastapi import HTTPException
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import ResourceCreate, ResourceUpdate


async def list_resources(current_user: TokenPayload) -> list:
    return await db.resources.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)


async def create_resource(data: ResourceCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    doc = {
        "resource_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.resources.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_resource(resource_id: str, data: ResourceUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    # Inclure les champs None explicitement pour permettre la mise à null
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    # Permettre la mise à null de validator_resource_id
    raw = data.model_dump()
    if "validator_resource_id" in raw:
        update_data["validator_resource_id"] = raw["validator_resource_id"]

    result = await db.resources.update_one(
        {"resource_id": resource_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    updated = await db.resources.find_one({"resource_id": resource_id}, {"_id": 0})
    return updated


async def delete_resource(resource_id: str, current_user: TokenPayload) -> None:
    require_write(current_user)
    result = await db.resources.delete_one(
        {"resource_id": resource_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
