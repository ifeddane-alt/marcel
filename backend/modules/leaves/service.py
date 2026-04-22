"""Service Congés & Absences — P1."""
import uuid
import calendar as cal
from datetime import datetime, timezone, date
from fastapi import HTTPException

from core.database import db
from core.auth import TokenPayload, require_write
from shared.holidays import get_holidays_for_dates, get_holidays_for_month, count_working_days
from .schemas import LeaveUpsert


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Upsert absence ──────────────────────────────────────────────────────────

async def upsert_leave(data: LeaveUpsert, current_user: TokenPayload) -> dict:
    require_write(current_user)

    # Valider la valeur
    if data.value not in (0.0, 0.5, 1.0):
        raise HTTPException(status_code=422, detail="Valeur invalide : 0, 0.5 ou 1 uniquement")

    # Vérifier que ce n'est pas un week-end
    d = date.fromisoformat(data.date)
    if d.weekday() >= 5:
        raise HTTPException(status_code=422, detail="Impossible de saisir une absence un week-end")

    # Si on efface l'absence (value = 0) → delete
    if data.value == 0.0:
        await db.leaves.delete_one({
            "resource_id": data.resource_id,
            "date": data.date,
            "tenant_id": current_user.tenant_id,
        })
        return {"deleted": True, "date": data.date}

    # Vérifier qu'il n'y a pas de timesheets soumis/validés ce jour-là
    # (uniquement si on passe à 1.0 = journée entière)
    if data.value == 1.0:
        conflicting_ts = await db.timesheets.find_one({
            "resource_id": data.resource_id,
            "date": data.date,
            "tenant_id": current_user.tenant_id,
            "jh_value": {"$gt": 0},
            "status": {"$in": ["submitted", "cp_reviewed", "validated"]},
        })
        if conflicting_ts:
            raise HTTPException(
                status_code=409,
                detail="Des temps soumis ou validés existent déjà pour ce jour. Rejetez-les d'abord.",
            )

    # Upsert dans la collection
    existing = await db.leaves.find_one({
        "resource_id": data.resource_id,
        "date": data.date,
        "tenant_id": current_user.tenant_id,
    }, {"_id": 0})

    now = _now()
    if existing:
        await db.leaves.update_one(
            {"leave_id": existing["leave_id"]},
            {"$set": {"value": data.value, "updated_at": now}},
        )
        return {**existing, "value": data.value, "updated_at": now}

    doc = {
        "leave_id":   str(uuid.uuid4()),
        "tenant_id":  current_user.tenant_id,
        "resource_id": data.resource_id,
        "date":        data.date,
        "value":       data.value,
        "created_at":  now,
        "created_by":  current_user.user_id,
    }
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ─── Calendrier mensuel ───────────────────────────────────────────────────────

async def get_month_calendar(
    resource_id: str, month: str, current_user: TokenPayload
) -> dict:
    """
    Retourne les données du calendrier mensuel pour une ressource.
    month = "YYYY-MM"
    """
    year, mon = map(int, month.split("-"))
    last_day  = cal.monthrange(year, mon)[1]
    all_dates = [f"{year}-{mon:02d}-{d:02d}" for d in range(1, last_day + 1)]

    # Absences de la ressource sur le mois
    leaves_docs = await db.leaves.find(
        {
            "resource_id": resource_id,
            "date": {"$gte": all_dates[0], "$lte": all_dates[-1]},
            "tenant_id": current_user.tenant_id,
        },
        {"_id": 0},
    ).to_list(None)
    leaves_map = {doc["date"]: doc["value"] for doc in leaves_docs}

    # Jours fériés FR + MA
    holidays_map = get_holidays_for_month(year, mon)

    # Construire la liste de jours
    days = []
    for d in all_dates:
        dt = date.fromisoformat(d)
        is_weekend  = dt.weekday() >= 5
        hols        = holidays_map.get(d, [])
        absence_val = leaves_map.get(d, 0.0) if not is_weekend and not hols else 0.0
        days.append({
            "date":         d,
            "weekday":      dt.weekday(),       # 0=Lun … 6=Dim
            "is_weekend":   is_weekend,
            "holidays":     hols,               # [{name, country}]
            "is_holiday":   bool(hols),
            "absence_value": absence_val,       # 0 | 0.5 | 1.0
        })

    # Statistiques du mois — passer tous les jours non-weekend (count_working_days gère les fériés)
    working_dates = [dd["date"] for dd in days if not dd["is_weekend"]]
    stats = count_working_days(working_dates, leaves_map)

    return {
        "resource_id": resource_id,
        "month":       month,
        "days":        days,
        "stats":       stats,
    }


# ─── Absences pour une semaine (utilisé dans get_grid) ───────────────────────

async def get_week_leaves(
    resource_id: str, dates: list[str], tenant_id: str
) -> dict[str, float]:
    """Retourne {date: value} pour les dates fournies."""
    docs = await db.leaves.find(
        {
            "resource_id": resource_id,
            "date": {"$in": dates},
            "tenant_id": tenant_id,
        },
        {"_id": 0, "date": 1, "value": 1},
    ).to_list(None)
    return {d["date"]: d["value"] for d in docs}
