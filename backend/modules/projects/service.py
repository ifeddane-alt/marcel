from fastapi import HTTPException
from datetime import datetime, timezone
import uuid
from core.database import db
from core.auth import TokenPayload, require_write, is_ownership_restricted
from .schemas import ProjectCreate, ProjectUpdate, BudgetRevisionCreate


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


async def list_projects(current_user: TokenPayload) -> list:
    query: dict = {"tenant_id": current_user.tenant_id}
    # Filtrage ownership : CHEF_DE_PROJET ne voit que ses projets
    if is_ownership_restricted(current_user, "projects.view_own"):
        query["owner_id"] = current_user.user_id
    return await db.projects.find(query, {"_id": 0}).to_list(None)


async def get_project(project_id: str, current_user: TokenPayload) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return project


async def create_project(data: ProjectCreate, current_user: TokenPayload) -> dict:
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


async def update_project(project_id: str, data: ProjectUpdate, current_user: TokenPayload) -> dict:
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


async def add_budget_revision(
    project_id: str,
    data: BudgetRevisionCreate,
    current_user: TokenPayload,
) -> dict:
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


async def delete_project(project_id: str, current_user: TokenPayload) -> None:
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    await db.tasks.delete_many({"project_id": project_id, "tenant_id": current_user.tenant_id})
    await db.milestones.delete_many({"project_id": project_id})
    await db.allocations.delete_many({"project_id": project_id})
    result = await db.projects.delete_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Projet introuvable")


async def get_team_consumption(project_id: str, current_user: TokenPayload) -> list:
    """S1-06 — Consommation par équipe : SUM(work_allocations.md × tjm_eur) GROUP BY team."""
    proj = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    tasks = await db.tasks.find(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "task_id": 1},
    ).to_list(None)
    task_ids = [t["task_id"] for t in tasks]
    if not task_ids:
        return []

    work_allocs = await db.work_allocations.find(
        {"task_id": {"$in": task_ids}}, {"_id": 0}
    ).to_list(None)
    if not work_allocs:
        return []

    # Charger toutes les ressources du tenant
    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0, "resource_id": 1, "tjm_eur": 1, "team_id": 1, "team": 1},
    ).to_list(None)
    res_map = {r["resource_id"]: r for r in resources}

    # Charger les équipes du tenant
    teams = await db.teams.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "team_id": 1, "name": 1}
    ).to_list(None)
    team_map = {t["team_id"]: t["name"] for t in teams}

    # Agrégation par team_id
    agg: dict = {}
    for wa in work_allocs:
        res = res_map.get(wa.get("resource_id", ""), {})
        team_id = res.get("team_id") or "__none__"
        team_name = team_map.get(team_id) or res.get("team") or "Non affectée"
        tjm = res.get("tjm_eur") or 0
        planned_md = wa.get("planned_md", 0)
        consumed_md = wa.get("consumed_md", 0)
        raf_md = max(planned_md - consumed_md, 0)

        if team_id not in agg:
            agg[team_id] = {
                "team_id": team_id if team_id != "__none__" else None,
                "team_name": team_name,
                "planned_md": 0.0,
                "consumed_md": 0.0,
                "raf_md": 0.0,
                "planned_cost_eur": 0.0,
                "consumed_cost_eur": 0.0,
                "raf_cost_eur": 0.0,
            }
        agg[team_id]["planned_md"] += planned_md
        agg[team_id]["consumed_md"] += consumed_md
        agg[team_id]["raf_md"] += raf_md
        agg[team_id]["planned_cost_eur"] += round(planned_md * tjm, 2)
        agg[team_id]["consumed_cost_eur"] += round(consumed_md * tjm, 2)
        agg[team_id]["raf_cost_eur"] += round(raf_md * tjm, 2)

    return sorted(agg.values(), key=lambda x: -x["consumed_cost_eur"])


async def get_raf(project_id: str, current_user: TokenPayload) -> dict:
    """S1-07 — RAF valorisé : SUM((planned_md - consumed_md) × tjm_eur) par projet."""
    proj = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    tasks = await db.tasks.find(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "task_id": 1},
    ).to_list(None)
    task_ids = [t["task_id"] for t in tasks]
    if not task_ids:
        return {"raf_md": 0.0, "raf_cost_eur": 0.0, "consumed_md": 0.0,
                "consumed_cost_eur": 0.0, "atterrissage_eur": proj.get("budget_consumed", 0)}

    work_allocs = await db.work_allocations.find(
        {"task_id": {"$in": task_ids}}, {"_id": 0}
    ).to_list(None)

    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0, "resource_id": 1, "tjm_eur": 1},
    ).to_list(None)
    res_map = {r["resource_id"]: r.get("tjm_eur") or 0 for r in resources}

    raf_md = 0.0
    raf_cost = 0.0
    consumed_md = 0.0
    consumed_cost = 0.0

    for wa in work_allocs:
        tjm = res_map.get(wa.get("resource_id", ""), 0)
        p = wa.get("planned_md", 0)
        c = wa.get("consumed_md", 0)
        raf = max(p - c, 0)
        consumed_md += c
        consumed_cost += c * tjm
        raf_md += raf
        raf_cost += raf * tjm

    atterrissage = round(consumed_cost + raf_cost, 2)

    return {
        "raf_md": round(raf_md, 2),
        "raf_cost_eur": round(raf_cost, 2),
        "consumed_md": round(consumed_md, 2),
        "consumed_cost_eur": round(consumed_cost, 2),
        "atterrissage_eur": atterrissage,
    }
