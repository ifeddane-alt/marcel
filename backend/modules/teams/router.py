from fastapi import APIRouter, Depends, Query
from core.auth import TokenPayload, get_current_user, permission_required
from .schemas import TeamCreate, TeamUpdate
from . import service

router = APIRouter(tags=["teams"])


@router.get("/teams")
async def list_teams(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_teams(current_user)


@router.get("/teams/capacity-heatmap")
async def get_capacity_heatmap(
    months: int = Query(default=6, ge=1, le=24),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_capacity_heatmap(months, current_user)


@router.get("/teams/capacity-alerts")
async def get_capacity_alerts(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_capacity_alerts(current_user)


@router.get("/teams/{team_id}")
async def get_team_detail(team_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_team_detail(team_id, current_user)


@router.post("/teams", status_code=201)
async def create_team(
    data: TeamCreate,
    current_user: TokenPayload = Depends(permission_required("teams.create")),
):
    return await service.create_team(data, current_user)


@router.put("/teams/{team_id}")
async def update_team(
    team_id: str,
    data: TeamUpdate,
    current_user: TokenPayload = Depends(permission_required("teams.edit")),
):
    return await service.update_team(team_id, data, current_user)


@router.delete("/teams/{team_id}", status_code=204)
async def delete_team(
    team_id: str,
    current_user: TokenPayload = Depends(permission_required("teams.create")),
):
    await service.delete_team(team_id, current_user)
