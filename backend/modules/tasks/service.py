from fastapi import HTTPException
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write
from shared.rag import calculate_task_rag, _get_task_rag_settings
from .schemas import TaskCreate, TaskUpdate, PhaseTransition, PhaseEstimate

# 3d — Matrice de transitions valides (anti-rollback : terminal = done/rejected)
VALID_TRANSITIONS: dict = {
    "backlog":        ["review", "rejected"],
    "review":         ["analysis", "backlog", "rejected"],
    "analysis":       ["implementation", "review", "rejected"],
    "implementation": ["test", "analysis", "rejected"],
    "test":           ["hypercare", "implementation", "rejected"],
    "hypercare":      ["done", "test"],
    "done":           [],   # terminal
    "rejected":       [],   # terminal
}
TERMINAL_PHASES = {"done", "rejected"}


def _can_reach(start: str, target: str, adj: dict, visited: set) -> bool:
    """DFS : est-ce que 'start' peut atteindre 'target' via les dépendances ?"""
    if start == target:
        return True
    if start in visited:
        return False
    visited.add(start)
    for neighbor in adj.get(start, []):
        if _can_reach(neighbor, target, adj, visited):
            return True
    return False


async def _check_cycle(task_id: str, new_deps: list, project_id: str) -> bool:
    """Retourne True si ajouter task_id → new_deps crée un cycle."""
    all_tasks = await db.tasks.find(
        {"project_id": project_id}, {"_id": 0, "task_id": 1, "dependencies": 1}
    ).to_list(None)
    adj = {t["task_id"]: t.get("dependencies") or [] for t in all_tasks}
    adj[task_id] = new_deps  # application hypothétique
    for dep in new_deps:
        if _can_reach(dep, task_id, adj, set()):
            return True
    return False


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
        # Assurer la compatibilité ascendante pour les champs SAFe
        task.setdefault("task_level", "task")
        task.setdefault("lifecycle_phase", "backlog")
        task.setdefault("phase_estimates", [])
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
    deps = data.dependencies or []
    if deps:
        new_id = str(uuid.uuid4())
        if await _check_cycle(new_id, deps, data.project_id):
            raise HTTPException(status_code=422, detail="Cycle de dépendance détecté")
    else:
        new_id = str(uuid.uuid4())
    task = {
        "task_id": new_id,
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.tasks.insert_one(task)
    task.pop("_id", None)
    return task


async def update_task(task_id: str, data: TaskUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    existing = await db.tasks.find_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "dependencies" in update_data and update_data["dependencies"]:
        project_id = existing.get("project_id", "")
        if await _check_cycle(task_id, update_data["dependencies"], project_id):
            raise HTTPException(status_code=422, detail="Cycle de dépendance détecté")
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


# ─── 3d — Transition de phase ────────────────────────────────────────────────

async def transition_task_phase(
    task_id: str, data: PhaseTransition, current_user: TokenPayload
) -> dict:
    require_write(current_user)
    task = await db.tasks.find_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")

    from_phase = task.get("lifecycle_phase", "backlog")
    to_phase = data.to_phase

    if from_phase in TERMINAL_PHASES:
        raise HTTPException(
            status_code=422,
            detail=f"Phase '{from_phase}' est terminale, aucune transition possible",
        )
    allowed = VALID_TRANSITIONS.get(from_phase, [])
    if to_phase not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"Transition '{from_phase}' → '{to_phase}' non autorisée. Transitions valides : {allowed}",
        )

    # Mettre à jour la tâche
    await db.tasks.update_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id},
        {"$set": {"lifecycle_phase": to_phase}},
    )

    # Enregistrer l'historique
    history_doc = {
        "history_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        "task_id": task_id,
        "from_phase": from_phase,
        "to_phase": to_phase,
        "changed_by": current_user.user_id,
        "changed_at": datetime.now(timezone.utc).isoformat(),
        "note": data.note,
    }
    await db.phase_history.insert_one(history_doc)
    history_doc.pop("_id", None)

    updated = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    updated.setdefault("task_level", "task")
    updated.setdefault("lifecycle_phase", "backlog")
    updated.setdefault("phase_estimates", [])
    return {"task": updated, "history_entry": history_doc}


async def get_phase_history(task_id: str, current_user: TokenPayload) -> list:
    task = await db.tasks.find_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id}, {"_id": 0, "task_id": 1}
    )
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    return await db.phase_history.find(
        {"task_id": task_id}, {"_id": 0}
    ).sort("changed_at", -1).to_list(None)


# ─── 3e — Estimations par phase ──────────────────────────────────────────────

async def update_phase_estimates(
    task_id: str, phase_estimates: List[PhaseEstimate], current_user: TokenPayload
) -> dict:
    require_write(current_user)
    task = await db.tasks.find_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id}, {"_id": 0, "task_id": 1}
    )
    if not task:
        raise HTTPException(status_code=404, detail="Tâche introuvable")
    estimates_data = [e.model_dump() for e in phase_estimates]
    await db.tasks.update_one(
        {"task_id": task_id, "tenant_id": current_user.tenant_id},
        {"$set": {"phase_estimates": estimates_data}},
    )
    updated = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    updated.setdefault("task_level", "task")
    updated.setdefault("lifecycle_phase", "backlog")
    updated.setdefault("phase_estimates", [])
    return updated
