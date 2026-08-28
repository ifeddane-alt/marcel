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


async def log_audit(user, action: str, entity_type: str, entity_id: str, entity_name: str, changes: list | None = None, source_ip: str | None = None) -> None:
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
            "source_ip": source_ip,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass


async def log_auth_event(action: str, *, result: str, email: str = "",
                         tenant_id: str = "", user_id: str = "", source_ip: str = "?",
                         detail: str = "") -> None:
    """Journalise un événement d'authentification/sécurité (login, logout, révocation…).

    N'enregistre JAMAIS mot de passe / token / secret. Fire-and-safe.
    """
    try:
        await db.audit_logs.insert_one({
            "audit_id": str(uuid.uuid4()),
            "tenant_id": tenant_id or "",
            "user_id": user_id or "",
            "user_name": "",
            "user_email": email or "",
            "action": action,          # auth.login_success | auth.login_failed | auth.login_blocked | auth.sso_* | auth.logout | auth.perm_revoked
            "entity_type": "auth",
            "entity_id": user_id or "",
            "entity_name": email or "",
            "result": result,          # success | failure | blocked
            "source_ip": source_ip,
            "detail": detail,
            "changes": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        pass

