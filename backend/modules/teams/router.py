from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from .schemas import TeamCreate, TeamUpdate
from . import service

router = APIRouter(tags=["teams"])


@router.get("/teams")
async def list_teams(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_teams(current_user)


@router.post("/teams", status_code=201)
async def create_team(data: TeamCreate, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_team(data, current_user)


@router.put("/teams/{team_id}")
async def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_team(team_id, data, current_user)


@router.delete("/teams/{team_id}", status_code=204)
async def delete_team(team_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_team(team_id, current_user)
