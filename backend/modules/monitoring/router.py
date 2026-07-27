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

    return {
        "status": "ok" if db_ok else "degraded",
        "uptime_seconds": uptime,
        "uptime_human": _fmt_uptime(uptime),
        "version": "1.1.0",
        "database": {
            "status": "ok" if db_ok else "error",
            "message": db_message,
        },
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
