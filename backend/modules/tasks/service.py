from fastapi import HTTPException
from typing import Optional
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from shared.rag import calculate_task_rag, _get_task_rag_settings
from .schemas import TaskCreate, TaskUpdate


async def list_tasks(project_id: Optional[str], current_user: TokenPayload) -> list:
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


async def create_task(data: TaskCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
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


async def update_task(task_id: str, data: TaskUpdate, current_user: TokenPayload) -> dict:
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


async def delete_task(task_id: str, current_user: TokenPayload) -> None:
    require_write(current_user)
    result = await db.tasks.delete_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
