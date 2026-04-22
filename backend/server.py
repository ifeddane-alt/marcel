from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import logging
import os
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)

from core.database import client
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

app = FastAPI(title="Projetenne API")

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
]:
    app.include_router(_router, prefix="/api")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
