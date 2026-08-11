from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user, permission_required
from . import service

router = APIRouter(tags=["governance"])


@router.get("/governance")
async def list_governance(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_governance(current_user)


@router.post("/governance", status_code=201)
async def create_governance(
    data: dict,
    current_user: TokenPayload = Depends(permission_required("governance.edit")),
):
    return await service.create_governance(data, current_user)


@router.put("/governance/{governance_id}")
async def update_governance(
    governance_id: str,
    data: dict,
    current_user: TokenPayload = Depends(permission_required("governance.edit")),
):
    return await service.update_governance(governance_id, data, current_user)


@router.delete("/governance/{governance_id}", status_code=204)
async def delete_governance(
    governance_id: str,
    current_user: TokenPayload = Depends(permission_required("governance.edit")),
):
    await service.delete_governance(governance_id, current_user)
