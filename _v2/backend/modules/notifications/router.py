"""Router WebSocket + REST notifications."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from core.auth import TokenPayload, get_current_user, decode_token
from . import service

router = APIRouter(tags=["notifications"])


# ── WebSocket ──────────────────────────────────────────────────────────────
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    ws://host/api/ws?token=<jwt>
    Connecte l'utilisateur pour recevoir des notifications en temps réel.
    """
    try:
        payload = decode_token(token)
        user_id = payload.user_id
        tenant_id = payload.tenant_id
    except Exception:
        await websocket.close(code=4001)
        return

    await service.manager.connect(websocket, user_id)
    # Envoyer le compteur initial
    count = await service.unread_count(user_id, tenant_id)
    await websocket.send_json({"event": "init", "unread_count": count})

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"event": "pong"})
    except WebSocketDisconnect:
        service.manager.disconnect(websocket, user_id)


# ── REST ───────────────────────────────────────────────────────────────────
@router.get("/notifications")
async def list_notifications(
    unread_only: bool = False,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_notifications(current_user.user_id, current_user.tenant_id, unread_only)


@router.patch("/notifications/{notif_id}/read")
async def mark_read(
    notif_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    ok = await service.mark_read(notif_id, current_user.user_id, current_user.tenant_id)
    return {"ok": ok}


@router.post("/notifications/read-all")
async def mark_all_read(
    current_user: TokenPayload = Depends(get_current_user),
):
    count = await service.mark_all_read(current_user.user_id, current_user.tenant_id)
    return {"marked": count}


@router.get("/notifications/unread-count")
async def get_unread_count(
    current_user: TokenPayload = Depends(get_current_user),
):
    count = await service.unread_count(current_user.user_id, current_user.tenant_id)
    return {"count": count}
