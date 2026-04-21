from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["governance"])


@router.get("/governance")
async def list_governance(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_governance(current_user)
