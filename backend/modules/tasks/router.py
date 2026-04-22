from fastapi import APIRouter, Depends
from typing import Optional, List
from core.auth import TokenPayload, get_current_user
from .schemas import TaskCreate, TaskUpdate, PhaseTransition, PhaseEstimate
from . import service

router = APIRouter(tags=["tasks"])


@router.get("/tasks")
async def list_tasks(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_tasks(project_id, current_user)


@router.post("/tasks", status_code=201)
async def create_task(data: TaskCreate, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_task(data, current_user)


@router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    data: TaskUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_task(task_id, data, current_user)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_task(task_id, current_user)


# 3d — Transitions de phase
@router.post("/tasks/{task_id}/transition")
async def transition_task_phase(
    task_id: str,
    data: PhaseTransition,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.transition_task_phase(task_id, data, current_user)


@router.get("/tasks/{task_id}/phase-history")
async def get_phase_history(
    task_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_phase_history(task_id, current_user)


# 3e — Estimations par phase
@router.put("/tasks/{task_id}/phase-estimates")
async def update_phase_estimates(
    task_id: str,
    phase_estimates: List[PhaseEstimate],
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_phase_estimates(task_id, phase_estimates, current_user)

