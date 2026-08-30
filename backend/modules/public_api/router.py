"""API publique MARCEL v1 — endpoints LECTURE SEULE (aucune écriture exposée).

Chaque endpoint : Depends(require_scope("<domaine>.read")), tenant_id dérivé du token,
pagination/filtres/tri, réponses JSON stables (dates ISO 8601).
"""
from fastapi import APIRouter, Depends, Request

from core.database import db
from core.public_api import PublicApiContext, require_scope, query_collection

router = APIRouter(prefix="/v1", tags=["public-api-v1"])

# ─── Projets ──────────────────────────────────────────────────────────────────
_PROJECT_FIELDS = [
    "project_id", "code", "name", "methodology", "status", "status_rag", "description",
    "direction", "program_id", "lifecycle_phase", "start_date", "end_date_baseline",
    "end_date_forecast", "end_date_actual", "strategic_alignment", "business_value",
    "roi_estimated", "urgency", "complexity", "risk_score", "jh_planned", "jh_consumed",
    "budget_total", "budget_consumed", "eac", "impacted_application_ids", "created_at", "updated_at",
]


@router.get("/projects")
async def list_projects(request: Request, ctx: PublicApiContext = Depends(require_scope("projects.read"))):
    return await query_collection(
        db.projects, ctx, request, _PROJECT_FIELDS,
        filterable=["status", "status_rag", "methodology", "program_id", "lifecycle_phase", "direction"],
        sortable=["created_at", "updated_at", "name", "business_value", "budget_total", "eac", "end_date_forecast"],
        default_sort="created_at")


# ─── Programmes ─────────────────────────────────────────────────────────────
@router.get("/programs")
async def list_programs(request: Request, ctx: PublicApiContext = Depends(require_scope("programs.read"))):
    return await query_collection(
        db.programs, ctx, request,
        ["program_id", "name", "description", "owner", "start_date", "end_date", "budget_keur", "status"],
        filterable=["status"], sortable=["name", "start_date", "end_date", "budget_keur"], default_sort="name")


# ─── Portefeuille (synthèse agrégée) ──────────────────────────────────────────
@router.get("/portfolio")
async def portfolio_summary(request: Request, ctx: PublicApiContext = Depends(require_scope("portfolio.read"))):
    projects = await db.projects.find(
        {"tenant_id": ctx.tenant_id},
        {"_id": 0, "status": 1, "status_rag": 1, "budget_total": 1, "budget_consumed": 1, "eac": 1,
         "jh_planned": 1, "jh_consumed": 1}).to_list(None)
    by_status, by_rag = {}, {}
    tot = {"budget_total": 0.0, "budget_consumed": 0.0, "eac": 0.0, "jh_planned": 0.0, "jh_consumed": 0.0}
    for p in projects:
        by_status[p.get("status", "?")] = by_status.get(p.get("status", "?"), 0) + 1
        by_rag[p.get("status_rag", "?")] = by_rag.get(p.get("status_rag", "?"), 0) + 1
        for k in tot:
            tot[k] += float(p.get(k) or 0)
    return {
        "data": {
            "projects_total": len(projects),
            "by_status": by_status,
            "by_rag": by_rag,
            "budget": {k: round(tot[k]) for k in ("budget_total", "budget_consumed", "eac")},
            "workload_jh": {"planned": round(tot["jh_planned"]), "consumed": round(tot["jh_consumed"])},
            "currency": "EUR",
        }
    }


# ─── Budgets (ligne budgétaire par projet) ────────────────────────────────────
_BUDGET_FIELDS = [
    "project_id", "code", "name", "status", "budget_total", "budget_consumed", "budget_forecast",
    "eac", "capex_planned", "capex_consumed", "opex_planned", "opex_consumed",
]


@router.get("/budgets")
async def list_budgets(request: Request, ctx: PublicApiContext = Depends(require_scope("budgets.read"))):
    res = await query_collection(
        db.projects, ctx, request, _BUDGET_FIELDS,
        filterable=["status"], sortable=["budget_total", "eac", "budget_consumed", "name"], default_sort="budget_total")
    for row in res["data"]:
        row["currency"] = "EUR"
    return res


# ─── Jalons ───────────────────────────────────────────────────────────────────
@router.get("/milestones")
async def list_milestones(request: Request, ctx: PublicApiContext = Depends(require_scope("milestones.read"))):
    return await query_collection(
        db.milestones, ctx, request,
        ["milestone_id", "project_id", "name", "date_baseline", "date_forecast", "date_actual",
         "status", "is_governance", "family", "type", "is_blocking"],
        filterable=["status", "project_id", "is_governance", "is_blocking", "type", "family"],
        sortable=["date_forecast", "date_baseline", "name"], default_sort="date_forecast")


# ─── Risques ────────────────────────────────────────────────────────────────
@router.get("/risks")
async def list_risks(request: Request, ctx: PublicApiContext = Depends(require_scope("risks.read"))):
    return await query_collection(
        db.risks, ctx, request,
        ["risk_id", "project_id", "title", "description", "category", "probability", "impact",
         "criticality", "status", "mitigation_plan", "owner", "due_date", "created_at"],
        filterable=["status", "project_id", "category", "criticality"],
        sortable=["criticality", "created_at", "due_date"], default_sort="criticality")


# ─── Dépendances ──────────────────────────────────────────────────────────────
@router.get("/dependencies")
async def list_dependencies(request: Request, ctx: PublicApiContext = Depends(require_scope("dependencies.read"))):
    return await query_collection(
        db.project_dependencies, ctx, request,
        ["dependency_id", "source_project_id", "target_project_id", "source_milestone_id",
         "target_milestone_id", "nature", "direction", "description", "target_date", "status", "impact", "created_at"],
        filterable=["status", "source_project_id", "target_project_id", "nature", "impact"],
        sortable=["created_at", "target_date"], default_sort="created_at")


# ─── Capacité (synthèse par équipe/ressource/compétence) ──────────────────────
@router.get("/capacity")
async def capacity_console(request: Request, ctx: PublicApiContext = Depends(require_scope("capacity.read"))):
    from modules.capacity import service as capacity_service
    q = request.query_params
    try:
        horizon = min(12, max(1, int(q.get("horizon", 3))))
    except (ValueError, TypeError):
        horizon = 3
    axis = q.get("axis", "team")
    axis = axis if axis in ("team", "resource", "skill") else "team"
    return {"data": await capacity_service.console(ctx.tenant_id, horizon, axis)}


# ─── Décisions ────────────────────────────────────────────────────────────────
@router.get("/decisions")
async def list_decisions(request: Request, ctx: PublicApiContext = Depends(require_scope("decisions.read"))):
    return await query_collection(
        db.decisions, ctx, request,
        ["decision_id", "project_id", "title", "description", "category", "status",
         "decision_date", "due_date", "owner", "impact", "governance_id", "created_at"],
        filterable=["status", "project_id", "category"],
        sortable=["created_at", "decision_date", "due_date"], default_sort="created_at")


# ─── Applications ─────────────────────────────────────────────────────────────
@router.get("/applications")
async def list_applications(request: Request, ctx: PublicApiContext = Depends(require_scope("applications.read"))):
    return await query_collection(
        db.applications, ctx, request,
        ["application_id", "name", "code", "description", "status", "criticality", "time_rating",
         "editor", "technology", "hosting", "data_sensitivity", "business_owner", "it_owner",
         "users_count", "tco_annual", "business_capabilities", "project_ids", "created_at", "updated_at"],
        filterable=["status", "criticality", "data_sensitivity"],
        sortable=["name", "criticality", "tco_annual", "users_count"], default_sort="name")


# ─── Incidents / Run ──────────────────────────────────────────────────────────
@router.get("/incidents")
async def list_incidents(request: Request, ctx: PublicApiContext = Depends(require_scope("incidents.read"))):
    return await query_collection(
        db.incidents, ctx, request,
        ["incident_id", "title", "application_id", "severity", "status", "opened_at",
         "resolved_at", "sla_target_hours", "description", "created_at"],
        filterable=["status", "severity", "application_id"],
        sortable=["opened_at", "created_at", "severity"], default_sort="opened_at")
