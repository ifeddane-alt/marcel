from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from typing import Optional

from core.auth import TokenPayload, get_current_user, permission_required
from .schemas import ScopeStatusPatch, SnapshotCreate, TransmitRequest
from . import service

router = APIRouter(tags=["scope"])


# ── 1. Candidats ──────────────────────────────────────────────────────────────

@router.get("/scope/candidates")
async def get_candidates(
    project_id: Optional[str] = Query(None),
    team_id:    Optional[str] = Query(None),
    resource_id:Optional[str] = Query(None),
    scope_status:Optional[str]= Query(None),
    search:     Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_candidates(
        tenant_id=current_user.tenant_id,
        project_id=project_id,
        team_id=team_id,
        resource_id=resource_id,
        scope_status=scope_status,
        search=search,
        start_date=start_date,
        end_date=end_date,
    )


# ── 2. Patch scope_status ─────────────────────────────────────────────────────

@router.patch("/scope/tasks/{task_id}/status")
async def patch_task_scope_status(
    task_id: str,
    data: ScopeStatusPatch,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.patch_scope_status(task_id, data.scope_status, current_user)


# ── 3. Capacité vs charge ─────────────────────────────────────────────────────

@router.get("/scope/capacity")
async def get_capacity_summary(
    project_id: Optional[str] = Query(None),
    team_id:    Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date:   Optional[str] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_capacity_summary(
        tenant_id=current_user.tenant_id,
        project_id=project_id,
        team_id=team_id,
        start_date=start_date,
        end_date=end_date,
    )


# ── 4. Snapshots ──────────────────────────────────────────────────────────────

@router.post("/scope/snapshots", status_code=201)
async def create_snapshot(
    data: SnapshotCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.create_snapshot(data, current_user)


@router.get("/scope/snapshots")
async def list_snapshots(
    project_id: Optional[str] = Query(None),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_snapshots(current_user, project_id)


@router.get("/scope/snapshots/{snapshot_id}")
async def get_snapshot(
    snapshot_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_snapshot(snapshot_id, current_user)


# ── 5. Transmission ───────────────────────────────────────────────────────────

@router.post("/scope/snapshots/{snapshot_id}/transmit")
async def transmit_snapshot(
    snapshot_id: str,
    request: TransmitRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.transmit_snapshot(snapshot_id, request, current_user)


# ── 6. Gantt depuis snapshot ──────────────────────────────────────────────────

@router.post("/scope/snapshots/{snapshot_id}/gantt-compute")
async def compute_gantt(
    snapshot_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.compute_gantt_from_snapshot(snapshot_id, current_user)
