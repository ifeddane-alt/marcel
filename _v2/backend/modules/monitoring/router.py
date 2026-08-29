"""Monitoring Router — MARCEL admin endpoint."""
from fastapi import APIRouter, Depends
from core.auth import TokenPayload, permission_required
from core.database import client, db

router = APIRouter(tags=["monitoring"])
_perm = permission_required("admin.config")


@router.get("/admin/monitoring")
async def get_monitoring_stats(user: TokenPayload = Depends(_perm)):
    """Retourne les statistiques de santé et de monitoring."""
    from server import _start_time, _error_counts
    import time

    # Test connexion MongoDB
    try:
        await client.admin.command("ping")
        db_ok = True
        db_message = "Connecté"
    except Exception as e:
        db_ok = False
        db_message = str(e)

    # Collections stats
    collections = {}
    try:
        for col in ["projects", "users", "tenants", "risks", "milestones", "timesheets"]:
            collections[col] = await db[col].count_documents({})
    except Exception:
        collections = {}

    uptime = int(time.time() - _start_time)

    # Disque (vue conteneur ≈ hôte via overlayfs)
    import shutil
    try:
        total, used, free = shutil.disk_usage("/")
        disk = {"total_gb": round(total / 1e9, 1), "used_pct": round(used / total * 100, 1),
                "free_gb": round(free / 1e9, 1), "alert": (used / total) > 0.90}
    except Exception:
        disk = {"error": "indisponible"}

    # Dernier backup (consigné en base par scripts/backup.sh)
    from datetime import datetime, timezone
    last_backup = await db.backup_status.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    backup_alert = True
    if last_backup and last_backup.get("created_at"):
        try:
            age_h = (datetime.now(timezone.utc) - datetime.fromisoformat(last_backup["created_at"])).total_seconds() / 3600
            last_backup["age_hours"] = round(age_h, 1)
            backup_alert = age_h > 36 or last_backup.get("result") != "success"
        except Exception:
            pass

    return {
        "status": "ok" if db_ok else "degraded",
        "uptime_seconds": uptime,
        "uptime_human": _fmt_uptime(uptime),
        "version": "1.1.0",
        "database": {
            "status": "ok" if db_ok else "error",
            "message": db_message,
        },
        "disk": disk,
        "last_backup": last_backup or {"info": "aucun statut de backup enregistré"},
        "backup_alert": backup_alert,
        "error_counts": dict(_error_counts),
        "collections": collections,
    }


def _fmt_uptime(seconds: int) -> str:
    days, rem = divmod(seconds, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, secs = divmod(rem, 60)
    if days:
        return f"{days}j {hours}h {minutes}m"
    if hours:
        return f"{hours}h {minutes}m"
    return f"{minutes}m {secs}s"
