from fastapi import APIRouter, Depends
from typing import Optional
from core.auth import TokenPayload, get_current_user
from .schemas import RiskCreate, RiskUpdate
from . import service

router = APIRouter(tags=["risks"])


@router.get("/risks")
async def list_risks(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_risks(project_id, current_user)


@router.post("/risks", status_code=201)
async def create_risk(data: RiskCreate, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_risk(data, current_user)


@router.put("/risks/{risk_id}")
async def update_risk(
    risk_id: str,
    data: RiskUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_risk(risk_id, data, current_user)


@router.delete("/risks/{risk_id}", status_code=204)
async def delete_risk(risk_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_risk(risk_id, current_user)
