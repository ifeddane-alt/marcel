from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from .schemas import WorkAllocationCreate, WorkAllocationUpdate
from . import service

router = APIRouter(tags=["work_allocations"])


@router.get("/projects/{project_id}/work-allocations")
async def list_work_allocations(
    project_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_work_allocations(project_id, current_user)


@router.post("/work-allocations", status_code=201)
async def create_work_allocation(
    data: WorkAllocationCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.create_work_allocation(data, current_user)


@router.put("/work-allocations/{wa_id}")
async def update_work_allocation(
    wa_id: str,
    data: WorkAllocationUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_work_allocation(wa_id, data, current_user)


@router.delete("/work-allocations/{wa_id}", status_code=204)
async def delete_work_allocation(
    wa_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    await service.delete_work_allocation(wa_id, current_user)
