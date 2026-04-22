from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user, permission_required
from .schemas import ResourceCreate, ResourceUpdate
from . import service

router = APIRouter(tags=["resources"])


@router.get("/resources")
async def list_resources(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_resources(current_user)


@router.post("/resources", status_code=201)
async def create_resource(
    data: ResourceCreate,
    current_user: TokenPayload = Depends(permission_required("resources.create")),
):
    return await service.create_resource(data, current_user)


@router.put("/resources/{resource_id}")
async def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    current_user: TokenPayload = Depends(permission_required("resources.edit")),
):
    return await service.update_resource(resource_id, data, current_user)


@router.delete("/resources/{resource_id}", status_code=204)
async def delete_resource(
    resource_id: str,
    current_user: TokenPayload = Depends(permission_required("resources.create")),
):
    await service.delete_resource(resource_id, current_user)


@router.get("/vendors/summary")
async def get_vendors_summary(
    current_user: TokenPayload = Depends(permission_required("vendors.view")),
):
    return await service.get_vendors_summary(current_user)


@router.get("/vendors/project/{project_id}")
async def get_project_external_costs(
    project_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_project_external_costs(project_id, current_user)
