from fastapi import APIRouter, Depends, HTTPException

from core.auth import TokenPayload, get_current_user, permission_required
from core.database import db

router = APIRouter(tags=["tenant"])


@router.get("/tenant/settings")
async def get_tenant_settings(current_user: TokenPayload = Depends(get_current_user)):
    tenant = await db.tenants.find_one({"tenant_id": current_user.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    return tenant.get("settings", {})


@router.put("/tenant/settings")
async def update_tenant_settings(
    settings: dict,
    current_user: TokenPayload = Depends(permission_required("admin.config")),
):
    await db.tenants.update_one(
        {"tenant_id": current_user.tenant_id},
        {"$set": {"settings": settings}},
    )
    tenant = await db.tenants.find_one({"tenant_id": current_user.tenant_id}, {"_id": 0})
    return tenant.get("settings", {})
