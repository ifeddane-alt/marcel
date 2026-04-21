from fastapi import HTTPException
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import ProgramCreate, ProgramUpdate


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


async def list_programs(current_user: TokenPayload) -> list:
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


async def get_program(program_id: str, current_user: TokenPayload) -> dict:
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


async def create_program(data: ProgramCreate, current_user: TokenPayload) -> dict:
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


async def update_program(program_id: str, data: ProgramUpdate, current_user: TokenPayload) -> dict:
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


async def delete_program(program_id: str, current_user: TokenPayload) -> None:
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
