"""Service Timesheets — Workflow multi-acteurs (C3-Enhancement).

Workflow : draft → submitted → cp_reviewed → validated
Bypass PMO/Admin : any state → validated directement
Rejet : any → draft (avec rejection_reason)
"""
from fastapi import HTTPException
from datetime import datetime, timezone, date, timedelta
import uuid, io, csv as csv_mod
from collections import defaultdict

from core.database import db
from core.auth import TokenPayload, require_write
from .schemas import (
    TimesheetEntryUpsert, TimesheetSubmitWeek,
    TimesheetValidateRequest, TimesheetRejectRequest,
)

CP_TIMEOUT_DAYS = 3   # jours ouvrés avant alerte timeout

# ─── Helpers généraux ────────────────────────────────────────────────────────

def _week_days(week_start: str) -> list[str]:
    d = date.fromisoformat(week_start)
    d -= timedelta(days=d.weekday())
    return [(d + timedelta(days=i)).isoformat() for i in range(5)]


async def _resource(resource_id: str, tenant_id: str) -> dict:
    r = await db.resources.find_one(
        {"resource_id": resource_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not r:
        raise HTTPException(status_code=404, detail="Ressource introuvable")
    return r


def _daily_cap(resource: dict) -> float:
    capa = (resource.get("capacity_jh_month") or 15)
    avail = (resource.get("availability_rate") or 100) / 100
    return round(capa * avail / 21, 2)


async def _enrich_was(wa_list: list) -> tuple[dict, dict]:
    task_ids = list({wa["task_id"] for wa in wa_list if wa.get("task_id")})
    tasks = await db.tasks.find(
        {"task_id": {"$in": task_ids}},
        {"_id": 0, "task_id": 1, "name": 1, "project_id": 1},
    ).to_list(None) if task_ids else []
    task_map = {t["task_id"]: t for t in tasks}

    proj_ids = list({t["project_id"] for t in tasks})
    projects = await db.projects.find(
        {"project_id": {"$in": proj_ids}},
        {"_id": 0, "project_id": 1, "name": 1, "status_rag": 1, "owner_resource_id": 1},
    ).to_list(None) if proj_ids else []
    proj_map = {p["project_id"]: p for p in projects}
    return task_map, proj_map


def _working_days_since(dt_str: str | None) -> int:
    """Nombre de jours ouvrés depuis un timestamp ISO."""
    if not dt_str:
        return 0
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        count = 0
        cur = dt
        while cur < now:
            if cur.weekday() < 5:
                count += 1
            cur += timedelta(days=1)
        return count
    except Exception:
        return 0


# ─── Helpers RBAC Workflow ───────────────────────────────────────────────────

async def _get_validator_for_resource(resource_id: str, tenant_id: str) -> str | None:
    """Retourne le resource_id du valideur d'une ressource.
    Priorité : validator_resource_id explicite > manager de l'équipe.
    """
    res = await db.resources.find_one(
        {"resource_id": resource_id, "tenant_id": tenant_id},
        {"_id": 0, "validator_resource_id": 1, "team_id": 1},
    )
    if not res:
        return None
    if res.get("validator_resource_id"):
        return res["validator_resource_id"]
    team_id = res.get("team_id")
    if not team_id:
        return None
    team = await db.teams.find_one(
        {"team_id": team_id, "tenant_id": tenant_id},
        {"_id": 0, "manager_resource_id": 1},
    )
    return team.get("manager_resource_id") if team else None


async def _get_project_owner_for_wa(work_allocation_id: str, tenant_id: str) -> str | None:
    """Retourne l'owner_resource_id du projet d'une work_allocation (WA→task→project)."""
    wa = await db.work_allocations.find_one(
        {"work_allocation_id": work_allocation_id}, {"_id": 0, "task_id": 1}
    )
    if not wa or not wa.get("task_id"):
        return None
    task = await db.tasks.find_one(
        {"task_id": wa["task_id"]}, {"_id": 0, "project_id": 1}
    )
    if not task:
        return None
    proj = await db.projects.find_one(
        {"project_id": task["project_id"], "tenant_id": tenant_id},
        {"_id": 0, "owner_resource_id": 1},
    )
    return proj.get("owner_resource_id") if proj else None


async def _get_resources_to_validate_as_valideur(
    my_resource_id: str, tenant_id: str
) -> list[str]:
    """Retourne les resource_ids dont l'utilisateur courant est le valideur."""
    # 1. Ressources avec validator_resource_id explicite = moi
    explicit = await db.resources.find(
        {"validator_resource_id": my_resource_id, "tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1},
    ).to_list(None)
    explicit_ids = {r["resource_id"] for r in explicit}

    # 2. Ressources dans mes équipes sans validator_resource_id explicite
    my_teams = await db.teams.find(
        {"manager_resource_id": my_resource_id, "tenant_id": tenant_id},
        {"_id": 0, "team_id": 1},
    ).to_list(None)
    team_ids = [t["team_id"] for t in my_teams]
    implicit_ids = set()
    if team_ids:
        implicit_docs = await db.resources.find(
            {
                "team_id": {"$in": team_ids},
                "$or": [
                    {"validator_resource_id": {"$exists": False}},
                    {"validator_resource_id": None},
                ],
                "tenant_id": tenant_id,
                "resource_id": {"$ne": my_resource_id},  # pas soi-même
            },
            {"_id": 0, "resource_id": 1},
        ).to_list(None)
        implicit_ids = {r["resource_id"] for r in implicit_docs}

    return list(explicit_ids | implicit_ids)


# ─── S3-01  Grille de saisie ────────────────────────────────────────────────

async def get_grid(resource_id: str, week_start: str, current_user: TokenPayload) -> dict:
    resource = await _resource(resource_id, current_user.tenant_id)
    days = _week_days(week_start)
    daily_cap = _daily_cap(resource)

    work_allocs = await db.work_allocations.find(
        {"resource_id": resource_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)

    task_map, proj_map = await _enrich_was(work_allocs)

    ts_docs = await db.timesheets.find(
        {"resource_id": resource_id, "date": {"$in": days}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)
    entry_map: dict = {}
    for ts in ts_docs:
        entry_map.setdefault(ts["work_allocation_id"], {})[ts["date"]] = ts

    rows, day_totals = [], {d: 0.0 for d in days}
    for wa in work_allocs:
        waid = wa["work_allocation_id"]
        task = task_map.get(wa.get("task_id", ""), {})
        proj = proj_map.get(task.get("project_id", ""), {})
        entries, week_total = {}, 0.0
        for d in days:
            ts = entry_map.get(waid, {}).get(d)
            if ts:
                jh = ts.get("jh_value", 0) or 0
                entries[d] = {
                    "timesheet_id": ts["timesheet_id"],
                    "jh_value": jh,
                    "status": ts.get("status", "draft"),
                    "rejection_reason": ts.get("rejection_reason"),
                }
            else:
                entries[d] = {"timesheet_id": None, "jh_value": 0, "status": None, "rejection_reason": None}
            week_total    += entries[d]["jh_value"]
            day_totals[d] += entries[d]["jh_value"]
        rows.append({
            "work_allocation_id": waid,
            "project_id":   proj.get("project_id", ""),
            "project_name": proj.get("name", "?"),
            "task_name":    task.get("name", "?"),
            "phase":        wa.get("phase", "—"),
            "status_rag":   proj.get("status_rag", "green"),
            "planned_md":   wa.get("planned_md", 0),
            "entries":      entries,
            "week_total":   round(week_total, 1),
        })
    rows.sort(key=lambda x: x["project_name"])

    can_submit = any(
        e.get("status") in ("draft", "rejected") and e.get("jh_value", 0) > 0
        for row in rows for e in row["entries"].values()
    )
    return {
        "resource_id":      resource_id,
        "resource_name":    resource.get("name", "?"),
        "daily_cap_jh":     daily_cap,
        "days":             days,
        "rows":             rows,
        "day_totals":       {d: round(v, 1) for d, v in day_totals.items()},
        "week_grand_total": round(sum(day_totals.values()), 1),
        "can_submit":       can_submit,
    }


# ─── S3-01  Upsert entrée (auto-draft) ──────────────────────────────────────

async def upsert_entry(data: TimesheetEntryUpsert, current_user: TokenPayload) -> dict:
    require_write(current_user)
    resource = await _resource(data.resource_id, current_user.tenant_id)

    wa = await db.work_allocations.find_one(
        {"work_allocation_id": data.work_allocation_id,
         "resource_id": data.resource_id,
         "tenant_id": current_user.tenant_id},
        {"_id": 0},
    )
    if not wa:
        raise HTTPException(status_code=404, detail="Allocation introuvable")

    daily_cap = _daily_cap(resource)
    if data.jh_value > daily_cap:
        raise HTTPException(
            status_code=422,
            detail=f"JH saisi ({data.jh_value}) dépasse la capacité journalière ({daily_cap:.1f} JH)",
        )

    existing = await db.timesheets.find_one(
        {"resource_id": data.resource_id, "work_allocation_id": data.work_allocation_id,
         "date": data.date, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    )
    if existing:
        if existing.get("status") in ("submitted", "cp_reviewed", "validated"):
            raise HTTPException(status_code=422, detail="Entrée déjà soumise ou en cours de validation")
        await db.timesheets.update_one(
            {"timesheet_id": existing["timesheet_id"]},
            {"$set": {
                "jh_value": data.jh_value,
                "status": "draft",            # rejected → draft upon edit
                "rejection_reason": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {**existing, "jh_value": data.jh_value, "status": "draft", "rejection_reason": None}

    doc = {
        "timesheet_id":       str(uuid.uuid4()),
        "tenant_id":          current_user.tenant_id,
        "resource_id":        data.resource_id,
        "work_allocation_id": data.work_allocation_id,
        "date":               data.date,
        "jh_value":           data.jh_value,
        "status":             "draft",
        "accounted":          False,
        "submitted_at":       None,
        "cp_reviewed_at":     None,
        "validated_at":       None,
        "validated_by":       None,
        "rejection_reason":   None,
        "modified_by":        None,
        "modified_at":        None,
        "modification_reason": None,
        "created_at":         datetime.now(timezone.utc).isoformat(),
    }
    await db.timesheets.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ─── S3-01  Soumettre la semaine ─────────────────────────────────────────────

async def submit_week(data: TimesheetSubmitWeek, current_user: TokenPayload) -> dict:
    require_write(current_user)
    days = _week_days(data.week_start)
    now  = datetime.now(timezone.utc).isoformat()
    # draft ET rejected peuvent être (re)soumis
    result = await db.timesheets.update_many(
        {"resource_id": data.resource_id, "date": {"$in": days},
         "status": {"$in": ["draft", "rejected"]}, "jh_value": {"$gt": 0},
         "tenant_id": current_user.tenant_id},
        {"$set": {
            "status": "submitted",
            "submitted_at": now,
            "rejection_reason": None,
            "cp_reviewed_at": None,
        }},
    )
    return {"submitted": result.modified_count}


# ─── S3-02  Compteur badge sidebar (contextuel) ──────────────────────────────

async def get_pending_count(current_user: TokenPayload) -> int:
    if current_user.role in ("TENANT_ADMIN", "PMO_USER"):
        return await db.timesheets.count_documents(
            {"tenant_id": current_user.tenant_id,
             "status": {"$in": ["submitted", "cp_reviewed"]}}
        )
    if not current_user.resource_id:
        return 0
    # Compter les timesheets "submitted" dont je suis le valideur
    my_rid = current_user.resource_id
    to_validate_rids = await _get_resources_to_validate_as_valideur(
        my_rid, current_user.tenant_id
    )
    count_valideur = await db.timesheets.count_documents(
        {"tenant_id": current_user.tenant_id,
         "status": "submitted",
         "resource_id": {"$in": to_validate_rids}}
    ) if to_validate_rids else 0

    # Compter les timesheets "cp_reviewed" pour mes projets
    my_projects = await db.projects.find(
        {"owner_resource_id": my_rid, "tenant_id": current_user.tenant_id},
        {"_id": 0, "project_id": 1},
    ).to_list(None)
    count_cp = 0
    if my_projects:
        proj_ids = {p["project_id"] for p in my_projects}
        all_wa = await db.work_allocations.find(
            {"tenant_id": current_user.tenant_id}, {"_id": 0, "work_allocation_id": 1, "task_id": 1}
        ).to_list(None)
        all_tasks = await db.tasks.find(
            {"project_id": {"$in": list(proj_ids)}},
            {"_id": 0, "task_id": 1, "project_id": 1},
        ).to_list(None)
        task_to_proj = {t["task_id"]: t["project_id"] for t in all_tasks}
        my_wa_ids = [
            wa["work_allocation_id"]
            for wa in all_wa
            if task_to_proj.get(wa.get("task_id", ""), "") in proj_ids
        ]
        if my_wa_ids:
            count_cp = await db.timesheets.count_documents(
                {"tenant_id": current_user.tenant_id,
                 "status": "cp_reviewed",
                 "work_allocation_id": {"$in": my_wa_ids}}
            )

    return count_valideur + count_cp


# ─── Helpers : construction groupes ─────────────────────────────────────────

async def _build_groups(
    ts_list: list,
    extra_label: str | None = None,
) -> list:
    """Construit les groupes (resource × semaine) depuis une liste de timesheets."""
    if not ts_list:
        return []

    r_ids  = list({ts["resource_id"] for ts in ts_list})
    wa_ids = list({ts["work_allocation_id"] for ts in ts_list})

    resources = await db.resources.find(
        {"resource_id": {"$in": r_ids}}, {"_id": 0, "resource_id": 1, "name": 1}
    ).to_list(None)
    res_map = {r["resource_id"]: r["name"] for r in resources}

    work_allocs = await db.work_allocations.find(
        {"work_allocation_id": {"$in": wa_ids}}, {"_id": 0}
    ).to_list(None)
    wa_map = {wa["work_allocation_id"]: wa for wa in work_allocs}
    task_map, proj_map = await _enrich_was(work_allocs)

    groups: dict = defaultdict(lambda: {
        "ts_ids": [], "entries": [],
        "total_jh": 0.0, "projects": set(),
    })
    for ts in ts_list:
        rid = ts["resource_id"]
        d   = date.fromisoformat(ts["date"])
        week_mon = (d - timedelta(days=d.weekday())).isoformat()
        key = f"{rid}_{week_mon}"
        wa  = wa_map.get(ts["work_allocation_id"], {})
        task = task_map.get(wa.get("task_id", ""), {})
        p    = proj_map.get(task.get("project_id", ""), {})

        g = groups[key]
        g["resource_id"]   = rid
        g["resource_name"] = res_map.get(rid, rid)
        g["week_start"]    = week_mon
        g["status"]        = ts.get("status", "submitted")
        g["cp_reviewed_at"] = ts.get("cp_reviewed_at")
        g["ts_ids"].append(ts["timesheet_id"])
        g["entries"].append({
            "timesheet_id":       ts["timesheet_id"],
            "work_allocation_id": ts["work_allocation_id"],
            "project_name":       p.get("name", "?"),
            "project_id":         p.get("project_id", ""),
            "task_name":          task.get("name", "?"),
            "phase":              wa.get("phase", "—"),
            "date":               ts["date"],
            "jh_value":           ts.get("jh_value", 0),
            "status":             ts.get("status"),
        })
        g["projects"].add(p.get("name", "?"))
        g["total_jh"] = round(g["total_jh"] + (ts.get("jh_value") or 0), 1)

    result = []
    for g in groups.values():
        g["project_names"] = list(g.pop("projects"))
        wd = _working_days_since(g.get("cp_reviewed_at"))
        g["timeout"] = (g["status"] == "cp_reviewed" and wd > CP_TIMEOUT_DAYS)
        g["timeout_days"] = wd if g["status"] == "cp_reviewed" else 0
        result.append(g)

    result.sort(key=lambda x: (x["week_start"], x["resource_name"]))
    return result


# ─── S3-02  Vue validation (3 vues : valideur / cp / pmo) ───────────────────

async def get_validation_view(
    view: str, week_start: str | None, current_user: TokenPayload
) -> list:
    if current_user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    tenant = current_user.tenant_id
    my_rid = current_user.resource_id

    # ── Vue PMO/Admin : tout voir ─────────────────────────────────────────────
    if view == "pmo":
        if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
            raise HTTPException(status_code=403, detail="Réservé PMO/Admin")
        query: dict = {
            "tenant_id": tenant,
            "status": {"$in": ["submitted", "cp_reviewed"]},
        }
        if week_start:
            query["date"] = {"$in": _week_days(week_start)}
        ts_list = await db.timesheets.find(query, {"_id": 0}).to_list(None)
        return await _build_groups(ts_list)

    # ── Vue Valideur : timesheets submitted dont je suis le N+1 ──────────────
    if view == "valideur":
        if not my_rid:
            return []
        resource_ids = await _get_resources_to_validate_as_valideur(my_rid, tenant)
        # PMO/Admin voit tout en mode valideur aussi
        if current_user.role in ("TENANT_ADMIN", "PMO_USER") and not resource_ids:
            resource_ids = []  # ils ont accès PMO, pas besoin
        if not resource_ids:
            return []
        query = {
            "tenant_id": tenant,
            "status": "submitted",
            "resource_id": {"$in": resource_ids},
        }
        if week_start:
            query["date"] = {"$in": _week_days(week_start)}
        ts_list = await db.timesheets.find(query, {"_id": 0}).to_list(None)
        return await _build_groups(ts_list)

    # ── Vue CP : timesheets cp_reviewed sur mes projets ───────────────────────
    if view == "cp":
        if not my_rid:
            return []
        my_projects = await db.projects.find(
            {"owner_resource_id": my_rid, "tenant_id": tenant},
            {"_id": 0, "project_id": 1},
        ).to_list(None)
        if not my_projects:
            return []
        proj_ids = {p["project_id"] for p in my_projects}

        # Trouver les work_allocation_ids pour ces projets
        all_tasks = await db.tasks.find(
            {"project_id": {"$in": list(proj_ids)}},
            {"_id": 0, "task_id": 1, "project_id": 1},
        ).to_list(None)
        task_ids = [t["task_id"] for t in all_tasks]
        if not task_ids:
            return []

        wa_docs = await db.work_allocations.find(
            {"task_id": {"$in": task_ids}, "tenant_id": tenant},
            {"_id": 0, "work_allocation_id": 1},
        ).to_list(None)
        wa_ids = [w["work_allocation_id"] for w in wa_docs]
        if not wa_ids:
            return []

        query = {
            "tenant_id": tenant,
            "status": "cp_reviewed",
            "work_allocation_id": {"$in": wa_ids},
        }
        if week_start:
            query["date"] = {"$in": _week_days(week_start)}
        ts_list = await db.timesheets.find(query, {"_id": 0}).to_list(None)
        return await _build_groups(ts_list)

    raise HTTPException(status_code=400, detail=f"Vue invalide : {view}")


# ─── S3-02+S3-03  Validation avec transitions RBAC ──────────────────────────

async def validate_timesheets(data: TimesheetValidateRequest, current_user: TokenPayload) -> dict:
    if current_user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    ts_list = await db.timesheets.find(
        {"timesheet_id": {"$in": data.timesheet_ids}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)
    if not ts_list:
        raise HTTPException(status_code=404, detail="Aucun timesheet trouvé")

    now = datetime.now(timezone.utc).isoformat()
    is_pmo = current_user.role in ("TENANT_ADMIN", "PMO_USER")

    advanced_to_cp  = []   # submitted → cp_reviewed
    validated_ids   = []   # cp_reviewed → validated (ou bypass PMO)
    wa_increments: dict = {}

    for ts in ts_list:
        status = ts.get("status")

        # ── PMO/Admin bypass : tout → validated ──────────────────────────────
        if is_pmo:
            if status in ("submitted", "cp_reviewed"):
                validated_ids.append(ts["timesheet_id"])
                if not ts.get("accounted"):
                    waid = ts["work_allocation_id"]
                    wa_increments[waid] = wa_increments.get(waid, 0) + (ts.get("jh_value") or 0)
            continue

        # ── Valideur N+1 : submitted → cp_reviewed ───────────────────────────
        if status == "submitted":
            if not current_user.resource_id:
                raise HTTPException(status_code=403, detail="Compte non lié à une ressource")
            validator_id = await _get_validator_for_resource(ts["resource_id"], current_user.tenant_id)
            if validator_id != current_user.resource_id:
                raise HTTPException(
                    status_code=403,
                    detail=f"Vous n'êtes pas le valideur de la ressource {ts['resource_id']}",
                )
            advanced_to_cp.append(ts["timesheet_id"])
            continue

        # ── Chef de Projet : cp_reviewed → validated ──────────────────────────
        if status == "cp_reviewed":
            if not current_user.resource_id:
                raise HTTPException(status_code=403, detail="Compte non lié à une ressource")
            project_owner = await _get_project_owner_for_wa(
                ts["work_allocation_id"], current_user.tenant_id
            )
            if project_owner != current_user.resource_id:
                raise HTTPException(
                    status_code=403,
                    detail="Vous n'êtes pas le Chef de Projet de cette allocation",
                )
            validated_ids.append(ts["timesheet_id"])
            if not ts.get("accounted"):
                waid = ts["work_allocation_id"]
                wa_increments[waid] = wa_increments.get(waid, 0) + (ts.get("jh_value") or 0)
            continue

        # Statut non géré
        raise HTTPException(
            status_code=422,
            detail=f"Transition invalide depuis le statut '{status}'",
        )

    # ── Mise à jour submitted → cp_reviewed ───────────────────────────────────
    if advanced_to_cp:
        await db.timesheets.update_many(
            {"timesheet_id": {"$in": advanced_to_cp}},
            {"$set": {
                "status": "cp_reviewed",
                "cp_reviewed_at": now,
                "modified_by": current_user.resource_id,
                "modified_at": now,
            }},
        )

    # ── Mise à jour cp_reviewed → validated ───────────────────────────────────
    if validated_ids:
        # Incrémenter consumed_md
        for waid, jh_sum in wa_increments.items():
            if jh_sum > 0:
                await db.work_allocations.update_one(
                    {"work_allocation_id": waid},
                    {"$inc": {"consumed_md": round(jh_sum, 2)}},
                )
        await db.timesheets.update_many(
            {"timesheet_id": {"$in": validated_ids}},
            {"$set": {
                "status": "validated",
                "validated_at": now,
                "validated_by": current_user.user_id,
                "accounted": True,
            }},
        )

    return {
        "advanced_to_cp_reviewed": len(advanced_to_cp),
        "validated": len(validated_ids),
    }


# ─── S3-02+S3-03  Rejet → retour en draft ───────────────────────────────────

async def reject_timesheets(data: TimesheetRejectRequest, current_user: TokenPayload) -> dict:
    if current_user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")
    if not data.rejection_reason.strip():
        raise HTTPException(status_code=422, detail="Le motif de rejet est obligatoire")

    ts_list = await db.timesheets.find(
        {"timesheet_id": {"$in": data.timesheet_ids}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)

    now = datetime.now(timezone.utc).isoformat()
    ids_to_reject = []

    for ts in ts_list:
        if ts.get("status") not in ("submitted", "cp_reviewed"):
            continue

        # Vérification droits : PMO/Admin toujours autorisé
        if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
            if not current_user.resource_id:
                raise HTTPException(status_code=403, detail="Compte non lié à une ressource")
            # Valideur peut rejeter submitted
            if ts.get("status") == "submitted":
                validator_id = await _get_validator_for_resource(
                    ts["resource_id"], current_user.tenant_id
                )
                if validator_id != current_user.resource_id:
                    raise HTTPException(status_code=403, detail="Droits insuffisants pour ce rejet")
            # CP peut rejeter cp_reviewed
            elif ts.get("status") == "cp_reviewed":
                owner_id = await _get_project_owner_for_wa(
                    ts["work_allocation_id"], current_user.tenant_id
                )
                if owner_id != current_user.resource_id:
                    raise HTTPException(status_code=403, detail="Droits insuffisants pour ce rejet")

        ids_to_reject.append(ts["timesheet_id"])

    if not ids_to_reject:
        raise HTTPException(status_code=422, detail="Aucun timesheet rejectable trouvé")

    # Retour en draft avec motif visible
    await db.timesheets.update_many(
        {"timesheet_id": {"$in": ids_to_reject}},
        {"$set": {
            "status": "draft",
            "rejection_reason": data.rejection_reason,
            "modified_by": current_user.resource_id or current_user.user_id,
            "modified_at": now,
            "modification_reason": data.rejection_reason,
            "cp_reviewed_at": None,
        }},
    )
    return {"rejected": len(ids_to_reject)}


# ─── S3-04  Rapport de temps ─────────────────────────────────────────────────

async def get_report(
    dimension: str, start: str, end: str, current_user: TokenPayload,
    project_id: str | None = None, team_id: str | None = None,
) -> list:
    ts_list = await db.timesheets.find(
        {"tenant_id": current_user.tenant_id, "status": "validated",
         "date": {"$gte": start, "$lte": end}},
        {"_id": 0},
    ).to_list(None)
    if not ts_list:
        return []

    wa_ids = list({ts["work_allocation_id"] for ts in ts_list})
    r_ids  = list({ts["resource_id"] for ts in ts_list})

    work_allocs = await db.work_allocations.find(
        {"work_allocation_id": {"$in": wa_ids}}, {"_id": 0}
    ).to_list(None)
    wa_map = {wa["work_allocation_id"]: wa for wa in work_allocs}
    task_map, proj_map = await _enrich_was(work_allocs)

    resources = await db.resources.find(
        {"resource_id": {"$in": r_ids}},
        {"_id": 0, "resource_id": 1, "name": 1, "team_id": 1},
    ).to_list(None)
    res_map = {r["resource_id"]: r for r in resources}

    agg: dict = defaultdict(lambda: defaultdict(float))
    labels: dict = {}

    for ts in ts_list:
        wa   = wa_map.get(ts["work_allocation_id"], {})
        task = task_map.get(wa.get("task_id", ""), {})
        proj = proj_map.get(task.get("project_id", ""), {})
        res  = res_map.get(ts["resource_id"], {})

        if project_id and task.get("project_id") != project_id:
            continue
        if team_id and res.get("team_id") != team_id:
            continue

        d    = date.fromisoformat(ts["date"])
        week = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"

        if dimension == "resource":
            key = ts["resource_id"]
            labels[key] = res.get("name", key)
        elif dimension == "team":
            key = res.get("team_id") or "__aucune__"
            labels[key] = key
        else:
            key = task.get("project_id", "__inconnu__")
            labels[key] = proj.get("name", key)

        agg[key][week] += ts.get("jh_value", 0)

    all_weeks = sorted({w for vals in agg.values() for w in vals})
    result = []
    for dim_id, week_vals in agg.items():
        result.append({
            "dimension_id":    dim_id,
            "dimension_label": labels.get(dim_id, dim_id),
            "periods":         {w: round(week_vals.get(w, 0), 1) for w in all_weeks},
            "total_jh":        round(sum(week_vals.values()), 1),
        })
    result.sort(key=lambda x: -x["total_jh"])
    return result


async def get_report_csv(
    dimension: str, start: str, end: str, current_user: TokenPayload,
    project_id: str | None = None, team_id: str | None = None,
) -> str:
    rows = await get_report(dimension, start, end, current_user, project_id, team_id)
    if not rows:
        return "Dimension,Semaine,JH validés\n"
    buf = io.StringIO()
    writer = csv_mod.writer(buf)
    writer.writerow(["Dimension", "Semaine", "JH validés"])
    for r in rows:
        for week, jh in sorted(r["periods"].items()):
            writer.writerow([r["dimension_label"], week, jh])
    return buf.getvalue()
