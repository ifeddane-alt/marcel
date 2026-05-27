"""Service Project Templates — CRUD + apply."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException
from core.auth import TokenPayload, has_perm
from core.database import db
from .templates_data import DEFAULT_TEMPLATES


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_default_templates(tenant_id: str):
    """Crée les 3 templates par défaut pour un tenant s'ils n'existent pas."""
    for tpl in DEFAULT_TEMPLATES:
        existing = await db.project_templates.find_one(
            {"tenant_id": tenant_id, "methodology": tpl["methodology"], "is_default": True}
        )
        if not existing:
            doc = {
                **tpl,
                "template_id": str(uuid.uuid4()),
                "tenant_id": tenant_id,
                "created_at": _now(),
                "updated_at": _now(),
            }
            await db.project_templates.insert_one(doc)


async def list_templates(user: TokenPayload) -> list:
    """Liste tous les templates du tenant."""
    await seed_default_templates(user.tenant_id)
    templates = await db.project_templates.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("is_default", -1).to_list(None)
    return templates


async def get_template(template_id: str, user: TokenPayload) -> dict:
    tpl = await db.project_templates.find_one(
        {"template_id": template_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not tpl:
        raise HTTPException(404, "Template introuvable")
    return tpl


async def create_template(data: dict, user: TokenPayload) -> dict:
    if not has_perm(user, "admin.templates"):
        raise HTTPException(403, "Permission admin.templates requise")
    doc = {
        **data,
        "template_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "is_default": False,
        "created_at": _now(),
        "updated_at": _now(),
    }
    doc.pop("_id", None)
    await db.project_templates.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_template(template_id: str, data: dict, user: TokenPayload) -> dict:
    if not has_perm(user, "admin.templates"):
        raise HTTPException(403, "Permission admin.templates requise")
    tpl = await db.project_templates.find_one(
        {"template_id": template_id, "tenant_id": user.tenant_id}
    )
    if not tpl:
        raise HTTPException(404, "Template introuvable")
    data.pop("_id", None)
    data.pop("template_id", None)
    data.pop("tenant_id", None)
    data["updated_at"] = _now()
    await db.project_templates.update_one(
        {"template_id": template_id, "tenant_id": user.tenant_id},
        {"$set": data}
    )
    return await get_template(template_id, user)


async def delete_template(template_id: str, user: TokenPayload):
    if not has_perm(user, "admin.templates"):
        raise HTTPException(403, "Permission admin.templates requise")
    tpl = await db.project_templates.find_one(
        {"template_id": template_id, "tenant_id": user.tenant_id}
    )
    if not tpl:
        raise HTTPException(404, "Template introuvable")
    if tpl.get("is_default"):
        raise HTTPException(400, "Les templates par défaut ne peuvent pas être supprimés")
    await db.project_templates.delete_one({"template_id": template_id})


async def duplicate_template(template_id: str, user: TokenPayload) -> dict:
    if not has_perm(user, "admin.templates"):
        raise HTTPException(403, "Permission admin.templates requise")
    tpl = await db.project_templates.find_one(
        {"template_id": template_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not tpl:
        raise HTTPException(404, "Template introuvable")
    new_doc = {
        **tpl,
        "template_id": str(uuid.uuid4()),
        "name": f"Copie de {tpl['name']}",
        "is_default": False,
        "created_at": _now(),
        "updated_at": _now(),
    }
    new_doc.pop("_id", None)
    await db.project_templates.insert_one(new_doc)
    new_doc.pop("_id", None)
    return new_doc


async def apply_template(
    project_id: str,
    template_id: str,
    selected_phases: Optional[list],
    user: TokenPayload,
) -> dict:
    """Crée tâches et jalons depuis un template."""
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(404, "Projet introuvable")

    tpl = await db.project_templates.find_one(
        {"template_id": template_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not tpl:
        raise HTTPException(404, "Template introuvable")

    # Date de début du projet
    start_date_str = project.get("date_debut") or project.get("start_date")
    if start_date_str:
        try:
            start_date = datetime.fromisoformat(str(start_date_str)[:10])
        except Exception:
            start_date = datetime.now(timezone.utc)
    else:
        start_date = datetime.now(timezone.utc)

    phases = tpl.get("phases", [])
    if selected_phases is not None:
        phases = [p for p in phases if p["name"] in selected_phases]

    tasks_created = 0
    milestones_created = 0
    cumulative_days = 0

    for phase in sorted(phases, key=lambda p: p.get("order", 0)):
        phase_start = start_date + timedelta(days=cumulative_days)
        phase_duration = phase.get("duration_days_default", 30)

        # Créer les jalons de la phase
        for ms in phase.get("milestones", []):
            ms_doc = {
                "milestone_id": str(uuid.uuid4()),
                "project_id": project_id,
                "tenant_id": user.tenant_id,
                "name": ms["name"],
                "family": ms.get("family", "delivery"),
                "attribute": ms.get("attribute"),
                "date_baseline": (phase_start + timedelta(days=phase_duration)).strftime("%Y-%m-%d"),
                "date_forecast": (phase_start + timedelta(days=phase_duration)).strftime("%Y-%m-%d"),
                "status": "not_done",
                "phase": phase["name"],
                "source": "template",
                "created_at": _now(),
            }
            await db.milestones.insert_one(ms_doc)
            milestones_created += 1

        # Créer les tâches de la phase
        for i, task in enumerate(phase.get("tasks", [])):
            task_start = phase_start + timedelta(days=i * 5)
            task_doc = {
                "task_id": str(uuid.uuid4()),
                "project_id": project_id,
                "tenant_id": user.tenant_id,
                "name": task["name"],
                "phase": phase["name"],
                "scope_status": task.get("scope_status", "SEC"),
                "status": "todo",
                "date_debut": task_start.strftime("%Y-%m-%d"),
                "date_fin": (task_start + timedelta(days=5)).strftime("%Y-%m-%d"),
                "source": "template",
                "created_at": _now(),
            }
            await db.tasks.insert_one(task_doc)
            tasks_created += 1

        cumulative_days += phase_duration

    return {
        "project_id": project_id,
        "template_id": template_id,
        "template_name": tpl["name"],
        "phases_applied": len(phases),
        "tasks_created": tasks_created,
        "milestones_created": milestones_created,
    }
