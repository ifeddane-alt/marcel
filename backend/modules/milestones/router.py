from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["milestones"])


@router.get("/milestones")
async def list_milestones(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_milestones(project_id, current_user)


@router.post("/milestones")
async def create_milestone(
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.create_milestone(data, current_user)


@router.put("/milestones/{milestone_id}")
async def update_milestone(
    milestone_id: str,
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.update_milestone(milestone_id, data, current_user)


@router.delete("/milestones/{milestone_id}")
async def delete_milestone(
    milestone_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.delete_milestone(milestone_id, current_user)
