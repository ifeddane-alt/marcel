from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import logging
import os
import time
from collections import Counter
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from core.limiter import limiter

# ── Compteurs de monitoring ───────────────────────────────────────────────────
_start_time: float = time.time()
_error_counts: Counter = Counter()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Sentry APM (optionnel — activé uniquement si SENTRY_DSN est défini) ──────
_sentry_dsn = os.environ.get("SENTRY_DSN", "").strip()
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0")),
        integrations=[
            StarletteIntegration(transaction_style="endpoint", failed_request_status_codes={*range(500, 599)}),
            FastApiIntegration(transaction_style="endpoint", failed_request_status_codes={*range(500, 599)}),
        ],
    )
    logger.info("[Sentry] APM initialisé (env=%s)", os.environ.get("SENTRY_ENVIRONMENT", "production"))

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
from modules.monitoring.router import router as monitoring_router
from modules.msproject.router import router as msproject_router
from modules.sso.router import router as sso_router
from modules.excel_io.router import router as excel_io_router
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI(title="MARCEL API")

# ── SlowAPI rate limiting ─────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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

# ── Error tracking middleware ─────────────────────────────────────────────────
class ErrorTrackingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if response.status_code >= 500:
            _error_counts["5xx"] += 1
        elif response.status_code == 429:
            _error_counts["429"] += 1
        return response

app.add_middleware(ErrorTrackingMiddleware)

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
    monitoring_router,
    msproject_router,
    sso_router,
    excel_io_router,
]:
    app.include_router(_router, prefix="/api")


@app.get("/api/health")
@app.get("/health")  # aussi accessible en direct (Docker health check, etc.)
async def health():
    from core.database import client as _client
    try:
        await _client.admin.command("ping")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    uptime = int(time.time() - _start_time)
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "version": "1.1.0",
        "uptime_seconds": uptime,
        "database": db_status,
        "error_counts": dict(_error_counts),
    }


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
    # Vérification de la licence on-premise
    try:
        from core.license import check_license_on_startup
        license_info = check_license_on_startup()
        logger.info(f"[Licence] Valide — Client: {license_info.get('customer')} — Expire: {license_info.get('expiry')}")
    except (EnvironmentError, ValueError) as e:
        logger.critical(f"[Licence] INVALIDE : {e}")
        # Ne pas bloquer en preview/dev, mais logger clairement
        if os.environ.get("SKIP_LICENSE_CHECK") != "true":
            import sys; sys.exit(1)

    scheduler.start()
    await _schedule_connectors()
    logger.info("[Scheduler] APScheduler démarré")
    # Synchroniser les permissions de profils pour tous les tenants existants
    try:
        from modules.profiles.service import seed_default_profiles
        tenant_ids = await db.tenants.distinct("tenant_id")
        for tid in tenant_ids:
            await seed_default_profiles(tid)
        logger.info(f"[Startup] Permissions profils synchronisées pour {len(tenant_ids)} tenant(s)")
    except Exception as e:
        logger.warning(f"[Startup] Synchro profils non critique : {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown(wait=False)
    client.close()
