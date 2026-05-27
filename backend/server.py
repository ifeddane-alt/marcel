from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import logging
import os
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from core.database import client, db
from modules.auth.router import router as auth_router
from modules.programs.router import router as programs_router
from modules.projects.router import router as projects_router
from modules.resources.router import router as resources_router
from modules.allocations.router import router as allocations_router
from modules.milestones.router import router as milestones_router
from modules.tasks.router import router as tasks_router
from modules.tenant.router import router as tenant_router
from modules.governance.router import router as governance_router
from modules.dashboard.router import router as dashboard_router
from modules.risks.router import router as risks_router
from modules.decisions.router import router as decisions_router
from modules.export.router import router as export_router
from modules.timesheets.router import router as timesheets_router
from modules.leaves.router import router as leaves_router
from modules.csv_import.router import router as csv_import_router
from modules.project_dependencies.router import router as project_dependencies_router
from modules.teams.router import router as teams_router
from modules.work_allocations.router import router as work_allocations_router
from modules.demands.router import router as demands_router
from modules.profiles.router import router as profiles_router
from modules.safe.router import router as safe_router
from modules.okrs.router import router as okrs_router
from modules.admin_config.router import router as admin_config_router
from modules.scope.router import router as scope_router
from modules.arbitrage.router import router as arbitrage_router
from modules.connectors.router import router as connectors_router
from modules.agent.router import router as agent_router
from modules.notifications.router import router as notifications_router
from modules.budget.router import router as budget_router
from modules.powerbi.router import router as powerbi_router
from modules.status_report.router import router as status_report_router
from modules.project_templates.router import router as project_templates_router
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="MARCEL API")

# ── Middleware sécurité HTTP headers ─────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"]         = "DENY"
        response.headers["X-Content-Type-Options"]  = "nosniff"
        response.headers["X-XSS-Protection"]        = "1; mode=block"
        response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"]      = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' https: wss:; "
            "frame-ancestors 'none';"
        )
        # HSTS activé uniquement si HTTPS
        if request.headers.get("x-forwarded-proto") == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

for _router in [
    auth_router, programs_router, projects_router, resources_router,
    allocations_router, milestones_router, tasks_router, tenant_router,
    governance_router, dashboard_router, risks_router, decisions_router,
    export_router, csv_import_router, teams_router, work_allocations_router,
    timesheets_router, project_dependencies_router, leaves_router,
    demands_router, profiles_router, safe_router, okrs_router, admin_config_router,
    scope_router,
    arbitrage_router,
    connectors_router,
    agent_router,
    notifications_router,
    budget_router,
    powerbi_router,
    status_report_router,
    project_templates_router,
]:
    app.include_router(_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


# ── APScheduler — syncs connecteurs ──────────────────────────────────────────
scheduler = AsyncIOScheduler()

async def _run_scheduled_sync(connector_type: str):
    """Exécute la sync d'un connecteur et log le résultat."""
    from modules.connectors import service as conn_svc
    import uuid
    from datetime import datetime, timezone
    logger.info(f"[Scheduler] Démarrage sync {connector_type}")
    log_id = str(uuid.uuid4())
    started_at = datetime.now(timezone.utc)
    try:
        # Récupère toutes les configs actives pour ce type de connecteur
        configs = await db.connector_configs.find(
            {"type": connector_type, "enabled": True}, {"_id": 0}
        ).to_list(None)
        for cfg in configs:
            tenant_id = cfg["tenant_id"]
            from types import SimpleNamespace
            fake_user = SimpleNamespace(tenant_id=tenant_id, user_id="scheduler")
            await conn_svc.trigger_sync(connector_type, fake_user)
        logger.info(f"[Scheduler] Sync {connector_type} terminée ({len(configs)} tenant(s))")
    except Exception as e:
        logger.error(f"[Scheduler] Erreur sync {connector_type}: {e}")


async def _schedule_connectors():
    """Lit les configs actives et programme les syncs APScheduler."""
    scheduler.remove_all_jobs()
    configs = await db.connector_configs.find(
        {"enabled": True, "sync_frequency": {"$ne": "manual"}}, {"_id": 0}
    ).to_list(None)
    seen = set()
    for cfg in configs:
        key = cfg["type"]
        if key in seen:
            continue
        seen.add(key)
        freq = cfg.get("sync_frequency", "daily")
        if freq == "hourly":
            scheduler.add_job(_run_scheduled_sync, "interval", hours=1, id=f"sync_{key}", args=[key], replace_existing=True)
            logger.info(f"[Scheduler] Planifié {key} toutes les heures")
        elif freq == "daily":
            scheduler.add_job(_run_scheduled_sync, CronTrigger(hour=2, minute=0), id=f"sync_{key}", args=[key], replace_existing=True)
            logger.info(f"[Scheduler] Planifié {key} chaque nuit à 02h00")


@app.on_event("startup")
async def startup_event():
    scheduler.start()
    await _schedule_connectors()
    logger.info("[Scheduler] APScheduler démarré")


@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)
    client.close()
