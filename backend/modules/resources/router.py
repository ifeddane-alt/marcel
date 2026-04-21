from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from .schemas import ResourceCreate, ResourceUpdate
from . import service

router = APIRouter(tags=["resources"])


@router.get("/resources")
async def list_resources(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_resources(current_user)


@router.post("/resources", status_code=201)
async def create_resource(data: ResourceCreate, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_resource(data, current_user)


@router.put("/resources/{resource_id}")
async def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_resource(resource_id, data, current_user)


@router.delete("/resources/{resource_id}", status_code=204)
async def delete_resource(resource_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_resource(resource_id, current_user)
