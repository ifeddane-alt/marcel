"""WebSocket manager + notification service."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import WebSocket
from core.database import db


# ── ConnectionManager ──────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, List[WebSocket]] = {}  # user_id → sockets

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self._connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        conns = self._connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: str, payload: dict):
        for ws in list(self._connections.get(user_id, [])):
            try:
                await ws.send_json(payload)
            except Exception:
                self.disconnect(ws, user_id)

    async def broadcast_tenant(self, tenant_id: str, payload: dict, db=None):
        """Envoie à tous les users connectés du tenant."""
        if db is None:
            return
        users = await db.users.find(
            {"tenant_id": tenant_id}, {"_id": 0, "user_id": 1}
        ).to_list(None)
        for u in users:
            await self.send_to_user(u["user_id"], payload)


manager = ConnectionManager()


# ── Helpers ────────────────────────────────────────────────────────────────
NOTIF_LABELS = {
    "scope_transmitted":     "Scope transmis",
    "timesheet_validated":   "Feuille de temps validée",
    "timesheet_rejected":    "Feuille de temps refusée",
    "recommendation_new":    "Nouvelle recommandation IA",
    "milestone_approaching": "Jalon imminent",
    "alert_triggered":       "Alerte seuil déclenchée",
    "decision_created":      "Nouvelle décision",
    "demand_status_changed": "Demande mise à jour",
}


async def create_notification(
    tenant_id: str,
    user_id: str,
    notif_type: str,
    message: str,
    metadata: Optional[dict] = None,
    push: bool = True,
) -> dict:
    """Persiste une notification et l'envoie en temps réel si connecté."""
    notif = {
        "notif_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "user_id": user_id,
        "type": notif_type,
        "label": NOTIF_LABELS.get(notif_type, notif_type),
        "message": message,
        "metadata": metadata or {},
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    await db.notifications.insert_one(notif)
    notif.pop("_id", None)
    notif["created_at"] = notif["created_at"].isoformat()

    if push:
        await manager.send_to_user(user_id, {"event": "notification", "data": notif})
    return notif


async def list_notifications(user_id: str, tenant_id: str, unread_only: bool = False) -> list:
    q = {"user_id": user_id, "tenant_id": tenant_id}
    if unread_only:
        q["read"] = False
    notifs = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)
    for n in notifs:
        if hasattr(n.get("created_at"), "isoformat"):
            n["created_at"] = n["created_at"].isoformat()
    return notifs


async def mark_read(notif_id: str, user_id: str, tenant_id: str) -> bool:
    res = await db.notifications.update_one(
        {"notif_id": notif_id, "user_id": user_id, "tenant_id": tenant_id},
        {"$set": {"read": True}},
    )
    return res.modified_count > 0


async def mark_all_read(user_id: str, tenant_id: str) -> int:
    res = await db.notifications.update_many(
        {"user_id": user_id, "tenant_id": tenant_id, "read": False},
        {"$set": {"read": True}},
    )
    return res.modified_count


async def unread_count(user_id: str, tenant_id: str) -> int:
    return await db.notifications.count_documents(
        {"user_id": user_id, "tenant_id": tenant_id, "read": False}
    )
