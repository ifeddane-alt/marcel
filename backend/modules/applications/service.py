import uuid
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload

VALID_STATUSES = ["etude", "build", "production", "decommissionnement", "retiree"]
VALID_TIME = ["invest", "tolerate", "migrate", "eliminate"]
VALID_CRITICALITY = ["basse", "moyenne", "haute", "critique"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_write(user: TokenPayload) -> None:
    if user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(403, "Droits insuffisants pour gérer le portefeuille applicatif")


def _obsolescence_status(component: dict) -> str:
    end = component.get("support_end")
    if not end:
        return "ok"
    try:
        end_d = datetime.strptime(str(end)[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return "ok"
    today = datetime.now(timezone.utc).date()
    if end_d < today:
        return "obsolete"
    if end_d < today + timedelta(days=180):
        return "fin_proche"
    return "ok"


def _enrich(app: dict) -> dict:
    comps = app.get("components") or []
    for c in comps:
        c["obsolescence"] = _obsolescence_status(c)
    app["obsolete_count"] = sum(1 for c in comps if c["obsolescence"] == "obsolete")
    app["obsolescence_warning_count"] = sum(1 for c in comps if c["obsolescence"] == "fin_proche")
    app["project_count"] = len(app.get("project_ids") or [])
    return app


async def list_applications(user: TokenPayload, project_id: str | None = None) -> list:
    q = {"tenant_id": user.tenant_id}
    if project_id:
        q["project_ids"] = project_id
    apps = await db.applications.find(q, {"_id": 0}).sort("name", 1).to_list(None)
    return [_enrich(a) for a in apps]


async def get_summary(user: TokenPayload) -> dict:
    apps = await db.applications.find({"tenant_id": user.tenant_id}, {"_id": 0}).to_list(None)
    apps = [_enrich(a) for a in apps]
    by_time = {t: 0 for t in VALID_TIME}
    by_time["none"] = 0
    by_status = {}
    by_criticality = {c: 0 for c in VALID_CRITICALITY}
    for a in apps:
        t = a.get("time_rating")
        by_time[t if t in VALID_TIME else "none"] += 1
        s = a.get("status") or "production"
        by_status[s] = by_status.get(s, 0) + 1
        c = a.get("criticality")
        if c in by_criticality:
            by_criticality[c] += 1
    return {
        "total": len(apps),
        "tco_total": sum(a.get("tco_annual") or 0 for a in apps),
        "by_time": by_time,
        "by_status": by_status,
        "by_criticality": by_criticality,
        "obsolete_components": sum(a["obsolete_count"] for a in apps),
        "obsolescence_warnings": sum(a["obsolescence_warning_count"] for a in apps),
        "critical_apps": by_criticality["critique"],
    }


async def get_application(application_id: str, user: TokenPayload) -> dict:
    app = await db.applications.find_one(
        {"application_id": application_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not app:
        raise HTTPException(404, "Application introuvable")
    _enrich(app)
    pids = app.get("project_ids") or []
    app["projects"] = await db.projects.find(
        {"project_id": {"$in": pids}, "tenant_id": user.tenant_id},
        {"_id": 0, "project_id": 1, "name": 1, "code": 1, "status_rag": 1, "budget_total": 1},
    ).to_list(None) if pids else []
    return app


def _clean_payload(data: dict) -> dict:
    allowed = {
        "name", "code", "description", "status", "editor", "technology", "hosting",
        "criticality", "data_sensitivity", "business_owner", "it_owner", "users_count",
        "tco_annual", "time_rating", "business_capabilities", "components", "project_ids",
    }
    out = {k: v for k, v in data.items() if k in allowed}
    if "status" in out and out["status"] not in VALID_STATUSES:
        raise HTTPException(400, f"Statut invalide : {out['status']}")
    if out.get("time_rating") and out["time_rating"] not in VALID_TIME:
        raise HTTPException(400, f"Classification TIME invalide : {out['time_rating']}")
    if out.get("criticality") and out["criticality"] not in VALID_CRITICALITY:
        raise HTTPException(400, f"Criticité invalide : {out['criticality']}")
    return out


async def create_application(data: dict, user: TokenPayload) -> dict:
    _require_write(user)
    if not (data.get("name") or "").strip():
        raise HTTPException(400, "Le nom de l'application est requis")
    payload = _clean_payload(data)
    app = {
        "application_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "status": "production",
        "components": [],
        "project_ids": [],
        "business_capabilities": [],
        **payload,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.applications.insert_one({**app})
    app.pop("_id", None)
    return _enrich(app)


async def update_application(application_id: str, data: dict, user: TokenPayload) -> dict:
    _require_write(user)
    payload = _clean_payload(data)
    payload["updated_at"] = _now()
    res = await db.applications.update_one(
        {"application_id": application_id, "tenant_id": user.tenant_id}, {"$set": payload}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Application introuvable")
    return await get_application(application_id, user)


async def delete_application(application_id: str, user: TokenPayload) -> None:
    _require_write(user)
    res = await db.applications.delete_one(
        {"application_id": application_id, "tenant_id": user.tenant_id}
    )
    if res.deleted_count == 0:
        raise HTTPException(404, "Application introuvable")


async def set_projects(application_id: str, project_ids: list, user: TokenPayload) -> dict:
    _require_write(user)
    valid = await db.projects.find(
        {"project_id": {"$in": project_ids}, "tenant_id": user.tenant_id},
        {"_id": 0, "project_id": 1},
    ).to_list(None)
    valid_ids = [p["project_id"] for p in valid]
    res = await db.applications.update_one(
        {"application_id": application_id, "tenant_id": user.tenant_id},
        {"$set": {"project_ids": valid_ids, "updated_at": _now()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Application introuvable")
    return await get_application(application_id, user)
