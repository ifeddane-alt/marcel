import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload

VALID_TYPES = ["copil", "coproj", "comex", "codir", "steering", "autre"]
VALID_STATUSES = ["planifie", "tenu", "annule"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_agenda(agenda: list) -> list:
    cleaned = []
    for item in agenda or []:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        cleaned.append({
            "item_id": item.get("item_id") or str(uuid.uuid4()),
            "title": title,
            "presenter": item.get("presenter") or "",
            "duration_min": int(item.get("duration_min") or 0),
        })
    return cleaned


async def list_governance(current_user: TokenPayload) -> list:
    return await db.governance.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).sort("date_scheduled", -1).to_list(None)


async def get_governance(governance_id: str, current_user: TokenPayload) -> dict:
    instance = await db.governance.find_one(
        {"governance_id": governance_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not instance:
        raise HTTPException(404, "Instance introuvable")
    return instance


async def create_governance(data: dict, current_user: TokenPayload) -> dict:
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(422, "Le nom de l'instance est obligatoire")
    gtype = data.get("type") or "copil"
    if gtype not in VALID_TYPES:
        raise HTTPException(422, f"Type d'instance invalide: {gtype}")
    if not data.get("date_scheduled"):
        raise HTTPException(422, "La date est obligatoire")
    status = data.get("status") or "planifie"
    if status not in VALID_STATUSES:
        raise HTTPException(422, f"Statut invalide: {status}")
    doc = {
        "governance_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        "name": name,
        "type": gtype,
        "date_scheduled": data["date_scheduled"],
        "status": status,
        "projects_scope": data.get("projects_scope") or [],
        "attendees": [a.strip() for a in (data.get("attendees") or []) if a and a.strip()],
        "agenda": _clean_agenda(data.get("agenda")),
        "minutes_notes": data.get("minutes_notes") or "",
        "sanity_check_status": "pending",
        "sanity_check_report": {},
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.governance.insert_one(doc)
    doc.pop("_id", None)
    from core.audit import log_audit
    await log_audit(current_user, "created", "governance", doc["governance_id"], name)
    return doc


async def update_governance(governance_id: str, data: dict, current_user: TokenPayload) -> dict:
    old = await db.governance.find_one(
        {"governance_id": governance_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not old:
        raise HTTPException(404, "Instance introuvable")
    updates = {}
    for field in ["name", "type", "date_scheduled", "status", "projects_scope", "attendees", "minutes_notes"]:
        if field in data and data[field] is not None:
            updates[field] = data[field]
    if "agenda" in data and data["agenda"] is not None:
        updates["agenda"] = _clean_agenda(data["agenda"])
    if "name" in updates and not (updates["name"] or "").strip():
        raise HTTPException(422, "Le nom de l'instance est obligatoire")
    if "type" in updates and updates["type"] not in VALID_TYPES:
        raise HTTPException(422, "Type d'instance invalide")
    if "status" in updates and updates["status"] not in VALID_STATUSES:
        raise HTTPException(422, "Statut invalide")
    updates["updated_at"] = _now()
    await db.governance.update_one(
        {"governance_id": governance_id, "tenant_id": current_user.tenant_id},
        {"$set": updates},
    )
    updated = await db.governance.find_one({"governance_id": governance_id}, {"_id": 0})
    from core.audit import log_audit, diff_changes
    changes = diff_changes(old, updates)
    if changes:
        await log_audit(current_user, "updated", "governance", governance_id, updated.get("name", ""), changes)
    return updated


async def delete_governance(governance_id: str, current_user: TokenPayload) -> None:
    old = await db.governance.find_one(
        {"governance_id": governance_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not old:
        raise HTTPException(404, "Instance introuvable")
    await db.governance.delete_one(
        {"governance_id": governance_id, "tenant_id": current_user.tenant_id}
    )
    await db.decisions.update_many(
        {"governance_id": governance_id, "tenant_id": current_user.tenant_id},
        {"$set": {"governance_id": None}},
    )
    from core.audit import log_audit
    await log_audit(current_user, "deleted", "governance", governance_id, old.get("name", ""))
