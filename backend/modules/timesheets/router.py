from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from typing import Optional
from core.auth import TokenPayload, get_current_user
from . import service
from .schemas import (
    TimesheetEntryUpsert, TimesheetSubmitWeek,
    TimesheetValidateRequest, TimesheetRejectRequest,
)

router = APIRouter(tags=["timesheets"])


# S3-01
@router.get("/timesheets/grid")
async def get_grid(
    resource_id: str,
    week_start: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_grid(resource_id, week_start, current_user)


@router.put("/timesheets/entry")
async def upsert_entry(
    data: TimesheetEntryUpsert,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.upsert_entry(data, current_user)


@router.post("/timesheets/submit-week")
async def submit_week(
    data: TimesheetSubmitWeek,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.submit_week(data, current_user)


# S3-02 — Compteur badge (contextuel par rôle)
@router.get("/timesheets/pending-count")
async def get_pending_count(current_user: TokenPayload = Depends(get_current_user)):
    return {"count": await service.get_pending_count(current_user)}


# S3-02 — Vue validation multi-acteurs
# view = "valideur" | "cp" | "pmo"
@router.get("/timesheets/validation")
async def get_validation_view(
    view: str = Query("valideur", regex="^(valideur|cp|pmo)$"),
    week_start: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_validation_view(view, week_start, current_user)


@router.post("/timesheets/validate")
async def validate_timesheets(
    data: TimesheetValidateRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.validate_timesheets(data, current_user)


@router.post("/timesheets/reject")
async def reject_timesheets(
    data: TimesheetRejectRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.reject_timesheets(data, current_user)


# S3-04
@router.get("/timesheets/report")
async def get_report(
    dimension: str = "resource",
    start: str = Query(...),
    end: str = Query(...),
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_report(dimension, start, end, current_user, project_id, team_id)


@router.get("/timesheets/report/csv", response_class=PlainTextResponse)
async def get_report_csv(
    dimension: str = "resource",
    start: str = Query(...),
    end: str = Query(...),
    project_id: Optional[str] = None,
    team_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    csv_data = await service.get_report_csv(dimension, start, end, current_user, project_id, team_id)
    return PlainTextResponse(
        content=csv_data,
        headers={"Content-Disposition": "attachment; filename=timesheets_report.csv"},
    )
