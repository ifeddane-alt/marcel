from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["engagement"])


@router.get("/engagement/criteria/{from_phase}")
async def list_criteria(from_phase: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_criteria(from_phase, current_user)


@router.patch("/engagement/criteria/{criterion_id}")
async def update_criterion(criterion_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_criterion(criterion_id, data, current_user)


@router.post("/engagement/criteria")
async def create_criterion(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_criterion(data, current_user)


@router.delete("/engagement/criteria/{criterion_id}", status_code=204)
async def delete_criterion(criterion_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_criterion(criterion_id, current_user)


@router.post("/projects/{project_id}/engagement/attest")
async def attest(project_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.attest(project_id, data, current_user)


@router.get("/projects/{project_id}/engagement/readiness")
async def readiness(project_id: str, from_phase: str | None = None,
                    current_user: TokenPayload = Depends(get_current_user)):
    return await service.readiness(project_id, current_user, from_phase)
