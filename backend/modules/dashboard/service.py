from core.database import db
from core.auth import TokenPayload


async def get_summary(current_user: TokenPayload) -> dict:
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


async def get_top_risks(current_user: TokenPayload) -> list:
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


async def get_heatmap_risks(current_user: TokenPayload) -> list:
    risks = await db.risks.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).sort("criticality", -1).to_list(None)
    if not risks:
        return []
    project_ids = list({r["project_id"] for r in risks})
    projects = await db.projects.find(
        {"project_id": {"$in": project_ids}}, {"_id": 0, "project_id": 1, "name": 1, "program_id": 1}
    ).to_list(None)
    project_map = {
        p["project_id"]: {"name": p["name"], "program_id": p.get("program_id")}
        for p in projects
    }
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
