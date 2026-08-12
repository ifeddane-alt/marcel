from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["objectives"])


@router.get("/objectives")
async def list_objectives(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_objectives(current_user)


@router.get("/objectives/alignment")
async def get_alignment(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_alignment(current_user)


@router.post("/objectives", status_code=201)
async def create_objective(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_objective(data, current_user)


@router.put("/objectives/{objective_id}")
async def update_objective(objective_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_objective(objective_id, data, current_user)


@router.post("/objectives/{objective_id}/target-value")
async def update_target_value(objective_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_target_value(objective_id, data.get("value"), current_user)


@router.delete("/objectives/{objective_id}", status_code=204)
async def delete_objective(objective_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_objective(objective_id, current_user)


@router.put("/objectives/{objective_id}/projects")
async def set_objective_projects(objective_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.set_objective_projects(objective_id, data.get("project_ids") or [], current_user)
