from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["pb"])


@router.get("/pb/sessions")
async def list_sessions(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_sessions(current_user)


@router.post("/pb/sessions", status_code=201)
async def create_session(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_session(data, current_user)


@router.get("/pb/sessions/{session_id}")
async def get_session(session_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_session(session_id, current_user)


@router.put("/pb/sessions/{session_id}")
async def update_session(session_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_session(session_id, data, current_user)


@router.delete("/pb/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_session(session_id, current_user)


@router.post("/pb/sessions/{session_id}/vote")
async def submit_vote(session_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.submit_vote(session_id, data.get("allocations") or {}, current_user)


@router.get("/pb/sessions/{session_id}/results")
async def get_results(session_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_results(session_id, current_user)
