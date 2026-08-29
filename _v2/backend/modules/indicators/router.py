from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user, permission_required
from . import service

router = APIRouter(tags=["indicators"])


@router.get("/indicators/portfolio")
async def get_portfolio(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_portfolio_indicators(current_user)


@router.get("/projects/{project_id}/indicators")
async def get_project_indicators(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_project_indicators(project_id, current_user)


@router.get("/projects/{project_id}/sprints")
async def list_sprints(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_sprints(project_id, current_user)


@router.post("/projects/{project_id}/sprints", status_code=201)
async def create_sprint(project_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_sprint(project_id, data, current_user)


@router.put("/indicators/sprints/{sprint_id}")
async def update_sprint(sprint_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_sprint(sprint_id, data, current_user)


@router.delete("/indicators/sprints/{sprint_id}", status_code=204)
async def delete_sprint(sprint_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_sprint(sprint_id, current_user)


@router.get("/indicators/thresholds")
async def get_thresholds(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_thresholds(current_user.tenant_id)


@router.put("/indicators/thresholds")
async def set_thresholds(data: dict, current_user: TokenPayload = Depends(permission_required("admin.config"))):
    return await service.set_thresholds(data, current_user)


@router.get("/portfolio/snapshots")
async def list_snapshots(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_snapshots(current_user)


@router.post("/portfolio/snapshots/run", status_code=201)
async def run_snapshot(current_user: TokenPayload = Depends(get_current_user)):
    from core.simple_crud import require_dsi_write
    require_dsi_write(current_user, "indicators.manage")
    return await service.run_snapshot(current_user.tenant_id)
