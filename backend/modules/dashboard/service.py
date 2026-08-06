from datetime import datetime, timezone, timedelta

from core.database import db
from core.auth import TokenPayload, has_perm, is_ownership_restricted


def _project_query(current_user: TokenPayload) -> dict:
    """Construit le filtre MongoDB projets selon les droits de l'utilisateur."""
    query: dict = {"tenant_id": current_user.tenant_id}
    if is_ownership_restricted(current_user, "projects.view_own"):
        query["owner_id"] = current_user.user_id
    return query


async def get_summary(current_user: TokenPayload) -> dict:
    projects = await db.projects.find(
        _project_query(current_user), {"_id": 0}
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


DASHBOARD_DEFAULT_WIDGETS = [
    "metrics", "budget_detail", "capacity", "regulatory", "envelope",
    "ai_recommendations", "upcoming_milestones", "team_load", "charts",
    "milestones_gauge", "top_projects", "pending_timesheets", "recent_decisions",
    "recent_projects", "top_risks", "heatmap",
]


async def get_extras(current_user: TokenPayload) -> dict:
    """Données des widgets additionnels du dashboard principal."""
    projects = await db.projects.find(
        _project_query(current_user), {"_id": 0, "project_id": 1, "name": 1}
    ).to_list(None)
    pnames = {p["project_id"]: p["name"] for p in projects}
    pids = list(pnames.keys())
    today = datetime.now(timezone.utc).date()
    horizon = (today + timedelta(days=30)).isoformat()

    ms = await db.milestones.find(
        {"project_id": {"$in": pids}, "status": {"$ne": "done"},
         "date_forecast": {"$lte": horizon, "$ne": None}},
        {"_id": 0},
    ).sort("date_forecast", 1).to_list(15)
    upcoming = []
    for m in ms:
        fc = (m.get("date_forecast") or "")[:10]
        try:
            days = (datetime.fromisoformat(fc).date() - today).days
        except ValueError:
            days = None
        upcoming.append({
            "milestone_id": m["milestone_id"],
            "name": m.get("name"),
            "project_id": m.get("project_id"),
            "project_name": pnames.get(m.get("project_id"), "—"),
            "date_forecast": fc,
            "days_remaining": days,
            "late": (m.get("date_forecast") or "") > (m.get("date_baseline") or "9999")
                    or (days is not None and days < 0),
        })

    pending = await db.timesheets.find(
        {"tenant_id": current_user.tenant_id, "status": "submitted"}, {"_id": 0}
    ).sort("submitted_at", -1).to_list(None)
    resource_ids = list({t.get("resource_id") for t in pending if t.get("resource_id")})
    rnames = {
        r["resource_id"]: r.get("name", "—")
        for r in await db.resources.find(
            {"resource_id": {"$in": resource_ids}}, {"_id": 0, "resource_id": 1, "name": 1}
        ).to_list(None)
    }
    pending_items = [
        {
            "timesheet_id": t["timesheet_id"],
            "resource_name": rnames.get(t.get("resource_id"), "—"),
            "date": t.get("date"),
            "jh_value": t.get("jh_value", 0),
        }
        for t in pending[:5]
    ]

    decisions = await db.decisions.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(5)
    recent_decisions = [
        {
            "decision_id": d["decision_id"],
            "title": d.get("title"),
            "status": d.get("status"),
            "category": d.get("category"),
            "project_id": d.get("project_id"),
            "project_name": pnames.get(d.get("project_id"), "—"),
            "decision_date": d.get("decision_date") or (d.get("created_at") or "")[:10],
        }
        for d in decisions
    ]

    return {
        "upcoming_milestones": upcoming,
        "pending_timesheets": {
            "count": len(pending),
            "total_jh": round(sum(t.get("jh_value", 0) for t in pending), 1),
            "items": pending_items,
        },
        "recent_decisions": recent_decisions,
    }


async def get_dashboard_preferences(current_user: TokenPayload) -> dict:
    doc = await db.user_preferences.find_one(
        {"user_id": current_user.user_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    widgets = (doc or {}).get("dashboard_widgets") or DASHBOARD_DEFAULT_WIDGETS
    layouts = (doc or {}).get("dashboard_layouts") or None
    return {"widgets": widgets, "layouts": layouts, "available": DASHBOARD_DEFAULT_WIDGETS}


async def update_dashboard_preferences(widgets: list, layouts: dict | None, current_user: TokenPayload) -> dict:
    valid = [w for w in widgets if w in DASHBOARD_DEFAULT_WIDGETS]
    update = {"dashboard_widgets": valid}
    if layouts is not None:
        update["dashboard_layouts"] = layouts
    await db.user_preferences.update_one(
        {"user_id": current_user.user_id, "tenant_id": current_user.tenant_id},
        {"$set": update},
        upsert=True,
    )
    return {"widgets": valid, "layouts": layouts, "available": DASHBOARD_DEFAULT_WIDGETS}


CXO_DEFAULT_WIDGETS = ["kpis", "rag", "budget", "milestones", "risks", "top_projects"]


async def get_cxo(current_user: TokenPayload) -> dict:
    """Dashboard CxO — KPIs consolidés portefeuille."""
    projects = await db.projects.find(_project_query(current_user), {"_id": 0}).to_list(None)
    project_ids = [p["project_id"] for p in projects]

    programs_count = await db.programs.count_documents({"tenant_id": current_user.tenant_id})

    milestones = await db.milestones.find(
        {"project_id": {"$in": project_ids}}, {"_id": 0, "date_baseline": 1, "date_forecast": 1, "status": 1}
    ).to_list(None)
    ms_total = len(milestones)
    ms_on_time = sum(
        1 for m in milestones
        if m.get("status") == "done" or (m.get("date_forecast") or "") <= (m.get("date_baseline") or "9999")
    )

    risks = await db.risks.find(
        {"tenant_id": current_user.tenant_id, "project_id": {"$in": project_ids}},
        {"_id": 0, "criticality": 1},
    ).to_list(None)
    critical_risks = sum(1 for r in risks if (r.get("criticality") or 0) >= 9)

    total_budget = sum(p.get("budget_total", 0) for p in projects)
    total_consumed = sum(p.get("budget_consumed", 0) for p in projects)
    total_forecast = sum(p.get("budget_forecast", 0) for p in projects)

    top_projects = sorted(projects, key=lambda p: -(p.get("budget_total") or 0))[:5]

    return {
        "kpis": {
            "total_projects": len(projects),
            "total_programs": programs_count,
            "active_projects": sum(1 for p in projects if p.get("status") == "actif"),
            "critical_risks": critical_risks,
            "total_risks": len(risks),
        },
        "rag": {
            "green": sum(1 for p in projects if p.get("status_rag") == "green"),
            "orange": sum(1 for p in projects if p.get("status_rag") in ("orange", "amber")),
            "red": sum(1 for p in projects if p.get("status_rag") == "red"),
        },
        "budget": {
            "total": total_budget,
            "consumed": total_consumed,
            "forecast": total_forecast,
            "consumption_rate": round(total_consumed / total_budget * 100, 1) if total_budget else 0,
            "overrun": max(total_forecast - total_budget, 0),
        },
        "milestones": {
            "total": ms_total,
            "on_time": ms_on_time,
            "on_time_rate": round(ms_on_time / ms_total * 100, 1) if ms_total else 100,
        },
        "top_projects": [
            {
                "project_id": p["project_id"],
                "name": p.get("name"),
                "budget_total": p.get("budget_total", 0),
                "budget_consumed": p.get("budget_consumed", 0),
                "status_rag": p.get("status_rag"),
                "status": p.get("status"),
            }
            for p in top_projects
        ],
    }


async def get_cxo_preferences(current_user: TokenPayload) -> dict:
    doc = await db.user_preferences.find_one(
        {"user_id": current_user.user_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    widgets = (doc or {}).get("cxo_widgets") or CXO_DEFAULT_WIDGETS
    return {"widgets": widgets, "available": CXO_DEFAULT_WIDGETS}


async def update_cxo_preferences(widgets: list, current_user: TokenPayload) -> dict:
    valid = [w for w in widgets if w in CXO_DEFAULT_WIDGETS]
    await db.user_preferences.update_one(
        {"user_id": current_user.user_id, "tenant_id": current_user.tenant_id},
        {"$set": {"cxo_widgets": valid}},
        upsert=True,
    )
    return {"widgets": valid, "available": CXO_DEFAULT_WIDGETS}


async def get_top_risks(current_user: TokenPayload) -> list:
    # Filtrer d'abord les projets autorisés
    allowed_projects = await db.projects.find(
        _project_query(current_user), {"_id": 0, "project_id": 1, "name": 1}
    ).to_list(None)
    allowed_ids = [p["project_id"] for p in allowed_projects]
    project_map = {p["project_id"]: p["name"] for p in allowed_projects}

    risks = await db.risks.find(
        {"tenant_id": current_user.tenant_id, "project_id": {"$in": allowed_ids}}, {"_id": 0}
    ).sort("criticality", -1).to_list(None)
    return [
        {**r, "project_name": project_map.get(r["project_id"], "—")}
        for r in risks[:10]
    ]


async def get_heatmap_risks(current_user: TokenPayload) -> list:
    allowed_projects = await db.projects.find(
        _project_query(current_user), {"_id": 0, "project_id": 1, "name": 1, "program_id": 1}
    ).to_list(None)
    allowed_ids = [p["project_id"] for p in allowed_projects]
    if not allowed_ids:
        return []

    risks = await db.risks.find(
        {"tenant_id": current_user.tenant_id, "project_id": {"$in": allowed_ids}}, {"_id": 0}
    ).sort("criticality", -1).to_list(None)
    if not risks:
        return []

    project_map = {
        p["project_id"]: {"name": p["name"], "program_id": p.get("program_id")}
        for p in allowed_projects
    }
    program_ids = list({p.get("program_id") for p in allowed_projects if p.get("program_id")})
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
