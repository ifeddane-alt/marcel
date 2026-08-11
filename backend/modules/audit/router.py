from fastapi import APIRouter, Depends
from typing import Optional
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["audit"])


@router.get("/admin/audit-logs")
async def list_audit_logs(
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_audit_logs(current_user, entity_type, action, q, limit, skip)
