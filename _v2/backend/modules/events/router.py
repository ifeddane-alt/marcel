"""Calendrier des instances — Router."""
from fastapi import APIRouter, Depends, Query
from core.auth import TokenPayload, permission_required
from . import service

router = APIRouter(tags=["events"])


@router.get("/events/types")
async def list_types(current_user: TokenPayload = Depends(permission_required("portfolio.view"))):
    return await service.list_types(current_user.tenant_id)


@router.post("/events/types/seed-defaults")
async def seed_defaults(current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.seed_defaults(current_user.tenant_id)


@router.post("/events/types")
async def create_type(data: dict, current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.create_type(data, current_user.tenant_id)


@router.put("/events/types/{type_id}")
async def update_type(type_id: str, data: dict, current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.update_type(type_id, data, current_user.tenant_id)


@router.delete("/events/types/{type_id}")
async def delete_type(type_id: str, current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.delete_type(type_id, current_user.tenant_id)


@router.post("/events/generate-plan")
async def generate_plan(data: dict, current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.generate_plan(int(data["year"]), current_user.tenant_id)


@router.get("/events")
async def list_events(
    year: int = Query(None), month: int = Query(None), level: str = Query(None),
    upcoming: bool = Query(False),
    current_user: TokenPayload = Depends(permission_required("portfolio.view")),
):
    return await service.list_events(current_user.tenant_id, year, month, level, upcoming)


@router.post("/events")
async def create_event(data: dict, current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.create_event(data, current_user.tenant_id)


@router.put("/events/{event_id}")
async def update_event(event_id: str, data: dict, current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.update_event(event_id, data, current_user.tenant_id)


@router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: TokenPayload = Depends(permission_required("governance.edit"))):
    return await service.delete_event(event_id, current_user.tenant_id)
