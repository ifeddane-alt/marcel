from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends

from core.auth import TokenPayload, get_current_user
from core.database import db
from modules.timesheets import service as timesheets_service

router = APIRouter(tags=["home"])

OPEN_MILESTONE_STATUSES = ["planned", "at_risk", "delayed"]


def _milestone_date(m: dict) -> str:
    return (m.get("date_forecast") or m.get("date_baseline") or "")[:10]


@router.get("/home/summary")
async def home_summary(current_user: TokenPayload = Depends(get_current_user)):
    tenant = current_user.tenant_id
    now = datetime.now(timezone.utc)
    today = now.date()
    today_iso = today.isoformat()
    horizon_iso = (today + timedelta(days=21)).isoformat()

    # ── Contexte portefeuille ──
    active_projects = await db.projects.count_documents({"tenant_id": tenant, "status": "actif"})
    red_projects = await db.projects.count_documents(
        {"tenant_id": tenant, "status": "actif", "status_rag": "red"}
    )
    programs_count = await db.programs.count_documents({"tenant_id": tenant})

    # ── Timesheet de la semaine courante (si l'utilisateur est une ressource) ──
    timesheet = None
    if current_user.resource_id:
        week_start = today - timedelta(days=today.weekday())
        week_days = [(week_start + timedelta(days=i)).isoformat() for i in range(5)]
        cursor = db.timesheets.find(
            {
                "tenant_id": tenant,
                "resource_id": current_user.resource_id,
                "date": {"$in": week_days},
            },
            {"_id": 0, "jh_value": 1},
        )
        jh_entered = sum(t.get("jh_value", 0) for t in await cursor.to_list(200))
        timesheet = {"week_start": week_days[0], "jh_entered": round(jh_entered, 2)}

    # ── Validations en attente (valideur / CP / PMO / admin) ──
    try:
        pending_validations = await timesheets_service.get_pending_count(current_user)
    except Exception:
        pending_validations = 0

    # ── Jalons en retard / à venir (21 jours) ──
    milestones = await db.milestones.find(
        {"tenant_id": tenant, "status": {"$in": OPEN_MILESTONE_STATUSES}},
        {"_id": 0, "milestone_id": 1, "project_id": 1, "name": 1,
         "date_baseline": 1, "date_forecast": 1, "status": 1},
    ).to_list(2000)

    late, upcoming = [], []
    for m in milestones:
        d = _milestone_date(m)
        if not d:
            continue
        item = {
            "milestone_id": m["milestone_id"],
            "project_id": m.get("project_id"),
            "name": m.get("name", ""),
            "date": d,
            "status": m.get("status"),
        }
        if d < today_iso:
            late.append(item)
        elif d <= horizon_iso:
            upcoming.append(item)

    late.sort(key=lambda x: x["date"])
    upcoming.sort(key=lambda x: x["date"])
    late_count, upcoming_count = len(late), len(upcoming)
    late, upcoming = late[:5], upcoming[:5]

    # Enrichissement projet (nom + code)
    pids = {m["project_id"] for m in late + upcoming if m.get("project_id")}
    projects = {}
    if pids:
        cursor = db.projects.find(
            {"tenant_id": tenant, "project_id": {"$in": list(pids)}},
            {"_id": 0, "project_id": 1, "name": 1, "code": 1},
        )
        projects = {p["project_id"]: p for p in await cursor.to_list(200)}
    for m in late + upcoming:
        p = projects.get(m.get("project_id"), {})
        m["project_name"] = p.get("name", "")
        m["project_code"] = p.get("code", "")

    # ── Comités à venir (planifiés) ──
    perms = current_user.permissions or []
    committees = None
    if "governance.view" in perms or "*" in perms:
        committees = []
        docs = await db.governance.find(
            {"tenant_id": tenant, "status": "planifie"},
            {"_id": 0, "governance_id": 1, "name": 1, "type": 1, "date_scheduled": 1},
        ).sort("date_scheduled", 1).to_list(200)
        for g in docs:
            d = (g.get("date_scheduled") or "")[:10]
            if d >= today_iso:
                committees.append(g)
        committees = committees[:5]

    # ── Alertes dépassement plan pluriannuel vs enveloppes ──
    overruns = None
    if "budget.view" in perms or "*" in perms:
        overruns = []
        from modules.budget.service import get_multiyear
        my = await get_multiyear(current_user)
        for y in my["years"]:
            env = my["envelopes"].get(str(y))
            planned = my["totals"].get(str(y), 0)
            if env and (env.get("total_envelope") or 0) and planned > env["total_envelope"]:
                overruns.append({
                    "year": y,
                    "planned": planned,
                    "envelope": env["total_envelope"],
                    "overrun": planned - env["total_envelope"],
                })

    return {
        "first_name": (current_user.name or "").split(" ")[0],
        "context": {
            "active_projects": active_projects,
            "red_projects": red_projects,
            "programs": programs_count,
        },
        "timesheet": timesheet,
        "pending_validations": pending_validations,
        "milestones": {
            "late": late,
            "late_count": late_count,
            "upcoming": upcoming,
            "upcoming_count": upcoming_count,
        },
        "committees": committees,
        "envelope_overruns": overruns,
    }
