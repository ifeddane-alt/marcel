from fastapi import APIRouter, Depends
from typing import Optional
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["allocations"])


@router.get("/allocations")
async def list_allocations(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_allocations(project_id, current_user)
