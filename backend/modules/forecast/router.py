"""Reforecast & budget cible — Router."""
from fastapi import APIRouter, Depends, Query
from core.auth import TokenPayload, permission_required
from . import service

router = APIRouter(tags=["forecast"])


@router.get("/forecast/quarters")
async def quarters(year: int = Query(...), current_user: TokenPayload = Depends(permission_required("budget.view"))):
    return await service.quarters_summary(year, current_user.tenant_id)


@router.post("/forecast/validate")
async def validate(data: dict, current_user: TokenPayload = Depends(permission_required("budget.edit"))):
    return await service.validate_reforecast(data, current_user)


@router.get("/forecast/levers")
async def levers(project_id: str = Query(None), current_user: TokenPayload = Depends(permission_required("budget.view"))):
    return await service.get_levers(current_user.tenant_id, project_id)


@router.post("/forecast/apply-cuts")
async def apply_cuts(data: dict, current_user: TokenPayload = Depends(permission_required("budget.edit"))):
    return await service.apply_cuts(data, current_user)


@router.get("/forecast/cuts")
async def list_cuts(current_user: TokenPayload = Depends(permission_required("budget.view"))):
    return await service.list_cuts(current_user.tenant_id)


@router.post("/forecast/cuts/{cut_id}/restore")
async def restore_cut(cut_id: str, current_user: TokenPayload = Depends(permission_required("budget.edit"))):
    return await service.restore_cut(cut_id, current_user)


@router.get("/forecast/scenarios")
async def list_scenarios(current_user: TokenPayload = Depends(permission_required("budget.view"))):
    return await service.list_scenarios(current_user.tenant_id)


@router.post("/forecast/scenarios", status_code=201)
async def save_scenario(data: dict, current_user: TokenPayload = Depends(permission_required("budget.edit"))):
    return await service.save_scenario(data, current_user)


@router.delete("/forecast/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(scenario_id: str, current_user: TokenPayload = Depends(permission_required("budget.edit"))):
    await service.delete_scenario(scenario_id, current_user)
