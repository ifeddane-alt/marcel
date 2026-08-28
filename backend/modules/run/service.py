import uuid
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload, require_perm

VALID_TYPES = ["mco", "support", "supervision", "maintenance_corrective",
               "maintenance_evolutive", "patching", "sauvegardes", "astreinte", "autre"]
VALID_SEVERITIES = ["P1", "P2", "P3", "P4"]
VALID_INCIDENT_STATUSES = ["ouvert", "en_cours", "resolu"]
VALID_RELEASE_TYPES = ["mep", "gel"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_write(user: TokenPayload) -> None:
    if user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(403, "Droits insuffisants pour gérer le run")


def _norm_month(m: str) -> str:
    m = str(m)[:7]
    return f"{m}-01"


# ─── Activités de run ─────────────────────────────────────────────────────────

async def list_activities(user: TokenPayload) -> list:
    acts = await db.run_activities.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("name", 1).to_list(None)
    apps = {a["application_id"]: a["name"] for a in await db.applications.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "application_id": 1, "name": 1}).to_list(None)}
    teams = {t["team_id"]: t["name"] for t in await db.teams.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "team_id": 1, "name": 1}).to_list(None)}
    jh_by_activity = {}
    async for row in db.run_allocations.aggregate([
        {"$match": {"tenant_id": user.tenant_id}},
        {"$group": {"_id": "$activity_id", "jh": {"$sum": "$days_allocated"}}},
    ]):
        jh_by_activity[row["_id"]] = row["jh"]
    for a in acts:
        a["application_name"] = apps.get(a.get("application_id"))
        a["team_name"] = teams.get(a.get("team_id"))
        a["allocated_jh"] = round(jh_by_activity.get(a["activity_id"], 0), 1)
    return acts


def _clean_activity(data: dict) -> dict:
    allowed = {"name", "type", "application_id", "team_id", "owner", "description",
               "recurrence", "status", "budget_annual", "budget_consumed"}
    out = {k: v for k, v in data.items() if k in allowed}
    if out.get("type") and out["type"] not in VALID_TYPES:
        raise HTTPException(400, f"Type d'activité invalide : {out['type']}")
    return out


async def create_activity(data: dict, user: TokenPayload) -> dict:
    require_perm(user, "run.manage")
    if not (data.get("name") or "").strip():
        raise HTTPException(400, "Le nom de l'activité est requis")
    act = {
        "activity_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "type": "mco",
        "status": "active",
        "recurrence": "continue",
        **_clean_activity(data),
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.run_activities.insert_one({**act})
    act.pop("_id", None)
    return act


async def update_activity(activity_id: str, data: dict, user: TokenPayload) -> dict:
    require_perm(user, "run.manage")
    payload = _clean_activity(data)
    payload["updated_at"] = _now()
    res = await db.run_activities.update_one(
        {"activity_id": activity_id, "tenant_id": user.tenant_id}, {"$set": payload}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Activité introuvable")
    return await db.run_activities.find_one({"activity_id": activity_id}, {"_id": 0})


async def delete_activity(activity_id: str, user: TokenPayload) -> None:
    require_perm(user, "run.delete")
    res = await db.run_activities.delete_one(
        {"activity_id": activity_id, "tenant_id": user.tenant_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Activité introuvable")
    await db.run_allocations.delete_many({"activity_id": activity_id, "tenant_id": user.tenant_id})


# ─── Allocations de ressources sur activités ─────────────────────────────────

async def get_activity_allocations(activity_id: str, user: TokenPayload) -> list:
    allocs = await db.run_allocations.find(
        {"activity_id": activity_id, "tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("month", 1).to_list(None)
    res_names = {r["resource_id"]: r["name"] for r in await db.resources.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "resource_id": 1, "name": 1}).to_list(None)}
    for a in allocs:
        a["resource_name"] = res_names.get(a.get("resource_id"), "?")
    return allocs


async def set_activity_allocations(activity_id: str, allocations: list, user: TokenPayload) -> list:
    require_perm(user, "run.manage")
    act = await db.run_activities.find_one(
        {"activity_id": activity_id, "tenant_id": user.tenant_id}, {"_id": 0, "activity_id": 1}
    )
    if not act:
        raise HTTPException(404, "Activité introuvable")
    await db.run_allocations.delete_many({"activity_id": activity_id, "tenant_id": user.tenant_id})
    docs = []
    for a in allocations:
        if not a.get("resource_id") or not a.get("month"):
            continue
        days = float(a.get("days_allocated") or 0)
        if days <= 0:
            continue
        docs.append({
            "run_allocation_id": str(uuid.uuid4()),
            "tenant_id": user.tenant_id,
            "activity_id": activity_id,
            "resource_id": a["resource_id"],
            "month": _norm_month(a["month"]),
            "days_allocated": days,
        })
    if docs:
        await db.run_allocations.insert_many([{**d} for d in docs])
    return await get_activity_allocations(activity_id, user)


# ─── Charge consolidée build + run ───────────────────────────────────────────

async def get_consolidated_load(months: int, user: TokenPayload) -> dict:
    today = date.today()
    start = today.replace(day=1)
    period_labels = [(start + relativedelta(months=i)).strftime("%Y-%m") for i in range(months)]
    lo, hi = f"{period_labels[0]}-01", f"{period_labels[-1]}-01"

    resources = await db.resources.find(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "resource_id": 1, "name": 1, "team_id": 1, "capacity_jh_month": 1, "availability_rate": 1},
    ).sort("name", 1).to_list(None)
    teams = {t["team_id"]: t["name"] for t in await db.teams.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "team_id": 1, "name": 1}).to_list(None)}

    project_ids = [p["project_id"] for p in await db.projects.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "project_id": 1}).to_list(None)]
    build: dict = {}
    async for row in db.allocations.aggregate([
        {"$match": {"project_id": {"$in": project_ids}, "period_month": {"$gte": lo, "$lte": hi}}},
        {"$group": {"_id": {"r": "$resource_id", "m": "$period_month"}, "jh": {"$sum": "$jh_allocated"}}},
    ]):
        build[(row["_id"]["r"], row["_id"]["m"][:7])] = row["jh"]
    run: dict = {}
    async for row in db.run_allocations.aggregate([
        {"$match": {"tenant_id": user.tenant_id, "month": {"$gte": lo, "$lte": hi}}},
        {"$group": {"_id": {"r": "$resource_id", "m": "$month"}, "jh": {"$sum": "$days_allocated"}}},
    ]):
        run[(row["_id"]["r"], row["_id"]["m"][:7])] = row["jh"]

    rows = []
    for r in resources:
        rid = r["resource_id"]
        capa = (r.get("capacity_jh_month") or 0) * ((r.get("availability_rate") or 100) / 100)
        periods = []
        for m in period_labels:
            b = build.get((rid, m), 0)
            rn = run.get((rid, m), 0)
            total = b + rn
            periods.append({
                "period": m,
                "build_jh": round(b, 1),
                "run_jh": round(rn, 1),
                "total_jh": round(total, 1),
                "utilization_pct": round(total / capa * 100) if capa > 0 else 0,
            })
        rows.append({
            "resource_id": rid,
            "resource_name": r["name"],
            "team_name": teams.get(r.get("team_id")),
            "capacity_jh_month": round(capa, 1),
            "periods": periods,
        })
    return {"periods": period_labels, "resources": rows}


# ─── Incidents & SLA ─────────────────────────────────────────────────────────

def _sla_met(inc: dict):
    if inc.get("status") != "resolu" or not inc.get("resolved_at") or not inc.get("sla_target_hours"):
        return None
    try:
        opened = datetime.fromisoformat(str(inc["opened_at"]).replace("Z", "+00:00"))
        resolved = datetime.fromisoformat(str(inc["resolved_at"]).replace("Z", "+00:00"))
        return (resolved - opened).total_seconds() / 3600 <= float(inc["sla_target_hours"])
    except (ValueError, TypeError):
        return None


async def list_incidents(user: TokenPayload) -> list:
    incs = await db.incidents.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("opened_at", -1).to_list(None)
    apps = {a["application_id"]: a["name"] for a in await db.applications.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "application_id": 1, "name": 1}).to_list(None)}
    for i in incs:
        i["application_name"] = apps.get(i.get("application_id"))
        i["sla_met"] = _sla_met(i)
    return incs


def _clean_incident(data: dict) -> dict:
    allowed = {"title", "application_id", "severity", "status", "opened_at", "resolved_at",
               "sla_target_hours", "description"}
    out = {k: v for k, v in data.items() if k in allowed}
    if out.get("severity") and out["severity"] not in VALID_SEVERITIES:
        raise HTTPException(400, "Sévérité invalide")
    if out.get("status") and out["status"] not in VALID_INCIDENT_STATUSES:
        raise HTTPException(400, "Statut invalide")
    return out


async def create_incident(data: dict, user: TokenPayload) -> dict:
    require_perm(user, "run.manage")
    if not (data.get("title") or "").strip():
        raise HTTPException(400, "Le titre de l'incident est requis")
    inc = {
        "incident_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "severity": "P3",
        "status": "ouvert",
        "opened_at": _now(),
        **_clean_incident(data),
        "created_at": _now(),
    }
    await db.incidents.insert_one({**inc})
    inc.pop("_id", None)
    inc["sla_met"] = _sla_met(inc)
    return inc


async def update_incident(incident_id: str, data: dict, user: TokenPayload) -> dict:
    require_perm(user, "run.manage")
    payload = _clean_incident(data)
    if payload.get("status") == "resolu" and not payload.get("resolved_at"):
        payload["resolved_at"] = _now()
    res = await db.incidents.update_one(
        {"incident_id": incident_id, "tenant_id": user.tenant_id}, {"$set": payload}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Incident introuvable")
    inc = await db.incidents.find_one({"incident_id": incident_id}, {"_id": 0})
    inc["sla_met"] = _sla_met(inc)
    return inc


async def delete_incident(incident_id: str, user: TokenPayload) -> None:
    require_perm(user, "run.delete")
    res = await db.incidents.delete_one({"incident_id": incident_id, "tenant_id": user.tenant_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Incident introuvable")


# ─── MEP & gels ──────────────────────────────────────────────────────────────

async def list_releases(user: TokenPayload) -> list:
    rels = await db.releases.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("date", 1).to_list(None)
    apps = {a["application_id"]: a["name"] for a in await db.applications.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "application_id": 1, "name": 1}).to_list(None)}
    projs = {p["project_id"]: p["name"] for p in await db.projects.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "project_id": 1, "name": 1}).to_list(None)}
    for r in rels:
        r["application_name"] = apps.get(r.get("application_id"))
        r["project_name"] = projs.get(r.get("project_id"))
    return rels


async def create_release(data: dict, user: TokenPayload) -> dict:
    require_perm(user, "run.manage")
    if not (data.get("name") or "").strip() or not data.get("date"):
        raise HTTPException(400, "Nom et date requis")
    if data.get("type") and data["type"] not in VALID_RELEASE_TYPES:
        raise HTTPException(400, "Type invalide")
    rel = {
        "release_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "type": "mep",
        "status": "planifiee",
        **{k: v for k, v in data.items() if k in
           {"name", "date", "end_date", "type", "status", "application_id", "project_id", "comment"}},
        "created_at": _now(),
    }
    await db.releases.insert_one({**rel})
    rel.pop("_id", None)
    return rel


async def update_release(release_id: str, data: dict, user: TokenPayload) -> dict:
    require_perm(user, "run.manage")
    payload = {k: v for k, v in data.items() if k in
               {"name", "date", "end_date", "type", "status", "application_id", "project_id", "comment"}}
    res = await db.releases.update_one(
        {"release_id": release_id, "tenant_id": user.tenant_id}, {"$set": payload}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "MEP introuvable")
    return await db.releases.find_one({"release_id": release_id}, {"_id": 0})


async def delete_release(release_id: str, user: TokenPayload) -> None:
    require_perm(user, "run.delete")
    res = await db.releases.delete_one({"release_id": release_id, "tenant_id": user.tenant_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "MEP introuvable")


# ─── Synthèse run ────────────────────────────────────────────────────────────

async def get_summary(user: TokenPayload) -> dict:
    acts = await db.run_activities.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "budget_annual": 1, "budget_consumed": 1, "status": 1}
    ).to_list(None)
    budget_run = sum(a.get("budget_annual") or 0 for a in acts)
    consumed_run = sum(a.get("budget_consumed") or 0 for a in acts)
    projects = await db.projects.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "budget_total": 1}
    ).to_list(None)
    budget_build = sum(p.get("budget_total") or 0 for p in projects)
    total = budget_run + budget_build
    incs = await db.incidents.find({"tenant_id": user.tenant_id}, {"_id": 0}).to_list(None)
    open_incs = [i for i in incs if i.get("status") != "resolu"]
    resolved_with_sla = [i for i in incs if _sla_met(i) is not None]
    sla_ok = sum(1 for i in resolved_with_sla if _sla_met(i))
    today = date.today().isoformat()
    upcoming = await db.releases.find(
        {"tenant_id": user.tenant_id, "date": {"$gte": today}}, {"_id": 0}
    ).sort("date", 1).to_list(5)
    return {
        "activities_count": len(acts),
        "activities_active": sum(1 for a in acts if a.get("status", "active") == "active"),
        "budget_run_annual": budget_run,
        "budget_run_consumed": consumed_run,
        "budget_build_total": budget_build,
        "run_ratio_pct": round(budget_run / total * 100) if total > 0 else 0,
        "incidents_open": len(open_incs),
        "incidents_p1_open": sum(1 for i in open_incs if i.get("severity") == "P1"),
        "sla_met_pct": round(sla_ok / len(resolved_with_sla) * 100) if resolved_with_sla else None,
        "upcoming_releases": upcoming,
    }
