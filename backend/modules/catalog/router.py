from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["indicator-catalog"])


@router.get("/indicator-catalog")
async def list_catalog(scope: str | None = None, current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_catalog(scope, current_user)


@router.get("/indicator-catalog/selections/{scope}")
async def get_selection(scope: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_selection(scope, current_user)


@router.put("/indicator-catalog/selections/{scope}")
async def set_selection(scope: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.set_selection(scope, data.get("indicator_ids") or [], current_user)


@router.post("/indicator-catalog/selections/{scope}/preset-p1")
async def preset_p1(scope: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.preset_p1(scope, current_user)


@router.get("/indicator-catalog/values/{scope}")
async def compute_values(scope: str, context_id: str | None = None,
                         current_user: TokenPayload = Depends(get_current_user)):
    return await service.compute_values(scope, context_id, current_user)
