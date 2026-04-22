from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from typing import Optional
from core.auth import TokenPayload, get_current_user
from core.tenant_config import require_module
from . import service

router = APIRouter(tags=["milestones"])

_compliance_dep = Depends(require_module("compliance"))


@router.get("/milestones")
async def list_milestones(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_milestones(project_id, current_user)


@router.get("/milestones/regulatory/kpis")
async def get_regulatory_kpis(
    current_user: TokenPayload = Depends(get_current_user),
    _m: TokenPayload = _compliance_dep,
):
    return await service.get_regulatory_kpis(current_user)


@router.get("/milestones/regulatory/csv", response_class=PlainTextResponse)
async def get_regulatory_csv(
    project_id: Optional[str] = None,
    milestone_type: Optional[str] = None,
    attribute: Optional[str] = None,
    program_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
    _m: TokenPayload = _compliance_dep,
):
    csv_data = await service.get_regulatory_csv(
        current_user,
        project_id=project_id, milestone_type=milestone_type,
        attribute=attribute, program_id=program_id,
    )
    return PlainTextResponse(
        content=csv_data,
        headers={"Content-Disposition": "attachment; filename=conformite_jalons.csv"},
    )


@router.get("/milestones/regulatory")
async def get_regulatory(
    project_id: Optional[str] = None,
    milestone_type: Optional[str] = None,
    attribute: Optional[str] = None,
    program_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_regulatory(
        current_user,
        project_id=project_id, milestone_type=milestone_type,
        attribute=attribute, program_id=program_id,
    )


@router.post("/milestones")
async def create_milestone(
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.create_milestone(data, current_user)


@router.put("/milestones/{milestone_id}")
async def update_milestone(
    milestone_id: str,
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.update_milestone(milestone_id, data, current_user)


@router.delete("/milestones/{milestone_id}")
async def delete_milestone(
    milestone_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.delete_milestone(milestone_id, current_user)
