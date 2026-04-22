from fastapi import APIRouter, Depends, Query
from typing import Optional
from core.auth import TokenPayload, get_current_user, permission_required
from core.tenant_config import require_module
from . import service
from .schemas import DemandCreate, DemandUpdate, DemandTransitionRequest, ConvertToProjectRequest

router = APIRouter(tags=["demands"], dependencies=[Depends(require_module("demands"))])


@router.get("/demands")
async def list_demands(
    status: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_demands(current_user, status, urgency)


@router.post("/demands")
async def create_demand(
    data: DemandCreate,
    current_user: TokenPayload = Depends(permission_required("demands.submit")),
):
    return await service.create_demand(data, current_user)


@router.get("/demands/{demand_id}")
async def get_demand(
    demand_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_demand(demand_id, current_user)


@router.put("/demands/{demand_id}")
async def update_demand(
    demand_id: str,
    data: DemandUpdate,
    current_user: TokenPayload = Depends(permission_required("demands.qualify")),
):
    return await service.update_demand(demand_id, data, current_user)


@router.delete("/demands/{demand_id}")
async def delete_demand(
    demand_id: str,
    current_user: TokenPayload = Depends(permission_required("demands.qualify")),
):
    return await service.delete_demand(demand_id, current_user)


@router.patch("/demands/{demand_id}/transition")
async def transition_demand(
    demand_id: str,
    data: DemandTransitionRequest,
    current_user: TokenPayload = Depends(permission_required("demands.qualify")),
):
    return await service.transition_demand(demand_id, data, current_user)


@router.post("/demands/{demand_id}/convert")
async def convert_to_project(
    demand_id: str,
    data: ConvertToProjectRequest,
    current_user: TokenPayload = Depends(permission_required("demands.convert")),
):
    return await service.convert_to_project(demand_id, data, current_user)


@router.post("/demands/seed")
async def seed_demands(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.seed_demo_demands(current_user.tenant_id)
