from fastapi import APIRouter, HTTPException, Depends
from core.auth import TokenPayload, get_current_user
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
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Droits TENANT_ADMIN requis")
    await db.tenants.update_one(
        {"tenant_id": current_user.tenant_id},
        {"$set": {"settings": settings}},
    )
    tenant = await db.tenants.find_one({"tenant_id": current_user.tenant_id}, {"_id": 0})
    return tenant.get("settings", {})
