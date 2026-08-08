from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from datetime import datetime
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["dashboard"])


class CxoPreferences(BaseModel):
    widgets: list[str]


class DashboardPreferences(BaseModel):
    widgets: list[str]
    layouts: dict | None = None


@router.get("/dashboard/extras")
async def dashboard_extras(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_extras(current_user)


@router.get("/dashboard/preferences")
async def get_dashboard_preferences(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_dashboard_preferences(current_user)


@router.put("/dashboard/preferences")
async def update_dashboard_preferences(data: DashboardPreferences, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_dashboard_preferences(data.widgets, data.layouts, current_user)


@router.get("/dashboard/cxo")
async def dashboard_cxo(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_cxo(current_user)


@router.get("/dashboard/cxo/preferences")
async def get_cxo_preferences(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_cxo_preferences(current_user)


@router.put("/dashboard/cxo/preferences")
async def update_cxo_preferences(data: CxoPreferences, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_cxo_preferences(data.widgets, current_user)


@router.get("/dashboard/summary")
async def dashboard_summary(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_summary(current_user)


@router.get("/dashboard/top-risks")
async def dashboard_top_risks(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_top_risks(current_user)


@router.get("/dashboard/heatmap-risks")
async def dashboard_heatmap_risks(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_heatmap_risks(current_user)


@router.get("/dashboard/export/pdf")
async def dashboard_export_pdf(current_user: TokenPayload = Depends(get_current_user)):
    from .pdf_export import export_dashboard_pdf
    data = await export_dashboard_pdf(current_user)
    filename = f"MARCEL_Rapport_COMEX_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
