import uuid
from datetime import datetime, timezone
from core.database import db

_EXCLUDED_FIELDS = {"updated_at", "created_at", "last_sync_at", "budget_revision_history", "password_hash", "benefits"}


def _fmt(v):
    if isinstance(v, (dict, list)):
        return "…"
    return v


def diff_changes(old: dict, new_data: dict) -> list:
    changes = []
    for k, v in new_data.items():
        if k in _EXCLUDED_FIELDS:
            continue
        if old.get(k) != v:
            changes.append({"field": k, "old": _fmt(old.get(k)), "new": _fmt(v)})
    return changes[:40]


async def log_audit(user, action: str, entity_type: str, entity_id: str, entity_name: str, changes: list | None = None) -> None:
    """Journal d'audit fire-and-safe : n'échoue jamais l'opération métier."""
    try:
        await db.audit_logs.insert_one({
            "audit_id": str(uuid.uuid4()),
            "tenant_id": user.tenant_id,
            "user_id": user.user_id,
            "user_name": user.name,
            "user_email": user.email,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entity_name": entity_name or "",
            "changes": changes or [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass
