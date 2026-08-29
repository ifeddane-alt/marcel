from fastapi import APIRouter, Depends
from typing import Optional
from core.auth import TokenPayload, get_current_user
from .schemas import DecisionCreate, DecisionUpdate
from . import service

router = APIRouter(tags=["decisions"])


@router.get("/decisions")
async def list_decisions(
    project_id: Optional[str] = None,
    governance_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_decisions(project_id, governance_id, current_user)


@router.post("/decisions", status_code=201)
async def create_decision(data: DecisionCreate, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_decision(data, current_user)


@router.put("/decisions/{decision_id}")
async def update_decision(
    decision_id: str,
    data: DecisionUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_decision(decision_id, data, current_user)


@router.delete("/decisions/{decision_id}", status_code=204)
async def delete_decision(decision_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_decision(decision_id, current_user)
