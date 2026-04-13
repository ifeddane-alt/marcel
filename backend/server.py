from fastapi import FastAPI, APIRouter, HTTPException, Depends, Body, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import csv
import io
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
    # CAPEX / OPEX breakdown (budget_total auto-computed as sum)
    capex_planned: float = 0
    capex_consumed: float = 0
    opex_planned: float = 0
    opex_consumed: float = 0
    eac: Optional[float] = None          # Estimate At Completion (manual override)
    # Legacy flat fields kept for backward compat with portfolio/program aggregations
    budget_total: float = 0
    budget_consumed: float = 0
    budget_forecast: float = 0
    jh_planned: float
    jh_consumed: float = 0
    start_date: str
    end_date_baseline: str
    end_date_forecast: str
    end_date_actual: Optional[str] = None
    status: str = "actif"  # en_preparation | actif | en_pause | cloture | archive
    description: Optional[str] = None
    owner_id: Optional[str] = None
    program_id: Optional[str] = None
    source_id: Optional[str] = None
    source_tool: Optional[str] = None
    metadata: dict = {}


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    methodology: Optional[str] = None
    status_rag: Optional[str] = None
    status: Optional[str] = None
    capex_planned: Optional[float] = None
    capex_consumed: Optional[float] = None
    opex_planned: Optional[float] = None
    opex_consumed: Optional[float] = None
    eac: Optional[float] = None
    budget_total: Optional[float] = None
    budget_consumed: Optional[float] = None
    budget_forecast: Optional[float] = None
    jh_planned: Optional[float] = None
    jh_consumed: Optional[float] = None
    start_date: Optional[str] = None
    end_date_baseline: Optional[str] = None
    end_date_forecast: Optional[str] = None
    end_date_actual: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[str] = None
    program_id: Optional[str] = None


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


# ---------- PROGRAMS ----------

class ProgramCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget_keur: float = 0
    status: str = "active"  # active | on_hold | completed | cancelled


class ProgramUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget_keur: Optional[float] = None
    status: Optional[str] = None


def _aggregate_program_metrics(projects: list) -> dict:
    rag_order = {"red": 2, "orange": 1, "green": 0}
    budget_total = sum(p.get("budget_total", 0) for p in projects)
    budget_consumed = sum(p.get("budget_consumed", 0) for p in projects)
    budget_forecast = sum(p.get("budget_forecast", 0) for p in projects)
    rag_counts = {"green": 0, "orange": 0, "red": 0}
    for p in projects:
        k = p.get("status_rag", "green")
        rag_counts[k] = rag_counts.get(k, 0) + 1
    rag_consolidated = max(
        (p.get("status_rag", "green") for p in projects),
        key=lambda r: rag_order.get(r, 0),
        default="green",
    ) if projects else "green"
    return {
        "project_count": len(projects),
        "budget_total": budget_total,
        "budget_consumed": budget_consumed,
        "budget_forecast": budget_forecast,
        "budget_total_keur": round(budget_total / 1000, 0),
        "budget_consumed_keur": round(budget_consumed / 1000, 0),
        "rag_counts": rag_counts,
        "rag_consolidated": rag_consolidated,
        "consumption_pct": round(budget_consumed / budget_total * 100, 1) if budget_total else 0,
    }


@api_router.get("/programs")
async def list_programs(current_user: TokenPayload = Depends(get_current_user)):
    programs = await db.programs.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    all_projects = await db.projects.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    projects_by_program: dict = {}
    for p in all_projects:
        pid = p.get("program_id")
        if pid:
            projects_by_program.setdefault(pid, []).append(p)
    for prog in programs:
        prog.update(_aggregate_program_metrics(projects_by_program.get(prog["program_id"], [])))
    return programs


@api_router.get("/programs/{program_id}")
async def get_program(program_id: str, current_user: TokenPayload = Depends(get_current_user)):
    program = await db.programs.find_one(
        {"program_id": program_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not program:
        raise HTTPException(status_code=404, detail="Programme introuvable")
    projects = await db.projects.find(
        {"program_id": program_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    pids = [p["project_id"] for p in projects]
    milestones = await db.milestones.find(
        {"project_id": {"$in": pids}}, {"_id": 0}
    ).to_list(None) if pids else []
    program["projects"] = projects
    program["milestones"] = milestones
    program["metrics"] = _aggregate_program_metrics(projects)
    return program


@api_router.post("/programs", status_code=201)
async def create_program(data: ProgramCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    program = {
        "program_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.programs.insert_one(program)
    program.pop("_id", None)
    return program


@api_router.put("/programs/{program_id}")
async def update_program(
    program_id: str,
    data: ProgramUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.programs.update_one(
        {"program_id": program_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Programme introuvable")
    updated = await db.programs.find_one({"program_id": program_id}, {"_id": 0})
    return updated


@api_router.delete("/programs/{program_id}", status_code=204)
async def delete_program(
    program_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    await db.projects.update_many(
        {"program_id": program_id, "tenant_id": current_user.tenant_id},
        {"$unset": {"program_id": ""}},
    )
    result = await db.programs.delete_one(
        {"program_id": program_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Programme introuvable")


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


def _sync_budget_aggregates(data: dict) -> dict:
    """Auto-compute budget_total/consumed/forecast from CAPEX+OPEX when provided."""
    capex_p = data.get("capex_planned", 0) or 0
    opex_p = data.get("opex_planned", 0) or 0
    capex_c = data.get("capex_consumed", 0) or 0
    opex_c = data.get("opex_consumed", 0) or 0
    eac = data.get("eac")
    if capex_p + opex_p > 0:
        data["budget_total"] = capex_p + opex_p
        data["budget_consumed"] = capex_c + opex_c
        data["budget_forecast"] = eac if eac else (capex_p + opex_p)
    elif eac is not None:
        data["budget_forecast"] = eac
    return data


@api_router.post("/projects", status_code=201)
async def create_project(data: ProjectCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    doc = data.model_dump()
    doc = _sync_budget_aggregates(doc)
    project = {
        "project_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **doc,
        "budget_revision_history": [],
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
    update_data = _sync_budget_aggregates(update_data)
    result = await db.projects.update_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated


class BudgetRevisionCreate(BaseModel):
    capex_planned: Optional[float] = None
    opex_planned: Optional[float] = None
    eac: float
    reason: str
    author: Optional[str] = None


@api_router.post("/projects/{project_id}/budget-revision")
async def add_budget_revision(
    project_id: str,
    data: BudgetRevisionCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    old_eac = project.get("eac") or project.get("budget_forecast") or project.get("budget_total", 0)
    revision_entry = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "old_eac": old_eac,
        "new_eac": data.eac,
        "reason": data.reason,
        "author": data.author or current_user.email,
    }

    set_fields: dict = {"eac": data.eac, "budget_forecast": data.eac}
    if data.capex_planned is not None:
        set_fields["capex_planned"] = data.capex_planned
    if data.opex_planned is not None:
        set_fields["opex_planned"] = data.opex_planned
    if data.capex_planned or data.opex_planned:
        set_fields["budget_total"] = (data.capex_planned or project.get("capex_planned", 0)) + \
                                     (data.opex_planned or project.get("opex_planned", 0))

    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": set_fields,
            "$push": {"budget_revision_history": revision_entry},
        },
    )
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return updated


@api_router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    # Cascade: delete tasks and milestones belonging to this project
    await db.tasks.delete_many({"project_id": project_id, "tenant_id": current_user.tenant_id})
    await db.milestones.delete_many({"project_id": project_id})
    await db.allocations.delete_many({"project_id": project_id})
    result = await db.projects.delete_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Projet introuvable")


# ---------- RESOURCES ----------

@api_router.get("/resources")
async def list_resources(current_user: TokenPayload = Depends(get_current_user)):
    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    return resources


class ResourceCreate(BaseModel):
    name: str
    role: str
    team: Optional[str] = None
    capacity_jh_month: float = 15
    email: Optional[str] = None


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    team: Optional[str] = None
    capacity_jh_month: Optional[float] = None
    email: Optional[str] = None


@api_router.post("/resources", status_code=201)
async def create_resource(data: ResourceCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    doc = {
        "resource_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.resources.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/resources/{resource_id}")
async def update_resource(
    resource_id: str,
    data: ResourceUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    result = await db.resources.update_one(
        {"resource_id": resource_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    updated = await db.resources.find_one({"resource_id": resource_id}, {"_id": 0})
    return updated


@api_router.delete("/resources/{resource_id}", status_code=204)
async def delete_resource(
    resource_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    result = await db.resources.delete_one(
        {"resource_id": resource_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ressource introuvable")


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

# Status → assumed % completion when no explicit estimate provided
STATUS_PROGRESS = {
    "not_started": 0.0,
    "in_progress": 0.50,
    "completed": 1.0,
    "delayed": 0.45,   # conservative: slightly less than in_progress
    "cancelled": 1.0,
}


def calculate_task_rag(
    task: dict,
    budget_threshold_pct: float = 115.0,
    delay_threshold_days: int = 5,
    reference_date_str: Optional[str] = None,
) -> dict:
    """
    Compute budget_landing, jh_landing and task_rag (green/orange/red).
    All thresholds come from tenant settings.
    """
    status = task.get("status", "not_started")

    if status == "cancelled":
        return {
            "budget_landing": round(task.get("budget_consumed_k", 0), 1),
            "jh_landing": round(task.get("jh_consumed", 0), 1),
            "task_rag": "green",
            "rag_details": {"budget_ratio": 100.0, "jh_ratio": 100.0, "delay_days": 0},
        }

    pct = STATUS_PROGRESS.get(status, 0.5)

    budget_planned = task.get("budget_planned_k") or 0.0
    budget_consumed = task.get("budget_consumed_k") or 0.0
    budget_restant = task.get("budget_restant_estime")  # explicit estimate takes priority

    jh_planned = task.get("jh_planned") or 0.0
    jh_consumed = task.get("jh_consumed") or 0.0
    jh_restant = task.get("jh_restants_estimes")

    # Budget landing
    if budget_restant is not None:
        budget_landing = budget_consumed + budget_restant
    elif pct > 0:
        budget_landing = budget_consumed / pct
    else:
        budget_landing = budget_planned  # not_started → assume on track

    # JH landing
    if jh_restant is not None:
        jh_landing = jh_consumed + jh_restant
    elif pct > 0:
        jh_landing = jh_consumed / pct
    else:
        jh_landing = jh_planned

    # Date delay (compare against date_end_planned)
    delay_days = 0
    date_end_planned = task.get("date_end_planned")
    date_end_actual = task.get("date_end_actual")

    if date_end_planned:
        try:
            planned_dt = datetime.strptime(date_end_planned, "%Y-%m-%d")
            if date_end_actual:
                # Completed task: compare actual vs planned
                actual_dt = datetime.strptime(date_end_actual, "%Y-%m-%d")
                delay_days = (actual_dt - planned_dt).days
            elif status in ("in_progress", "delayed"):
                # Running task: compare reference_date (snapshot) vs planned
                if reference_date_str:
                    ref_dt = datetime.strptime(reference_date_str, "%Y-%m-%d")
                else:
                    ref_dt = datetime.now()
                delay_days = max(0, (ref_dt - planned_dt).days)
        except Exception:
            pass

    # Ratios vs planned
    budget_ratio = (budget_landing / budget_planned * 100) if budget_planned > 0 else 100.0
    jh_ratio = (jh_landing / jh_planned * 100) if jh_planned > 0 else 100.0

    def _rag(ratio: float, d: int) -> str:
        if ratio > budget_threshold_pct or d > delay_threshold_days:
            return "red"
        if ratio > 100.0 or 1 <= d <= delay_threshold_days:
            return "orange"
        return "green"

    budget_rag = _rag(budget_ratio, delay_days)
    jh_rag = "green" if jh_ratio <= 100.0 else ("red" if jh_ratio > budget_threshold_pct else "orange")

    rag_order = {"red": 2, "orange": 1, "green": 0}
    final_rag = max([budget_rag, jh_rag], key=lambda r: rag_order[r])

    return {
        "budget_landing": round(budget_landing, 1),
        "jh_landing": round(jh_landing, 1),
        "task_rag": final_rag,
        "rag_details": {
            "budget_ratio": round(budget_ratio, 1),
            "jh_ratio": round(jh_ratio, 1),
            "delay_days": delay_days,
        },
    }


class TaskCreate(BaseModel):
    project_id: str
    name: str
    type: str  # tâche | feature | epic | user_story
    status: str = "not_started"
    date_start_planned: Optional[str] = None
    date_end_planned: Optional[str] = None
    date_start_actual: Optional[str] = None
    date_end_actual: Optional[str] = None
    budget_planned_k: float = 0
    budget_consumed_k: float = 0
    budget_restant_estime: Optional[float] = None
    jh_planned: float = 0
    jh_consumed: float = 0
    jh_restants_estimes: Optional[float] = None
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
    budget_restant_estime: Optional[float] = None
    jh_planned: Optional[float] = None
    jh_consumed: Optional[float] = None
    jh_restants_estimes: Optional[float] = None
    resource_id: Optional[str] = None


async def _get_task_rag_settings(tenant_id: str) -> dict:
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
    settings = (tenant or {}).get("settings", {})
    tr = settings.get("task_rag", {})
    return {
        "budget_threshold_pct": float(tr.get("budget_threshold_pct", 115)),
        "delay_threshold_days": int(tr.get("delay_threshold_days", 5)),
        "reference_date": tr.get("reference_date"),  # None → use today
    }


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

    # Compute mini-RAG for each task using tenant thresholds
    rag_cfg = await _get_task_rag_settings(current_user.tenant_id)
    for task in tasks:
        computed = calculate_task_rag(
            task,
            budget_threshold_pct=rag_cfg["budget_threshold_pct"],
            delay_threshold_days=rag_cfg["delay_threshold_days"],
            reference_date_str=rag_cfg["reference_date"],
        )
        task.update(computed)

    return tasks


@api_router.post("/tasks", status_code=201)
async def create_task(data: TaskCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    # Validate project belongs to tenant
    proj = await db.projects.find_one(
        {"project_id": data.project_id, "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable ou accès refusé")
    task = {
        "task_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


@api_router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    result = await db.tasks.delete_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tâche introuvable")


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


# ---------- TENANT SETTINGS ----------

@api_router.get("/tenant/settings")
async def get_tenant_settings(current_user: TokenPayload = Depends(get_current_user)):
    tenant = await db.tenants.find_one({"tenant_id": current_user.tenant_id}, {"_id": 0})
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    return tenant.get("settings", {})


@api_router.put("/tenant/settings")
async def update_tenant_settings(
    settings: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Droits TENANT_ADMIN requis")
    await db.tenants.update_one(
        {"tenant_id": current_user.tenant_id},
        {"$set": {"settings": settings}},
    )
    tenant = await db.tenants.find_one({"tenant_id": current_user.tenant_id}, {"_id": 0})
    return tenant.get("settings", {})


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


# ---------- IMPORT CSV ----------

IMPORT_TEMPLATES = {
    "projects": {
        "fields": ["name", "methodology", "status_rag", "budget_total", "budget_consumed",
                   "budget_forecast", "jh_planned", "jh_consumed", "start_date",
                   "end_date_baseline", "end_date_forecast", "program_name", "source_id"],
        "required": ["name", "methodology", "status_rag", "budget_total", "budget_forecast",
                     "jh_planned", "start_date", "end_date_baseline", "end_date_forecast"],
        "sample": [["Projet Alpha","waterfall","green","500000","200000","480000","1000","400",
                    "2025-01-01","2025-12-31","2025-12-31","Mon Programme","PRJ-001"]],
    },
    "tasks": {
        "fields": ["project_name", "name", "type", "status", "date_start_planned",
                   "date_end_planned", "date_start_actual", "date_end_actual",
                   "budget_planned_k", "budget_consumed_k", "jh_planned", "jh_consumed",
                   "resource_name"],
        "required": ["project_name", "name", "type"],
        "sample": [["Projet Alpha","Cadrage stratégique","tâche","in_progress",
                    "2025-01-01","2025-03-31","2025-01-15","","100","40","200","80","Alice Dupont"]],
    },
    "resources": {
        "fields": ["name", "role", "capacity_jh_month", "team", "email"],
        "required": ["name", "role"],
        "sample": [["Alice Dupont","Chef de projet","15","Équipe Digital","alice@altair.fr"]],
    },
}

FIELD_ALIASES: dict = {
    "projects": {
        "name": ["name", "nom", "projet", "project", "titre", "title"],
        "methodology": ["methodology", "méthodologie", "methodo", "method", "methodologie"],
        "status_rag": ["status_rag", "rag", "statut_rag", "statut", "status"],
        "budget_total": ["budget_total", "budget", "montant_total", "cout_total", "cout"],
        "budget_consumed": ["budget_consumed", "consomme", "depense", "budget_consomme"],
        "budget_forecast": ["budget_forecast", "forecast", "eac", "estimation"],
        "jh_planned": ["jh_planned", "jh_prevus", "charge_prevue", "jh", "hommes_jours"],
        "jh_consumed": ["jh_consumed", "jh_consommes", "charge_reelle"],
        "start_date": ["start_date", "date_debut", "debut", "date_start"],
        "end_date_baseline": ["end_date_baseline", "date_fin_baseline", "fin_baseline", "baseline"],
        "end_date_forecast": ["end_date_forecast", "date_fin", "fin_prevue", "fin"],
        "program_name": ["program_name", "programme", "program"],
        "source_id": ["source_id", "id", "reference", "ref", "identifiant"],
    },
    "tasks": {
        "project_name": ["project_name", "projet", "project", "nom_projet"],
        "name": ["name", "nom", "titre", "tache", "task"],
        "type": ["type", "type_tache", "categorie"],
        "status": ["status", "statut", "etat"],
        "date_start_planned": ["date_start_planned", "debut_prevu", "date_debut"],
        "date_end_planned": ["date_end_planned", "fin_prevue", "date_fin"],
        "date_start_actual": ["date_start_actual", "debut_reel"],
        "date_end_actual": ["date_end_actual", "fin_reelle"],
        "budget_planned_k": ["budget_planned_k", "budget_prevu", "budget_k", "budget"],
        "budget_consumed_k": ["budget_consumed_k", "budget_consomme", "consomme_k"],
        "jh_planned": ["jh_planned", "jh_prevus", "jours_hommes"],
        "jh_consumed": ["jh_consumed", "jh_consommes"],
        "resource_name": ["resource_name", "responsable", "ressource", "owner"],
    },
    "resources": {
        "name": ["name", "nom", "prenom_nom"],
        "role": ["role", "poste", "fonction", "titre"],
        "capacity_jh_month": ["capacity_jh_month", "capacite", "dispo", "jh_mois"],
        "team": ["team", "equipe", "departement", "service"],
        "email": ["email", "mail", "adresse_email"],
    },
}

VALID_VALUES = {
    "projects": {
        "methodology": ["waterfall", "agile", "safe"],
        "status_rag": ["green", "orange", "red"],
    },
    "tasks": {
        "type": ["tâche", "feature", "epic", "user_story"],
        "status": ["not_started", "in_progress", "completed", "delayed", "cancelled"],
    },
}


def _auto_suggest_mapping(csv_cols: list, entity: str) -> dict:
    aliases = FIELD_ALIASES.get(entity, {})
    mapping: dict = {}
    used_fields: set = set()
    for col in csv_cols:
        col_lower = col.lower().strip().replace(" ", "_").replace("-", "_")
        for field, field_aliases in aliases.items():
            if field in used_fields:
                continue
            if col_lower in field_aliases or col.lower() in field_aliases:
                mapping[col] = field
                used_fields.add(field)
                break
        else:
            mapping[col] = ""  # unmapped
    return mapping


def _parse_csv_bytes(content: bytes) -> tuple[list, list]:
    """Returns (headers, rows) from CSV bytes, handles encoding."""
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = content.decode(enc)
            break
        except Exception:
            continue
    # Detect delimiter
    sample = text[:2048]
    delimiter = ";" if sample.count(";") > sample.count(",") else ","
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        return [], []
    headers = [h.strip() for h in rows[0]]
    data_rows = [[cell.strip() for cell in r] for r in rows[1:] if any(c.strip() for c in r)]
    return headers, data_rows


def _validate_row(row_dict: dict, entity: str, row_num: int) -> list:
    errors = []
    tpl = IMPORT_TEMPLATES.get(entity, {})
    for req_field in tpl.get("required", []):
        if not row_dict.get(req_field, "").strip():
            errors.append({"row": row_num, "field": req_field, "message": f"Champ requis manquant : {req_field}"})
    # Date validation
    date_fields = ["start_date", "end_date_baseline", "end_date_forecast",
                   "date_start_planned", "date_end_planned", "date_start_actual", "date_end_actual"]
    for df in date_fields:
        val = row_dict.get(df, "")
        if val:
            try:
                datetime.strptime(val, "%Y-%m-%d")
            except ValueError:
                errors.append({"row": row_num, "field": df, "message": f"Format date invalide '{val}' (attendu AAAA-MM-JJ)"})
    # Numeric validation
    numeric_fields = ["budget_total", "budget_consumed", "budget_forecast",
                      "jh_planned", "jh_consumed", "budget_planned_k", "budget_consumed_k", "capacity_jh_month"]
    for nf in numeric_fields:
        val = row_dict.get(nf, "")
        if val:
            try:
                float(val.replace(",", "."))
            except ValueError:
                errors.append({"row": row_num, "field": nf, "message": f"Valeur non numérique '{val}'"})
    # Enum validation
    for field, allowed in VALID_VALUES.get(entity, {}).items():
        val = row_dict.get(field, "")
        if val and val not in allowed:
            errors.append({"row": row_num, "field": field,
                           "message": f"Valeur invalide '{val}' (attendu : {', '.join(allowed)})"})
    return errors


@api_router.get("/import/template/{entity}")
async def download_template(entity: str, current_user: TokenPayload = Depends(get_current_user)):
    if entity not in IMPORT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Entité inconnue : {entity}")
    tpl = IMPORT_TEMPLATES[entity]
    output = io.StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(tpl["fields"])
    for sample_row in tpl["sample"]:
        writer.writerow(sample_row)
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=template_{entity}.csv"},
    )


@api_router.post("/import/preview")
async def import_preview(
    file: UploadFile = File(...),
    entity: str = Form(...),
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    if entity not in IMPORT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Entité inconnue : {entity}")
    content = await file.read()
    headers, rows = _parse_csv_bytes(content)
    if not headers:
        raise HTTPException(status_code=422, detail="Fichier CSV vide ou illisible")
    suggested_mapping = _auto_suggest_mapping(headers, entity)
    preview = []
    for i, row in enumerate(rows[:5]):
        row_dict = dict(zip(headers, row + [""] * max(0, len(headers) - len(row))))
        preview.append({"row_num": i + 1, "data": row_dict})
    return {
        "entity": entity,
        "columns": headers,
        "suggested_mapping": suggested_mapping,
        "entity_fields": IMPORT_TEMPLATES[entity]["fields"],
        "required_fields": IMPORT_TEMPLATES[entity]["required"],
        "preview_rows": preview,
        "total_rows": len(rows),
    }


@api_router.post("/import/commit")
async def import_commit(
    file: UploadFile = File(...),
    entity: str = Form(...),
    mapping: str = Form(...),  # JSON string: {csv_col: entity_field}
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    import json as _json
    if entity not in IMPORT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Entité inconnue : {entity}")
    try:
        col_mapping: dict = _json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=422, detail="Mapping JSON invalide")

    content = await file.read()
    headers, rows = _parse_csv_bytes(content)
    if not headers:
        raise HTTPException(status_code=422, detail="Fichier CSV vide ou illisible")

    created = 0
    skipped = 0
    errors = []

    # Pre-load lookups
    projects_lookup: dict = {}
    resources_lookup: dict = {}
    if entity == "tasks":
        projs = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"_id": 0, "project_id": 1, "name": 1}
        ).to_list(None)
        projects_lookup = {p["name"]: p["project_id"] for p in projs}
    if entity in ("tasks",):
        ress = await db.resources.find(
            {"tenant_id": current_user.tenant_id}, {"_id": 0, "resource_id": 1, "name": 1}
        ).to_list(None)
        resources_lookup = {r["name"]: r["resource_id"] for r in ress}
    programs_lookup: dict = {}
    if entity == "projects":
        progs = await db.programs.find(
            {"tenant_id": current_user.tenant_id}, {"_id": 0, "program_id": 1, "name": 1}
        ).to_list(None)
        programs_lookup = {p["name"]: p["program_id"] for p in progs}

    for row_num, row in enumerate(rows, start=1):
        raw = dict(zip(headers, row + [""] * max(0, len(headers) - len(row))))
        # Apply mapping
        mapped: dict = {}
        for csv_col, entity_field in col_mapping.items():
            if entity_field and entity_field.strip():
                mapped[entity_field] = raw.get(csv_col, "").strip()

        row_errors = _validate_row(mapped, entity, row_num)
        if row_errors:
            errors.extend(row_errors)
            skipped += 1
            continue

        try:
            if entity == "projects":
                program_id = programs_lookup.get(mapped.get("program_name", ""))
                doc = {
                    "project_id": str(uuid.uuid4()),
                    "tenant_id": current_user.tenant_id,
                    "name": mapped["name"],
                    "methodology": mapped["methodology"],
                    "status_rag": mapped["status_rag"],
                    "budget_total": float(mapped["budget_total"].replace(",", ".")),
                    "budget_consumed": float(mapped.get("budget_consumed", "0").replace(",", ".") or "0"),
                    "budget_forecast": float(mapped["budget_forecast"].replace(",", ".")),
                    "jh_planned": float(mapped["jh_planned"].replace(",", ".")),
                    "jh_consumed": float(mapped.get("jh_consumed", "0").replace(",", ".") or "0"),
                    "start_date": mapped["start_date"],
                    "end_date_baseline": mapped["end_date_baseline"],
                    "end_date_forecast": mapped["end_date_forecast"],
                    "source_id": mapped.get("source_id") or None,
                    "program_id": program_id,
                    "metadata": {},
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.projects.insert_one(doc)

            elif entity == "tasks":
                project_id = projects_lookup.get(mapped.get("project_name", ""))
                if not project_id:
                    errors.append({"row": row_num, "field": "project_name",
                                   "message": f"Projet introuvable : '{mapped.get('project_name')}'"})
                    skipped += 1
                    continue
                resource_id = resources_lookup.get(mapped.get("resource_name", ""))
                doc = {
                    "task_id": str(uuid.uuid4()),
                    "tenant_id": current_user.tenant_id,
                    "project_id": project_id,
                    "name": mapped["name"],
                    "type": mapped.get("type", "tâche"),
                    "status": mapped.get("status", "not_started"),
                    "date_start_planned": mapped.get("date_start_planned") or None,
                    "date_end_planned": mapped.get("date_end_planned") or None,
                    "date_start_actual": mapped.get("date_start_actual") or None,
                    "date_end_actual": mapped.get("date_end_actual") or None,
                    "budget_planned_k": float(mapped.get("budget_planned_k", "0").replace(",", ".") or "0"),
                    "budget_consumed_k": float(mapped.get("budget_consumed_k", "0").replace(",", ".") or "0"),
                    "jh_planned": float(mapped.get("jh_planned", "0").replace(",", ".") or "0"),
                    "jh_consumed": float(mapped.get("jh_consumed", "0").replace(",", ".") or "0"),
                    "resource_id": resource_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.tasks.insert_one(doc)

            elif entity == "resources":
                doc = {
                    "resource_id": str(uuid.uuid4()),
                    "tenant_id": current_user.tenant_id,
                    "name": mapped["name"],
                    "role": mapped.get("role", ""),
                    "capacity_jh_month": float(mapped.get("capacity_jh_month", "15").replace(",", ".") or "15"),
                    "team": mapped.get("team", ""),
                    "email": mapped.get("email", ""),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                await db.resources.insert_one(doc)

            doc.pop("_id", None)
            created += 1
        except Exception as e:
            errors.append({"row": row_num, "field": "—", "message": str(e)})
            skipped += 1

    return {
        "entity": entity,
        "total_rows": len(rows),
        "created": created,
        "skipped": skipped,
        "errors": errors[:50],  # cap to 50 errors in response
    }


# ---------- RISKS ----------

class RiskCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    category: str  # technique | budget | planning | ressource | externe | conformité
    probability: int    # 1-5
    impact: int         # 1-5
    status: str = "identifié"  # identifié | traité | clos | accepté
    mitigation_plan: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None


class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    probability: Optional[int] = None
    impact: Optional[int] = None
    status: Optional[str] = None
    mitigation_plan: Optional[str] = None
    owner: Optional[str] = None
    due_date: Optional[str] = None


@api_router.get("/risks")
async def list_risks(
    project_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    query: dict = {"tenant_id": current_user.tenant_id}
    if project_id:
        query["project_id"] = project_id
    risks = await db.risks.find(query, {"_id": 0}).sort("criticality", -1).to_list(None)
    return risks


@api_router.post("/risks", status_code=201)
async def create_risk(data: RiskCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    project = await db.projects.find_one(
        {"project_id": data.project_id, "tenant_id": current_user.tenant_id}, {"_id": 0, "project_id": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    doc = {
        "risk_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "criticality": data.probability * data.impact,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.risks.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/risks/{risk_id}")
async def update_risk(
    risk_id: str,
    data: RiskUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    # Recompute criticality when probability or impact changes
    if "probability" in update_data or "impact" in update_data:
        existing = await db.risks.find_one(
            {"risk_id": risk_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
        )
        if not existing:
            raise HTTPException(status_code=404, detail="Risque introuvable")
        prob = update_data.get("probability", existing["probability"])
        imp = update_data.get("impact", existing["impact"])
        update_data["criticality"] = prob * imp
    result = await db.risks.update_one(
        {"risk_id": risk_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Risque introuvable")
    updated = await db.risks.find_one({"risk_id": risk_id}, {"_id": 0})
    return updated


@api_router.delete("/risks/{risk_id}", status_code=204)
async def delete_risk(risk_id: str, current_user: TokenPayload = Depends(get_current_user)):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    result = await db.risks.delete_one({"risk_id": risk_id, "tenant_id": current_user.tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Risque introuvable")


@api_router.get("/dashboard/top-risks")
async def dashboard_top_risks(current_user: TokenPayload = Depends(get_current_user)):
    risks = await db.risks.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).sort("criticality", -1).to_list(None)
    project_ids = list({r["project_id"] for r in risks})
    projects = await db.projects.find(
        {"project_id": {"$in": project_ids}}, {"_id": 0, "project_id": 1, "name": 1}
    ).to_list(None)
    project_map = {p["project_id"]: p["name"] for p in projects}
    return [
        {**r, "project_name": project_map.get(r["project_id"], "—")}
        for r in risks[:10]
    ]


@api_router.get("/dashboard/heatmap-risks")
async def dashboard_heatmap_risks(current_user: TokenPayload = Depends(get_current_user)):
    risks = await db.risks.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).sort("criticality", -1).to_list(None)
    if not risks:
        return []
    project_ids = list({r["project_id"] for r in risks})
    projects = await db.projects.find(
        {"project_id": {"$in": project_ids}}, {"_id": 0, "project_id": 1, "name": 1, "program_id": 1}
    ).to_list(None)
    project_map = {p["project_id"]: {"name": p["name"], "program_id": p.get("program_id")} for p in projects}
    program_ids = list({p.get("program_id") for p in projects if p.get("program_id")})
    program_map: dict = {}
    if program_ids:
        progs = await db.programs.find(
            {"program_id": {"$in": program_ids}}, {"_id": 0, "program_id": 1, "name": 1}
        ).to_list(None)
        program_map = {p["program_id"]: p["name"] for p in progs}
    return [
        {
            **r,
            "project_name": project_map.get(r["project_id"], {}).get("name", "—"),
            "program_id": project_map.get(r["project_id"], {}).get("program_id"),
            "program_name": program_map.get(
                project_map.get(r["project_id"], {}).get("program_id") or ""
            ) or "—",
        }
        for r in risks
    ]


# ---------- DECISIONS ----------

class DecisionCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    category: str  # stratégique | périmètre | planning | budgétaire | technique | ressources | conformité | gouvernance
    status: str = "proposée"  # proposée | prise | en_cours | appliquée | reportée | annulée
    decision_date: Optional[str] = None
    due_date: Optional[str] = None
    owner: Optional[str] = None
    impact: Optional[str] = None
    governance_id: Optional[str] = None


class DecisionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    decision_date: Optional[str] = None
    due_date: Optional[str] = None
    owner: Optional[str] = None
    impact: Optional[str] = None
    governance_id: Optional[str] = None


@api_router.get("/decisions")
async def list_decisions(
    project_id: Optional[str] = None,
    governance_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    query: dict = {"tenant_id": current_user.tenant_id}
    if project_id:
        query["project_id"] = project_id
    if governance_id:
        query["governance_id"] = governance_id
    decisions = await db.decisions.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)
    return decisions


@api_router.post("/decisions", status_code=201)
async def create_decision(data: DecisionCreate, current_user: TokenPayload = Depends(get_current_user)):
    require_write(current_user)
    project = await db.projects.find_one(
        {"project_id": data.project_id, "tenant_id": current_user.tenant_id}, {"_id": 0, "project_id": 1}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    doc = {
        "decision_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.decisions.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/decisions/{decision_id}")
async def update_decision(
    decision_id: str,
    data: DecisionUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    require_write(current_user)
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucun champ à mettre à jour")
    result = await db.decisions.update_one(
        {"decision_id": decision_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Décision introuvable")
    updated = await db.decisions.find_one({"decision_id": decision_id}, {"_id": 0})
    return updated


@api_router.delete("/decisions/{decision_id}", status_code=204)
async def delete_decision(decision_id: str, current_user: TokenPayload = Depends(get_current_user)):
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    result = await db.decisions.delete_one({"decision_id": decision_id, "tenant_id": current_user.tenant_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Décision introuvable")


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
