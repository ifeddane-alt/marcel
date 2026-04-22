from fastapi import APIRouter, Depends, Query
from core.auth import TokenPayload, get_current_user
from shared.holidays import get_holidays_for_month
from . import service
from .schemas import LeaveUpsert

router = APIRouter(tags=["leaves"])


@router.put("/leaves/entry")
async def upsert_leave(
    data: LeaveUpsert,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.upsert_leave(data, current_user)


@router.get("/leaves/month")
async def get_month_calendar(
    resource_id: str,
    month: str = Query(..., regex=r"^\d{4}-\d{2}$"),
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_month_calendar(resource_id, month, current_user)


@router.get("/holidays")
async def get_holidays(
    year: int = Query(...),
    month: int = Query(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    return get_holidays_for_month(year, month)
