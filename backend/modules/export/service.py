from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload
from .schemas import ExportCopilRequest
from pptx_generator import generate_copil_pptx


async def _compute_team_consumption(project_ids: list, tenant_id: str) -> dict:
    """Calcule la consommation par équipe pour chaque projet (même logique que S1-06)."""
    # Charger toutes les tâches des projets
    tasks = await db.tasks.find(
        {"project_id": {"$in": project_ids}, "tenant_id": tenant_id},
        {"_id": 0, "task_id": 1, "project_id": 1},
    ).to_list(None)
    task_to_project = {t["task_id"]: t["project_id"] for t in tasks}
    all_task_ids = list(task_to_project.keys())
    if not all_task_ids:
        return {}

    # Charger toutes les work_allocations
    work_allocs = await db.work_allocations.find(
        {"task_id": {"$in": all_task_ids}}, {"_id": 0}
    ).to_list(None)
    if not work_allocs:
        return {}

    # Charger ressources
    resources = await db.resources.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1, "tjm_eur": 1, "team_id": 1, "team": 1},
    ).to_list(None)
    res_map = {r["resource_id"]: r for r in resources}

    # Charger équipes
    teams = await db.teams.find(
        {"tenant_id": tenant_id}, {"_id": 0, "team_id": 1, "name": 1}
    ).to_list(None)
    team_map = {t["team_id"]: t["name"] for t in teams}

    # Agréger par projet × équipe
    by_project: dict = {pid: {} for pid in project_ids}

    for wa in work_allocs:
        proj_id = task_to_project.get(wa.get("task_id", ""))
        if not proj_id:
            continue
        res = res_map.get(wa.get("resource_id", ""), {})
        team_id = res.get("team_id") or "__none__"
        team_name = team_map.get(team_id) or res.get("team") or "Non affectée"
        tjm = res.get("tjm_eur") or 0
        planned_md  = wa.get("planned_md", 0)
        consumed_md = wa.get("consumed_md", 0)
        raf_md = max(planned_md - consumed_md, 0)

        agg = by_project[proj_id]
        if team_id not in agg:
            agg[team_id] = {
                "team_id": team_id if team_id != "__none__" else None,
                "team_name": team_name,
                "planned_md": 0.0, "consumed_md": 0.0, "raf_md": 0.0,
                "planned_cost_eur": 0.0, "consumed_cost_eur": 0.0, "raf_cost_eur": 0.0,
            }
        agg[team_id]["planned_md"]       += planned_md
        agg[team_id]["consumed_md"]      += consumed_md
        agg[team_id]["raf_md"]           += raf_md
        agg[team_id]["planned_cost_eur"] += round(planned_md * tjm, 2)
        agg[team_id]["consumed_cost_eur"]+= round(consumed_md * tjm, 2)
        agg[team_id]["raf_cost_eur"]     += round(raf_md * tjm, 2)

    return {pid: sorted(agg.values(), key=lambda x: -x["consumed_cost_eur"])
            for pid, agg in by_project.items()}


async def export_copil(data: ExportCopilRequest, current_user: TokenPayload):
    if not data.project_ids:
        raise HTTPException(status_code=422, detail="Au moins un projet requis")

    projects = await db.projects.find(
        {"project_id": {"$in": data.project_ids}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)
    if not projects:
        raise HTTPException(status_code=404, detail="Aucun projet trouvé pour les IDs fournis")

    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "resource_id": 1, "name": 1}
    ).to_list(None)
    res_map = {r["resource_id"]: r["name"] for r in resources}
    for p in projects:
        p["owner_name"] = res_map.get(
            p.get("owner_id", ""),
            p.get("metadata", {}).get("sponsor", "—") or "—",
        )

    pid_order = {pid: i for i, pid in enumerate(data.project_ids)}
    projects.sort(key=lambda p: pid_order.get(p["project_id"], 999))

    milestones = await db.milestones.find(
        {"project_id": {"$in": data.project_ids}}, {"_id": 0}
    ).to_list(None)

    risks = await db.risks.find(
        {"project_id": {"$in": data.project_ids}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)

    decisions_query: dict = {
        "project_id": {"$in": data.project_ids},
        "tenant_id": current_user.tenant_id,
    }
    if data.governance_id:
        decisions_query["governance_id"] = data.governance_id
    decisions = await db.decisions.find(decisions_query, {"_id": 0}).sort("created_at", -1).to_list(None)

    # S1-08 — Données consommation par équipe
    team_consumption_by_project = await _compute_team_consumption(
        data.project_ids, current_user.tenant_id
    )

    # Dependencies for roadmap arrows
    dependencies = await db.project_dependencies.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)

    buf = generate_copil_pptx(
        instance_name=data.instance_name,
        instance_date=data.instance_date,
        projects=projects,
        all_milestones=milestones,
        all_risks=risks,
        all_decisions=decisions,
        governance_id=data.governance_id,
        team_consumption_by_project=team_consumption_by_project,
        include_roadmap=data.include_roadmap,
        dependencies=dependencies,
    )
    return buf, data.instance_name, data.instance_date
