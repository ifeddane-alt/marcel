"""Router Project Templates."""
from fastapi import APIRouter, Depends
from typing import Optional
from fastapi import HTTPException

from core.auth import get_current_user, TokenPayload
from . import service

router = APIRouter(tags=["Project Templates"])


@router.get("/project-templates")
async def list_templates(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_templates(current_user)


@router.get("/project-templates/{template_id}")
async def get_template(template_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_template(template_id, current_user)


@router.post("/project-templates")
async def create_template(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_template(data, current_user)


@router.put("/project-templates/{template_id}")
async def update_template(template_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_template(template_id, data, current_user)


@router.delete("/project-templates/{template_id}")
async def delete_template(template_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_template(template_id, current_user)
    return {"ok": True}


@router.post("/project-templates/{template_id}/duplicate")
async def duplicate_template(template_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.duplicate_template(template_id, current_user)


@router.post("/projects/{project_id}/apply-template")
async def apply_template(
    project_id: str,
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    template_id = data.get("template_id")
    if not template_id:
        raise HTTPException(400, "template_id requis")
    selected_phases = data.get("selected_phases")
    return await service.apply_template(project_id, template_id, selected_phases, current_user)
