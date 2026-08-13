from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["applications"])


@router.get("/applications")
async def list_applications(project_id: str = None, current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_applications(current_user, project_id)


@router.get("/applications/summary")
async def get_summary(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_summary(current_user)


@router.get("/applications/{application_id}")
async def get_application(application_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_application(application_id, current_user)


@router.post("/applications", status_code=201)
async def create_application(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_application(data, current_user)


@router.put("/applications/{application_id}")
async def update_application(application_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_application(application_id, data, current_user)


@router.delete("/applications/{application_id}", status_code=204)
async def delete_application(application_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_application(application_id, current_user)


@router.put("/applications/{application_id}/projects")
async def set_projects(application_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.set_projects(application_id, data.get("project_ids") or [], current_user)
