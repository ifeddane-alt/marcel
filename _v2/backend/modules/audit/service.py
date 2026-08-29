from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload


def _require_admin(user: TokenPayload) -> None:
    perms = user.permissions or []
    if "*" in perms or "admin.config" in perms or user.role == "TENANT_ADMIN":
        return
    raise HTTPException(status_code=403, detail="Droits administrateur requis")


async def list_audit_logs(
    user: TokenPayload,
    entity_type: str | None = None,
    action: str | None = None,
    q: str | None = None,
    limit: int = 50,
    skip: int = 0,
) -> dict:
    _require_admin(user)
    query: dict = {"tenant_id": user.tenant_id}
    if entity_type:
        query["entity_type"] = entity_type
    if action:
        query["action"] = action
    if q:
        query["$or"] = [
            {"entity_name": {"$regex": q, "$options": "i"}},
            {"user_name": {"$regex": q, "$options": "i"}},
            {"user_email": {"$regex": q, "$options": "i"}},
        ]
    total = await db.audit_logs.count_documents(query)
    items = (
        await db.audit_logs.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(max(skip, 0))
        .limit(min(max(limit, 1), 200))
        .to_list(None)
    )
    return {"items": items, "total": total}
