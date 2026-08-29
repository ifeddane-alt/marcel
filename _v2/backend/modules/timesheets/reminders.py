"""Relances timesheets hebdomadaires — notification in-app + email (si Resend configuré)."""
import os
import logging
from datetime import date, timedelta
from core.database import db
from modules.notifications.service import create_notification
from core.email import send_email, is_email_enabled

logger = logging.getLogger(__name__)


async def run_timesheet_reminders():
    if os.environ.get("TIMESHEET_REMINDERS_ENABLED", "true").lower() != "true":
        return
    today = date.today()
    week_start = today - timedelta(days=today.weekday() + 7)
    week_end = week_start + timedelta(days=6)
    lo, hi = week_start.isoformat(), week_end.isoformat()
    label = f"semaine du {week_start.strftime('%d/%m')}"

    tenant_ids = await db.tenants.distinct("tenant_id")
    for tid in tenant_ids:
        users = await db.users.find(
            {"tenant_id": tid, "resource_id": {"$nin": [None, ""]}, "is_active": {"$ne": False}},
            {"_id": 0, "user_id": 1, "email": 1, "name": 1, "resource_id": 1},
        ).to_list(None)
        reminded = 0
        for u in users:
            submitted = await db.timesheets.count_documents({
                "tenant_id": tid, "resource_id": u["resource_id"],
                "date": {"$gte": lo, "$lte": hi},
                "status": {"$in": ["submitted", "cp_reviewed", "validated"]},
            })
            if submitted > 0:
                continue
            try:
                await create_notification(
                    tid, u["user_id"], "timesheet_reminder",
                    f"Rappel : votre feuille de temps de la {label} n'a pas été soumise.",
                )
                if is_email_enabled() and u.get("email"):
                    await send_email(
                        [u["email"]],
                        f"MARCEL — Rappel timesheet ({label})",
                        f"<p>Bonjour {u.get('name', '')},</p>"
                        f"<p>Votre feuille de temps de la {label} n'a pas encore été soumise dans MARCEL.</p>"
                        f"<p>— MARCEL</p>",
                    )
                reminded += 1
            except Exception as e:
                logger.error("[TSReminder] Échec pour %s : %s", u.get("email"), e)
        if reminded:
            logger.info("[TSReminder] %s : %d relance(s) envoyée(s)", tid, reminded)
