from fastapi import FastAPI, APIRouter, HTTPException, Depends, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ.get('JWT_SECRET', 'projetenne-secret-key-2025')
JWT_ALGORITHM = 'HS256'

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Projetenne API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Auth utilities ----------

class TokenPayload(BaseModel):
    tenant_id: str
    user_id: str
    email: str
    role: str
    name: str


def create_token(payload: dict) -> str:
    data = {**payload, 'exp': datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**payload)
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")


def require_write(user: TokenPayload):
    if user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")


# ---------- Request models ----------

class LoginRequest(BaseModel):
    email: str
    password: str


class ProjectCreate(BaseModel):
    name: str
    methodology: str
    status_rag: str
    budget_total: float
    budget_consumed: float = 0
    budget_forecast: float
    jh_planned: float
    jh_consumed: float = 0
    start_date: str
    end_date_baseline: str
    end_date_forecast: str
    source_id: Optional[str] = None
    source_tool: Optional[str] = None
    metadata: dict = {}


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    methodology: Optional[str] = None
    status_rag: Optional[str] = None
    budget_total: Optional[float] = None
    budget_consumed: Optional[float] = None
    budget_forecast: Optional[float] = None
    jh_planned: Optional[float] = None
    jh_consumed: Optional[float] = None
    start_date: Optional[str] = None
    end_date_baseline: Optional[str] = None
    end_date_forecast: Optional[str] = None


# ---------- AUTH ----------

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    if not bcrypt.checkpw(req.password.encode(), user['password_hash'].encode()):
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    token = create_token({
        "tenant_id": user["tenant_id"],
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "name": user["name"],
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {k: user[k] for k in ("user_id", "email", "name", "role", "tenant_id")},
    }


@api_router.get("/auth/me")
async def get_me(current_user: TokenPayload = Depends(get_current_user)):
    return current_user.model_dump()


# ---------- PROJECTS ----------

@api_router.get("/projects")
async def list_projects(current_user: TokenPayload = Depends(get_current_user)):
    projects = await db.projects.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    return projects


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, current_user: TokenPayload = Depends(get_current_user)):
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return project


@api_router.post("/projects", status_code=201)
async def create_project(data: ProjectCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    project = {
        "project_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "last_sync_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.insert_one(project)
    project.pop("_id", None)
    return project


@api_router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.projects.update_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated


# ---------- RESOURCES ----------

@api_router.get("/resources")
async def list_resources(current_user: TokenPayload = Depends(get_current_user)):
    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    return resources


# ---------- ALLOCATIONS ----------

@api_router.get("/allocations")
async def list_allocations(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    if project_id:
        proj = await db.projects.find_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id}
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Projet introuvable")
        allocs = await db.allocations.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    else:
        projects = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"project_id": 1, "_id": 0}
        ).to_list(None)
        pids = [p["project_id"] for p in projects]
        allocs = await db.allocations.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)
    return allocs


# ---------- MILESTONES ----------

@api_router.get("/milestones")
async def list_milestones(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    if project_id:
        proj = await db.projects.find_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id}
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Projet introuvable")
        milestones = await db.milestones.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    else:
        projects = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"project_id": 1, "_id": 0}
        ).to_list(None)
        pids = [p["project_id"] for p in projects]
        milestones = await db.milestones.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)
    return milestones


# ---------- TASKS ----------

class TaskCreate(BaseModel):
    name: str
    type: str  # tâche | feature | epic | user_story
    status: str = "not_started"  # not_started | in_progress | completed | delayed | cancelled
    date_start_planned: Optional[str] = None
    date_end_planned: Optional[str] = None
    date_start_actual: Optional[str] = None
    date_end_actual: Optional[str] = None
    budget_planned_k: float = 0
    budget_consumed_k: float = 0
    jh_planned: float = 0
    jh_consumed: float = 0
    resource_id: Optional[str] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    status: Optional[str] = None
    date_start_planned: Optional[str] = None
    date_end_planned: Optional[str] = None
    date_start_actual: Optional[str] = None
    date_end_actual: Optional[str] = None
    budget_planned_k: Optional[float] = None
    budget_consumed_k: Optional[float] = None
    jh_planned: Optional[float] = None
    jh_consumed: Optional[float] = None
    resource_id: Optional[str] = None


@api_router.get("/tasks")
async def list_tasks(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    if project_id:
        proj = await db.projects.find_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id}
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Projet introuvable")
        tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    else:
        projects = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"project_id": 1, "_id": 0}
        ).to_list(None)
        pids = [p["project_id"] for p in projects]
        tasks = await db.tasks.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)
    return tasks


@api_router.post("/tasks", status_code=201)
async def create_task(data: TaskCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    # Validate project belongs to tenant (project_id must come from request body via metadata)
    task = {
        "task_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


@api_router.put("/tasks/{task_id}")
async def update_task(
    task_id: str,
    data: TaskUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.tasks.update_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    updated = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    return updated


# ---------- GOVERNANCE ----------

@api_router.get("/governance")
async def list_governance(current_user: TokenPayload = Depends(get_current_user)):
    instances = await db.governance.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    return instances


# ---------- DASHBOARD ----------

@api_router.get("/dashboard/summary")
async def dashboard_summary(current_user: TokenPayload = Depends(get_current_user)):
    projects = await db.projects.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)

    total = len(projects)
    green = sum(1 for p in projects if p.get("status_rag") == "green")
    orange = sum(1 for p in projects if p.get("status_rag") == "orange")
    red = sum(1 for p in projects if p.get("status_rag") == "red")

    total_budget = sum(p.get("budget_total", 0) for p in projects)
    total_consumed = sum(p.get("budget_consumed", 0) for p in projects)
    total_forecast = sum(p.get("budget_forecast", 0) for p in projects)
    total_jh_planned = sum(p.get("jh_planned", 0) for p in projects)
    total_jh_consumed = sum(p.get("jh_consumed", 0) for p in projects)

    methodology_counts = {
        "waterfall": sum(1 for p in projects if p.get("methodology") == "waterfall"),
        "agile": sum(1 for p in projects if p.get("methodology") == "agile"),
        "safe": sum(1 for p in projects if p.get("methodology") == "safe"),
    }

    return {
        "total_projects": total,
        "rag_counts": {"green": green, "orange": orange, "red": red},
        "budget": {
            "total": total_budget,
            "consumed": total_consumed,
            "forecast": total_forecast,
            "consumption_rate": round(total_consumed / total_budget * 100, 1) if total_budget else 0,
        },
        "jh": {"planned": total_jh_planned, "consumed": total_jh_consumed},
        "methodology_counts": methodology_counts,
        "recent_projects": projects[:5],
    }


# ---------- App setup ----------

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
