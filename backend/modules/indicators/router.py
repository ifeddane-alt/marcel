from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["indicators"])


@router.get("/indicators/portfolio")
async def get_portfolio(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_portfolio_indicators(current_user)


@router.get("/projects/{project_id}/indicators")
async def get_project_indicators(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_project_indicators(project_id, current_user)


@router.get("/projects/{project_id}/sprints")
async def list_sprints(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_sprints(project_id, current_user)


@router.post("/projects/{project_id}/sprints", status_code=201)
async def create_sprint(project_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_sprint(project_id, data, current_user)


@router.put("/indicators/sprints/{sprint_id}")
async def update_sprint(sprint_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_sprint(sprint_id, data, current_user)


@router.delete("/indicators/sprints/{sprint_id}", status_code=204)
async def delete_sprint(sprint_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_sprint(sprint_id, current_user)
