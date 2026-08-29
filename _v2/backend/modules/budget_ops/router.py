"""Transferts budgétaires & enveloppes stratégiques — Router."""
from fastapi import APIRouter, Depends, HTTPException, Query
from core.auth import TokenPayload, permission_required
from . import service

router = APIRouter(tags=["budget_ops"])


@router.post("/budget/transfers")
async def create_transfer(data: dict, current_user: TokenPayload = Depends(permission_required("budget.edit"))):
    result = await service.create_transfer(data, current_user)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/budget/transfers")
async def list_transfers(current_user: TokenPayload = Depends(permission_required("budget.view"))):
    return await service.list_transfers(current_user.tenant_id)


@router.get("/budget/themes")
async def list_themes(current_user: TokenPayload = Depends(permission_required("budget.view"))):
    return await service.list_themes(current_user.tenant_id)


@router.post("/budget/themes")
async def create_theme(data: dict, current_user: TokenPayload = Depends(permission_required("budget.set_envelope"))):
    return await service.create_theme(data, current_user.tenant_id)


@router.delete("/budget/themes/{theme_id}")
async def delete_theme(theme_id: str, current_user: TokenPayload = Depends(permission_required("budget.set_envelope"))):
    return await service.delete_theme(theme_id, current_user.tenant_id)


@router.get("/budget/envelopes")
async def list_envelopes(year: int = Query(...), current_user: TokenPayload = Depends(permission_required("budget.view"))):
    return await service.list_envelopes(current_user.tenant_id, year)


@router.post("/budget/envelopes")
async def upsert_envelope(data: dict, current_user: TokenPayload = Depends(permission_required("budget.set_envelope"))):
    return await service.upsert_envelope(data, current_user.tenant_id)


@router.delete("/budget/envelopes/{envelope_id}")
async def delete_envelope(envelope_id: str, current_user: TokenPayload = Depends(permission_required("budget.set_envelope"))):
    return await service.delete_envelope(envelope_id, current_user.tenant_id)
