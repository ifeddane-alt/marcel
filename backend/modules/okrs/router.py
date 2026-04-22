from fastapi import APIRouter, Depends, Query
from typing import Optional
from core.auth import TokenPayload, get_current_user, permission_required
from .schemas import OKRCreate, OKRUpdate, WSJFUpdate
from . import service

router = APIRouter(tags=["okrs"])


# ─── OKR CRUD ─────────────────────────────────────────────────────────────────

@router.get("/okrs")
async def list_okrs(
    train_id: Optional[str] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_okrs(train_id, current_user)


@router.post("/okrs", status_code=201)
async def create_okr(
    data: OKRCreate,
    current_user: TokenPayload = Depends(permission_required("capabilities.create")),
):
    return await service.create_okr(data, current_user)


@router.put("/okrs/{okr_id}")
async def update_okr(
    okr_id: str,
    data: OKRUpdate,
    current_user: TokenPayload = Depends(permission_required("capabilities.create")),
):
    return await service.update_okr(okr_id, data, current_user)


@router.delete("/okrs/{okr_id}", status_code=204)
async def delete_okr(
    okr_id: str,
    current_user: TokenPayload = Depends(permission_required("capabilities.create")),
):
    await service.delete_okr(okr_id, current_user)


# ─── WSJF ─────────────────────────────────────────────────────────────────────

@router.put("/capabilities/{cap_id}/wsjf")
async def update_wsjf(
    cap_id: str,
    data: WSJFUpdate,
    current_user: TokenPayload = Depends(permission_required("capabilities.create")),
):
    return await service.update_wsjf_criteria(cap_id, data, current_user)


# ─── Dashboard Programme ──────────────────────────────────────────────────────

@router.get("/programme/dashboard")
async def programme_dashboard(
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_programme_dashboard(current_user)
