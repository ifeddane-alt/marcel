"""Console capacitaire — Router."""
from fastapi import APIRouter, Depends, Query
from core.auth import TokenPayload, permission_required
from . import service

router = APIRouter(tags=["capacity"])


@router.get("/capacity/console")
async def console(
    horizon: int = Query(3, ge=1, le=12), axis: str = Query("team"),
    current_user: TokenPayload = Depends(permission_required("resources.view")),
):
    return await service.console(current_user.tenant_id, horizon, axis if axis in ("team", "resource", "skill") else "team")
