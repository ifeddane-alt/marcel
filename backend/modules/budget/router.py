"""Budget module — Router."""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
import io
from core.auth import TokenPayload, get_current_user, permission_required
from . import service

router = APIRouter(tags=["budget"])


@router.get("/budget/consolidated")
async def get_consolidated(
    program_id: str = Query(None),
    status: str = Query(None),
    current_user: TokenPayload = Depends(permission_required("budget.view")),
):
    return await service.get_consolidated(current_user, program_id=program_id, status=status)


@router.get("/budget/by-program")
async def get_by_program(
    current_user: TokenPayload = Depends(permission_required("budget.view")),
):
    return await service.get_by_program(current_user)


@router.get("/budget/project/{project_id}/revisions")
async def get_project_revisions(
    project_id: str,
    current_user: TokenPayload = Depends(permission_required("budget.view")),
):
    return await service.get_project_revisions(project_id, current_user)


@router.post("/budget/project/{project_id}/revise")
async def revise_budget(
    project_id: str,
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.revise_budget(project_id, data, current_user)


@router.get("/budget/export/excel")
async def export_excel(
    current_user: TokenPayload = Depends(permission_required("budget.view")),
):
    data = await service.export_excel(current_user)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=budget_portefeuille.xlsx"},
    )


@router.get("/budget/export/pdf")
async def export_pdf(
    current_user: TokenPayload = Depends(permission_required("budget.view")),
):
    data = await service.export_pdf(current_user)
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=synthese_budget.pdf"},
    )
