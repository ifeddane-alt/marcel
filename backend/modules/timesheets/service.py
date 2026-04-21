"""Service Timesheets — S3-01 à S3-04."""
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

# ─── helpers ────────────────────────────────────────────────────────────────

def _week_days(week_start: str) -> list[str]:
    """Renvoie les 5 jours Lun–Ven de la semaine contenant week_start."""
    d = date.fromisoformat(week_start)
    d -= timedelta(days=d.weekday())   # recale sur le lundi
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
    """Retourne (task_map, proj_map) depuis une liste de work_allocations."""
    task_ids = list({wa["task_id"] for wa in wa_list if wa.get("task_id")})
    tasks = await db.tasks.find(
        {"task_id": {"$in": task_ids}},
        {"_id": 0, "task_id": 1, "name": 1, "project_id": 1},
    ).to_list(None) if task_ids else []
    task_map = {t["task_id"]: t for t in tasks}

    proj_ids = list({t["project_id"] for t in tasks})
    projects = await db.projects.find(
        {"project_id": {"$in": proj_ids}},
        {"_id": 0, "project_id": 1, "name": 1, "status_rag": 1},
    ).to_list(None) if proj_ids else []
    proj_map = {p["project_id"]: p for p in projects}
    return task_map, proj_map


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
                entries[d] = {"timesheet_id": ts["timesheet_id"], "jh_value": jh,
                               "status": ts.get("status", "draft")}
            else:
                entries[d] = {"timesheet_id": None, "jh_value": 0, "status": None}
            week_total      += entries[d]["jh_value"]
            day_totals[d]   += entries[d]["jh_value"]
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
        e.get("status") == "draft" and e.get("jh_value", 0) > 0
        for row in rows for e in row["entries"].values()
    )
    return {
        "resource_id":       resource_id,
        "resource_name":     resource.get("name", "?"),
        "daily_cap_jh":      daily_cap,
        "days":              days,
        "rows":              rows,
        "day_totals":        {d: round(v, 1) for d, v in day_totals.items()},
        "week_grand_total":  round(sum(day_totals.values()), 1),
        "can_submit":        can_submit,
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
        if existing.get("status") in ("submitted", "validated"):
            raise HTTPException(status_code=422, detail="Entrée déjà soumise ou validée")
        await db.timesheets.update_one(
            {"timesheet_id": existing["timesheet_id"]},
            {"$set": {"jh_value": data.jh_value, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )
        return {**existing, "jh_value": data.jh_value}

    doc = {
        "timesheet_id":     str(uuid.uuid4()),
        "tenant_id":        current_user.tenant_id,
        "resource_id":      data.resource_id,
        "work_allocation_id": data.work_allocation_id,
        "date":             data.date,
        "jh_value":         data.jh_value,
        "status":           "draft",
        "accounted":        False,
        "submitted_at":     None,
        "validated_at":     None,
        "validated_by":     None,
        "rejection_reason": None,
        "created_at":       datetime.now(timezone.utc).isoformat(),
    }
    await db.timesheets.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ─── S3-01  Soumettre la semaine ────────────────────────────────────────────

async def submit_week(data: TimesheetSubmitWeek, current_user: TokenPayload) -> dict:
    require_write(current_user)
    days = _week_days(data.week_start)
    now  = datetime.now(timezone.utc).isoformat()
    result = await db.timesheets.update_many(
        {"resource_id": data.resource_id, "date": {"$in": days},
         "status": "draft", "jh_value": {"$gt": 0},
         "tenant_id": current_user.tenant_id},
        {"$set": {"status": "submitted", "submitted_at": now}},
    )
    return {"submitted": result.modified_count}


# ─── S3-02  Compteur badge sidebar ──────────────────────────────────────────

async def get_pending_count(current_user: TokenPayload) -> int:
    return await db.timesheets.count_documents(
        {"tenant_id": current_user.tenant_id, "status": "submitted"}
    )


# ─── S3-02  Vue validation manager ──────────────────────────────────────────

async def get_validation_view(week_start: str | None, current_user: TokenPayload) -> list:
    if current_user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    query: dict = {"tenant_id": current_user.tenant_id, "status": "submitted"}
    if week_start:
        query["date"] = {"$in": _week_days(week_start)}

    ts_list = await db.timesheets.find(query, {"_id": 0}).to_list(None)
    if not ts_list:
        return []

    r_ids  = list({ts["resource_id"] for ts in ts_list})
    wa_ids = list({ts["work_allocation_id"] for ts in ts_list})

    resources  = await db.resources.find(
        {"resource_id": {"$in": r_ids}}, {"_id": 0, "resource_id": 1, "name": 1}
    ).to_list(None)
    res_map = {r["resource_id"]: r["name"] for r in resources}

    work_allocs = await db.work_allocations.find(
        {"work_allocation_id": {"$in": wa_ids}}, {"_id": 0}
    ).to_list(None)
    wa_map = {wa["work_allocation_id"]: wa for wa in work_allocs}
    task_map, proj_map = await _enrich_was(work_allocs)

    groups: dict = defaultdict(lambda: {"ts_ids": [], "entries": [], "total_jh": 0.0})
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
        g["ts_ids"].append(ts["timesheet_id"])
        g["entries"].append({
            "timesheet_id":      ts["timesheet_id"],
            "work_allocation_id": ts["work_allocation_id"],
            "project_name":      p.get("name", "?"),
            "task_name":         task.get("name", "?"),
            "phase":             wa.get("phase", "—"),
            "date":              ts["date"],
            "jh_value":          ts.get("jh_value", 0),
        })
        g["total_jh"] = round(g["total_jh"] + (ts.get("jh_value") or 0), 1)

    result = list(groups.values())
    result.sort(key=lambda x: (x["week_start"], x["resource_name"]))
    return result


# ─── S3-02 + S3-03  Validation (avec alimentation consumed_md) ──────────────

async def validate_timesheets(data: TimesheetValidateRequest, current_user: TokenPayload) -> dict:
    if current_user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")

    ts_list = await db.timesheets.find(
        {"timesheet_id": {"$in": data.timesheet_ids}, "tenant_id": current_user.tenant_id},
        {"_id": 0},
    ).to_list(None)
    to_validate = [ts for ts in ts_list if ts.get("status") == "submitted"]
    if not to_validate:
        raise HTTPException(status_code=422, detail="Aucun timesheet soumis trouvé")

    # S3-03 : incrémenter consumed_md pour les non-comptabilisés
    wa_increments: dict = {}
    for ts in to_validate:
        if not ts.get("accounted"):
            waid = ts["work_allocation_id"]
            wa_increments[waid] = wa_increments.get(waid, 0) + (ts.get("jh_value") or 0)

    for waid, jh_sum in wa_increments.items():
        if jh_sum > 0:
            await db.work_allocations.update_one(
                {"work_allocation_id": waid},
                {"$inc": {"consumed_md": round(jh_sum, 2)}},
            )

    now = datetime.now(timezone.utc).isoformat()
    ids = [ts["timesheet_id"] for ts in to_validate]
    await db.timesheets.update_many(
        {"timesheet_id": {"$in": ids}},
        {"$set": {"status": "validated", "validated_at": now,
                  "validated_by": current_user.user_id, "accounted": True}},
    )
    return {"validated": len(ids)}


# ─── S3-02 + S3-03  Rejet (avec décrement si comptabilisé) ─────────────────

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
    # S3-03 : décrémenter si déjà comptabilisé
    for ts in ts_list:
        if ts.get("accounted"):
            jh = ts.get("jh_value") or 0
            if jh > 0:
                await db.work_allocations.update_one(
                    {"work_allocation_id": ts["work_allocation_id"]},
                    {"$inc": {"consumed_md": -round(jh, 2)}},
                )

    ids = [ts["timesheet_id"] for ts in ts_list]
    await db.timesheets.update_many(
        {"timesheet_id": {"$in": ids}},
        {"$set": {"status": "rejected", "rejection_reason": data.rejection_reason,
                  "validated_at": now, "validated_by": current_user.user_id, "accounted": False}},
    )
    return {"rejected": len(ids)}


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

    wa_ids  = list({ts["work_allocation_id"] for ts in ts_list})
    r_ids   = list({ts["resource_id"] for ts in ts_list})

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

        # Filter optionnel
        if project_id and task.get("project_id") != project_id:
            continue
        if team_id and res.get("team_id") != team_id:
            continue

        # Période = semaine ISO YYYY-Www
        d    = date.fromisoformat(ts["date"])
        week = f"{d.isocalendar()[0]}-W{d.isocalendar()[1]:02d}"

        if dimension == "resource":
            key = ts["resource_id"]
            labels[key] = res.get("name", key)
        elif dimension == "team":
            key = res.get("team_id") or "__aucune__"
            labels[key] = key
        else:  # project
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
