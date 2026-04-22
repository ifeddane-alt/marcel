from fastapi import APIRouter, Depends
from typing import Optional
from core.auth import TokenPayload, get_current_user, permission_required
from core.tenant_config import require_module
from .schemas import (
    TrainCreate, TrainUpdate,
    PICreate, PIUpdate,
    SprintCreate, SprintUpdate,
    CapabilityCreate, CapabilityUpdate,
)
from . import service

router = APIRouter(tags=["safe"], dependencies=[Depends(require_module("safe"))])


# ─── Trains ──────────────────────────────────────────────────────────────────

@router.get("/safe/trains")
async def list_trains(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_trains(current_user)


@router.get("/safe/trains/{train_id}/overview")
async def get_train_overview(train_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_train_overview(train_id, current_user)


@router.get("/safe/trains/{train_id}")
async def get_train(train_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_train(train_id, current_user)


@router.post("/safe/trains", status_code=201)
async def create_train(
    data: TrainCreate,
    current_user: TokenPayload = Depends(permission_required("trains.create")),
):
    return await service.create_train(data, current_user)


@router.put("/safe/trains/{train_id}")
async def update_train(
    train_id: str,
    data: TrainUpdate,
    current_user: TokenPayload = Depends(permission_required("trains.edit")),
):
    return await service.update_train(train_id, data, current_user)


@router.delete("/safe/trains/{train_id}", status_code=204)
async def delete_train(
    train_id: str,
    current_user: TokenPayload = Depends(permission_required("trains.create")),
):
    await service.delete_train(train_id, current_user)


# ─── PIs ─────────────────────────────────────────────────────────────────────

@router.get("/safe/pis")
async def list_pis(
    train_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_pis(train_id, current_user)


@router.post("/safe/pis", status_code=201)
async def create_pi(
    data: PICreate,
    current_user: TokenPayload = Depends(permission_required("trains.create")),
):
    return await service.create_pi(data, current_user)


@router.put("/safe/pis/{pi_id}")
async def update_pi(
    pi_id: str,
    data: PIUpdate,
    current_user: TokenPayload = Depends(permission_required("trains.edit")),
):
    return await service.update_pi(pi_id, data, current_user)


@router.delete("/safe/pis/{pi_id}", status_code=204)
async def delete_pi(
    pi_id: str,
    current_user: TokenPayload = Depends(permission_required("trains.create")),
):
    await service.delete_pi(pi_id, current_user)


# ─── Sprints ─────────────────────────────────────────────────────────────────

@router.get("/safe/sprints")
async def list_sprints(
    pi_id: Optional[str] = None,
    train_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_sprints(pi_id, train_id, current_user)


@router.post("/safe/sprints", status_code=201)
async def create_sprint(
    data: SprintCreate,
    current_user: TokenPayload = Depends(permission_required("trains.edit")),
):
    return await service.create_sprint(data, current_user)


@router.put("/safe/sprints/{sprint_id}")
async def update_sprint(
    sprint_id: str,
    data: SprintUpdate,
    current_user: TokenPayload = Depends(permission_required("trains.edit")),
):
    return await service.update_sprint(sprint_id, data, current_user)


@router.delete("/safe/sprints/{sprint_id}", status_code=204)
async def delete_sprint(
    sprint_id: str,
    current_user: TokenPayload = Depends(permission_required("trains.edit")),
):
    await service.delete_sprint(sprint_id, current_user)


# ─── Capabilities ─────────────────────────────────────────────────────────────

@router.get("/safe/capabilities")
async def list_capabilities(
    train_id: Optional[str] = None,
    pi_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_capabilities(train_id, pi_id, current_user)


@router.post("/safe/capabilities", status_code=201)
async def create_capability(
    data: CapabilityCreate,
    current_user: TokenPayload = Depends(permission_required("capabilities.create")),
):
    return await service.create_capability(data, current_user)


@router.put("/safe/capabilities/{cap_id}")
async def update_capability(
    cap_id: str,
    data: CapabilityUpdate,
    current_user: TokenPayload = Depends(permission_required("capabilities.create")),
):
    return await service.update_capability(cap_id, data, current_user)


@router.delete("/safe/capabilities/{cap_id}", status_code=204)
async def delete_capability(
    cap_id: str,
    current_user: TokenPayload = Depends(permission_required("capabilities.create")),
):
    await service.delete_capability(cap_id, current_user)
