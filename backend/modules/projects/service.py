from fastapi import HTTPException
from datetime import datetime, timezone
import asyncio
import re
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


async def get_consistency_alerts(current_user: TokenPayload) -> list:
    """Projets dont les chiffres déclarés (JH) divergent de la somme des tâches (>10 % et ≥5 JH)."""
    query: dict = {"tenant_id": current_user.tenant_id, "status": {"$nin": ["cloture", "archive"]}}
    if is_ownership_restricted(current_user, "projects.view_own"):
        query["owner_id"] = current_user.user_id
    projects = await db.projects.find(
        query, {"_id": 0, "project_id": 1, "name": 1, "code": 1, "jh_planned": 1, "jh_consumed": 1}
    ).to_list(None)
    pids = [p["project_id"] for p in projects]
    if not pids:
        return []
    sums = await db.tasks.aggregate([
        {"$match": {"project_id": {"$in": pids}}},
        {"$group": {"_id": "$project_id",
                    "jh_planned": {"$sum": {"$ifNull": ["$jh_planned", 0]}},
                    "jh_consumed": {"$sum": {"$ifNull": ["$jh_consumed", 0]}},
                    "n": {"$sum": 1}}},
    ]).to_list(None)
    by_pid = {s["_id"]: s for s in sums}
    alerts = []
    for p in projects:
        t = by_pid.get(p["project_id"])
        if not t or t["n"] == 0:
            continue
        gaps = []
        for field, label in (("jh_consumed", "JH consommés"), ("jh_planned", "JH prévus")):
            declared = p.get(field) or 0
            tasks_sum = round(t[field], 1)
            base = max(declared, tasks_sum)
            diff = abs(declared - tasks_sum)
            if base > 0 and diff >= 5 and diff / base > 0.10:
                gaps.append({"field": field, "label": label, "declared": declared,
                             "tasks_sum": tasks_sum, "gap_pct": round(diff / base * 100)})
        if gaps:
            alerts.append({"project_id": p["project_id"], "name": p["name"], "code": p.get("code"),
                           "task_count": t["n"], "gaps": gaps,
                           "max_gap_pct": max(g["gap_pct"] for g in gaps)})
    alerts.sort(key=lambda a: -a["max_gap_pct"])
    return alerts


async def get_project(project_id: str, current_user: TokenPayload) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    return project


# ─── Codification projet (préfixe par programme, séquentiel, anti-doublon) ──

async def _get_code_config(tenant_id: str) -> dict:
    tenant = await db.tenants.find_one(
        {"tenant_id": tenant_id}, {"_id": 0, "settings.project_codes": 1}
    )
    cfg = ((tenant or {}).get("settings") or {}).get("project_codes") or {}
    return {
        "default_prefix": (cfg.get("default_prefix") or "PRJ").strip().upper(),
        "program_prefixes": cfg.get("program_prefixes") or {},
    }


def _prefix_for(cfg: dict, program_id) -> str:
    return (cfg["program_prefixes"].get(program_id or "") or cfg["default_prefix"]).strip().upper()


async def generate_project_code(tenant_id: str, program_id=None) -> str:
    cfg = await _get_code_config(tenant_id)
    prefix = _prefix_for(cfg, program_id)
    pattern = re.compile(rf"^{re.escape(prefix)}-(\d+)$")
    existing = await db.projects.find(
        {"tenant_id": tenant_id, "code": {"$regex": f"^{re.escape(prefix)}-"}},
        {"_id": 0, "code": 1},
    ).to_list(None)
    max_n = 0
    for e in existing:
        m = pattern.match(e.get("code") or "")
        if m:
            max_n = max(max_n, int(m.group(1)))
    return f"{prefix}-{max_n + 1:03d}"


async def backfill_codes(tenant_id: str) -> dict:
    """Génère un code pour tous les projets du tenant qui n'en ont pas encore."""
    cfg = await _get_code_config(tenant_id)
    projects = await db.projects.find({"tenant_id": tenant_id}, {"_id": 0}).sort("created_at", 1).to_list(None)
    counters: dict = {}
    for p in projects:
        m = re.match(r"^(.+)-(\d+)$", p.get("code") or "")
        if m:
            counters[m.group(1)] = max(counters.get(m.group(1), 0), int(m.group(2)))
    updated = 0
    for p in projects:
        if p.get("code"):
            continue
        prefix = _prefix_for(cfg, p.get("program_id"))
        counters[prefix] = counters.get(prefix, 0) + 1
        await db.projects.update_one(
            {"project_id": p["project_id"]},
            {"$set": {"code": f"{prefix}-{counters[prefix]:03d}"}},
        )
        updated += 1
    return {"updated": updated, "total": len(projects)}


async def create_project(data: ProjectCreate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    doc = data.model_dump()
    doc = _sync_budget_aggregates(doc)
    code = await generate_project_code(current_user.tenant_id, doc.get("program_id"))
    project = {
        "project_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **doc,
        "code": code,
        "budget_revision_history": [],
        "last_sync_at": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.projects.insert_one(project)
    project.pop("_id", None)
    # Fire webhook (non-bloquant)
    asyncio.create_task(_fire_project_webhook(current_user.tenant_id, "project.created", project))
    from core.audit import log_audit
    await log_audit(current_user, "created", "project", project["project_id"], project.get("name", ""))
    return project


async def update_project(project_id: str, data: ProjectUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    old = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not old:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data = _sync_budget_aggregates(update_data)
    await db.projects.update_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    # Fire webhook + alertes seuils (non-bloquant)
    asyncio.create_task(_fire_project_webhook(current_user.tenant_id, "project.updated", updated))
    asyncio.create_task(_check_budget_threshold(current_user.tenant_id, old, updated))
    from core.audit import log_audit, diff_changes
    changes = diff_changes(old, update_data)
    if changes:
        await log_audit(current_user, "updated", "project", project_id, updated.get("name", ""), changes)
    return updated


async def _fire_project_webhook(tenant_id: str, event: str, project: dict) -> None:
    """Fire-and-forget webhook + alerte email pour les événements projet."""
    try:
        from core.webhook import fire_webhook, get_tenant_webhook_url
        url = await get_tenant_webhook_url(tenant_id, event)
        if url:
            await fire_webhook(url, event, {
                "project_id": project.get("project_id"),
                "name": project.get("name"),
                "status": project.get("status"),
                "status_rag": project.get("status_rag"),
                "tenant_id": tenant_id,
            })
    except Exception:
        pass
    try:
        from core.email_alerts import send_project_event_email
        await send_project_event_email(tenant_id, event, project)
    except Exception:
        pass


async def _check_budget_threshold(tenant_id: str, old: dict, new: dict) -> None:
    """Alerte email si l'atterrissage franchit le seuil eac_ratio × budget total."""
    try:
        total = new.get("budget_total") or 0
        forecast = new.get("budget_forecast") or new.get("eac") or 0
        if not total or not forecast:
            return
        tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
        thresholds = ((tenant or {}).get("settings") or {}).get("thresholds") or {}
        ratio = thresholds.get("eac_ratio", 1.10)
        limit = total * ratio
        old_forecast = old.get("budget_forecast") or old.get("eac") or 0
        old_total = old.get("budget_total") or total
        was_over = old_forecast > old_total * ratio if old_total else False
        if forecast > limit and not was_over:
            from core.email_alerts import send_alert_email
            await send_alert_email(tenant_id, "threshold.budget_overrun", new.get("name", ""), [
                ("Projet", new.get("name", "—")),
                ("Budget total", f"{total:,.0f} €"),
                ("Atterrissage (EAC)", f"{forecast:,.0f} €"),
                ("Seuil", f"{limit:,.0f} € (ratio {ratio})"),
                ("Dépassement", f"+{forecast - total:,.0f} €"),
            ])
    except Exception:
        pass


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
    asyncio.create_task(_check_budget_threshold(current_user.tenant_id, project, updated))
    from core.audit import log_audit
    await log_audit(current_user, "budget_revised", "project", project_id, project.get("name", ""), [
        {"field": "eac", "old": old_eac, "new": data.eac},
        {"field": "motif", "old": "", "new": data.reason},
    ])
    return updated


async def delete_project(project_id: str, current_user: TokenPayload) -> None:
    if current_user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé au TENANT_ADMIN")
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}, {"_id": 0, "name": 1}
    )
    await db.tasks.delete_many({"project_id": project_id, "tenant_id": current_user.tenant_id})
    await db.milestones.delete_many({"project_id": project_id})
    await db.allocations.delete_many({"project_id": project_id})
    result = await db.projects.delete_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    from core.audit import log_audit
    await log_audit(current_user, "deleted", "project", project_id, (project or {}).get("name", ""))


# ─── Bénéfices / business case ───────────────────────────────────────────────

VALID_BENEFIT_CATEGORIES = ["financier", "productivite", "qualite", "conformite", "autre"]
VALID_BENEFIT_UNITS = ["EUR", "JH", "%", "autre"]


def _benefits_summary(benefits: list) -> dict:
    eur = [b for b in benefits if b.get("unit") == "EUR"]
    expected = sum(float(b.get("expected_value") or 0) for b in eur)
    realized = sum(float(b.get("realized_value") or 0) for b in eur)
    pct = round(realized / expected * 100) if expected > 0 else 0
    return {"count": len(benefits), "expected_eur": expected, "realized_eur": realized, "realization_pct": pct}


async def get_benefits(project_id: str, current_user: TokenPayload) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "benefits": 1, "name": 1, "budget_total": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    benefits = project.get("benefits") or []
    return {"benefits": benefits, "summary": _benefits_summary(benefits)}


async def set_benefits(project_id: str, benefits: list, current_user: TokenPayload) -> dict:
    require_write(current_user)
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "name": 1, "benefits": 1},
    )
    if not project:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    cleaned = []
    for b in benefits or []:
        label = (b.get("label") or "").strip()
        if not label:
            raise HTTPException(status_code=422, detail="Chaque bénéfice doit avoir un libellé")
        category = b.get("category") or "financier"
        if category not in VALID_BENEFIT_CATEGORIES:
            raise HTTPException(status_code=422, detail=f"Catégorie invalide: {category}")
        unit = b.get("unit") or "EUR"
        if unit not in VALID_BENEFIT_UNITS:
            raise HTTPException(status_code=422, detail=f"Unité invalide: {unit}")
        try:
            expected_value = float(b.get("expected_value") or 0)
            realized_value = float(b.get("realized_value") or 0)
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="Valeurs de bénéfice invalides")
        cleaned.append({
            "benefit_id": b.get("benefit_id") or str(uuid.uuid4()),
            "label": label,
            "category": category,
            "unit": unit,
            "expected_value": expected_value,
            "realized_value": realized_value,
            "horizon": b.get("horizon") or "",
            "comment": b.get("comment") or "",
        })
    await db.projects.update_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id},
        {"$set": {"benefits": cleaned}},
    )
    from core.audit import log_audit
    old_count = len(project.get("benefits") or [])
    await log_audit(current_user, "benefits_updated", "project", project_id, project.get("name", ""), [
        {"field": "bénéfices", "old": f"{old_count} élément(s)", "new": f"{len(cleaned)} élément(s)"},
    ])
    return {"benefits": cleaned, "summary": _benefits_summary(cleaned)}


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


# ─── Champs personnalisés ────────────────────────────────────────────────────

_CUSTOM_FIELD_TYPES = ("text", "number", "date", "select")


async def get_custom_field_defs(tenant_id: str) -> list:
    t = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings.custom_fields": 1})
    return ((t or {}).get("settings") or {}).get("custom_fields") or []


async def set_custom_field_defs(fields: list, user: TokenPayload) -> list:
    clean = []
    for f in fields or []:
        label = (f.get("label") or "").strip()
        if not label:
            continue
        ftype = f.get("type") if f.get("type") in _CUSTOM_FIELD_TYPES else "text"
        clean.append({
            "key": f.get("key") or str(uuid.uuid4())[:8],
            "label": label,
            "type": ftype,
            "options": [o for o in (f.get("options") or []) if o] if ftype == "select" else [],
        })
    await db.tenants.update_one({"tenant_id": user.tenant_id}, {"$set": {"settings.custom_fields": clean}})
    from core.audit import log_audit
    await log_audit(user, "updated", "custom_fields", user.tenant_id, "Champs personnalisés projets")
    return clean
