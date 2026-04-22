from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user, permission_required
from .schemas import ProjectCreate, ProjectUpdate, BudgetRevisionCreate
from . import service

router = APIRouter(tags=["projects"])


@router.get("/projects")
async def list_projects(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_projects(current_user)


@router.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_project(project_id, current_user)


@router.post("/projects", status_code=201)
async def create_project(
    data: ProjectCreate,
    current_user: TokenPayload = Depends(permission_required("projects.create")),
):
    return await service.create_project(data, current_user)


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: TokenPayload = Depends(permission_required("projects.edit")),
):
    return await service.update_project(project_id, data, current_user)


@router.post("/projects/{project_id}/budget-revision")
async def add_budget_revision(
    project_id: str,
    data: BudgetRevisionCreate,
    current_user: TokenPayload = Depends(permission_required("budget.revise_eac")),
):
    return await service.add_budget_revision(project_id, data, current_user)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: TokenPayload = Depends(permission_required("projects.delete")),
):
    await service.delete_project(project_id, current_user)


@router.get("/projects/{project_id}/team-consumption")
async def get_team_consumption(
    project_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_team_consumption(project_id, current_user)


@router.get("/projects/{project_id}/raf")
async def get_raf(
    project_id: str,
    current_user: TokenPayload = Depends(permission_required("raf.view")),
):
    return await service.get_raf(project_id, current_user)
