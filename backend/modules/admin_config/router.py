from fastapi import APIRouter, Depends
from core.auth import TokenPayload, permission_required
from .schemas import (
    ModulesUpdate, WorkflowsUpdate, EnumsUpdate,
    HolidaysUpdate, ThresholdsUpdate, PPTBrandingUpdate,
)
from . import service

router = APIRouter(tags=["admin_config"])

# ─── Permission : admin.config ────────────────────────────────────────────────

_perm = permission_required("admin.config")


# ─── Lecture config complète ──────────────────────────────────────────────────

@router.get("/admin/config")
async def get_config(current_user: TokenPayload = Depends(_perm)):
    return await service.get_config(current_user)


# ─── Mise à jour par section ──────────────────────────────────────────────────

@router.put("/admin/config/modules")
async def update_modules(data: ModulesUpdate, current_user: TokenPayload = Depends(_perm)):
    return await service.update_modules(data, current_user)


@router.put("/admin/config/workflows")
async def update_workflows(data: WorkflowsUpdate, current_user: TokenPayload = Depends(_perm)):
    return await service.update_workflows(data, current_user)


@router.put("/admin/config/enums")
async def update_enums(data: EnumsUpdate, current_user: TokenPayload = Depends(_perm)):
    return await service.update_enums(data, current_user)


@router.put("/admin/config/holidays")
async def update_holidays(data: HolidaysUpdate, current_user: TokenPayload = Depends(_perm)):
    return await service.update_holidays(data, current_user)


@router.put("/admin/config/thresholds")
async def update_thresholds(data: ThresholdsUpdate, current_user: TokenPayload = Depends(_perm)):
    return await service.update_thresholds(data, current_user)


@router.put("/admin/config/ppt-branding")
async def update_ppt_branding(data: PPTBrandingUpdate, current_user: TokenPayload = Depends(_perm)):
    return await service.update_ppt_branding(data, current_user)


# ─── Seed ─────────────────────────────────────────────────────────────────────

@router.post("/admin/config/seed", status_code=201)
async def seed_config(current_user: TokenPayload = Depends(_perm)):
    """Initialise la configuration tenant avec les valeurs par défaut Altair."""
    return await service.seed_tenant_config(current_user.tenant_id)
