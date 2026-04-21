from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary")
async def dashboard_summary(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_summary(current_user)


@router.get("/dashboard/top-risks")
async def dashboard_top_risks(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_top_risks(current_user)


@router.get("/dashboard/heatmap-risks")
async def dashboard_heatmap_risks(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_heatmap_risks(current_user)
