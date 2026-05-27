"""Service Status Report — Calcul météo + génération PPT."""
import uuid
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import HTTPException
from core.auth import TokenPayload, has_perm
from core.database import db

WEATHER_LEVELS = ["soleil", "nuage", "pluie", "orage", "gel"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _today() -> date:
    return date.today()


# ─── Calcul météo automatique ─────────────────────────────────────────────────

async def compute_perimeter_weather(project_id: str, tenant_id: str) -> dict:
    """Périmètre : compare tâches actuelles vs dernier snapshot figé."""
    tasks = await db.tasks.find(
        {"project_id": project_id, "tenant_id": tenant_id}, {"_id": 0, "task_id": 1}
    ).to_list(None)
    current_count = len(tasks)

    snapshot = await db.scope_snapshots.find_one(
        {"project_id": project_id, "tenant_id": tenant_id, "status": {"$in": ["frozen", "transmitted"]}},
        sort=[("version", -1)]
    )
    if not snapshot:
        return {"level": "gel", "detail": "Aucun snapshot de scope figé", "delta_pct": None}

    baseline_features = snapshot.get("features") or []
    baseline_count = len(baseline_features)
    if baseline_count == 0:
        return {"level": "gel", "detail": "Snapshot vide", "delta_pct": None}

    delta_pct = abs(current_count - baseline_count) / baseline_count * 100
    if delta_pct < 5:
        level = "soleil"
    elif delta_pct < 15:
        level = "nuage"
    elif delta_pct < 30:
        level = "pluie"
    else:
        level = "orage"

    return {
        "level": level,
        "detail": f"{current_count} tâches vs {baseline_count} (snapshot v{snapshot.get('version',1)}) — écart {delta_pct:.1f}%",
        "delta_pct": round(delta_pct, 1),
        "current_count": current_count,
        "baseline_count": baseline_count,
    }


async def compute_budget_weather(project_id: str, tenant_id: str) -> dict:
    """Budget : écart EAC vs budget initial."""
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": tenant_id}, {"_id": 0}
    )
    if not project:
        return {"level": "gel", "detail": "Projet introuvable", "ecart_pct": None}

    budget_initial = project.get("budget_total") or (
        (project.get("capex_planned") or 0) + (project.get("opex_planned") or 0)
    )
    eac = project.get("eac") or project.get("budget_forecast") or 0

    if not budget_initial or not eac:
        return {"level": "gel", "detail": "Budget initial ou EAC non renseigné", "ecart_pct": None}

    ecart_pct = abs(eac - budget_initial) / budget_initial * 100
    if ecart_pct < 5:
        level = "soleil"
    elif ecart_pct < 15:
        level = "nuage"
    elif ecart_pct < 30:
        level = "pluie"
    else:
        level = "orage"

    return {
        "level": level,
        "detail": f"EAC {eac/1000:.0f} K€ vs budget {budget_initial/1000:.0f} K€ — écart {ecart_pct:.1f}%",
        "ecart_pct": round(ecart_pct, 1),
        "eac": eac,
        "budget_initial": budget_initial,
    }


async def compute_calendar_weather(project_id: str, tenant_id: str) -> dict:
    """Calendrier : jalons critiques/stratégiques en retard ou à risque."""
    milestones = await db.milestones.find(
        {
            "project_id": project_id,
            "tenant_id": tenant_id,
            "attribute": {"$in": ["critical", "strategic"]},
        },
        {"_id": 0, "name": 1, "date_forecast": 1, "date_baseline": 1, "status": 1, "attribute": 1},
    ).to_list(None)

    if not milestones:
        return {"level": "gel", "detail": "Aucun jalon critique ou stratégique défini", "late_count": 0, "upcoming_count": 0}

    today = _today()
    late_count = 0
    upcoming_count = 0
    late_names = []

    for m in milestones:
        if m.get("status") == "done":
            continue
        date_str = m.get("date_forecast") or m.get("date_baseline")
        if not date_str:
            continue
        try:
            m_date = date.fromisoformat(str(date_str)[:10])
        except Exception:
            continue

        if m_date < today:
            late_count += 1
            late_names.append(m.get("name", ""))
        elif (m_date - today).days < 30:
            upcoming_count += 1

    if late_count == 0 and upcoming_count == 0:
        level = "soleil"
        detail = f"{len(milestones)} jalon(s) critique(s)/stratégique(s), tous dans les temps"
    elif late_count == 0:
        level = "nuage"
        detail = f"{upcoming_count} jalon(s) critique(s) à moins de 30 jours"
    elif late_count == 1:
        level = "pluie"
        detail = f"1 jalon critique en retard : {late_names[0]}"
    else:
        level = "orage"
        detail = f"{late_count} jalons critiques en retard : {', '.join(late_names[:3])}"

    return {
        "level": level,
        "detail": detail,
        "late_count": late_count,
        "upcoming_count": upcoming_count,
        "total_critical": len(milestones),
    }


async def compute_scope_change_weather(project_id: str, tenant_id: str) -> dict:
    """Changement de scope : compare tâches actuelles vs scope transmis."""
    snapshot = await db.scope_snapshots.find_one(
        {"project_id": project_id, "tenant_id": tenant_id, "status": "transmitted"},
        sort=[("version", -1)]
    )
    if not snapshot:
        return {"level": "gel", "detail": "Scope jamais transmis au CP", "changes": None}

    baseline_tasks = {t.get("task_id"): t for t in (snapshot.get("features") or [])}
    current_tasks_list = await db.tasks.find(
        {"project_id": project_id, "tenant_id": tenant_id},
        {"_id": 0, "task_id": 1, "scope_status": 1, "name": 1}
    ).to_list(None)
    current_tasks = {t.get("task_id"): t for t in current_tasks_list}

    changes = 0
    # Tâches ajoutées
    for tid in current_tasks:
        if tid not in baseline_tasks:
            changes += 1
    # Tâches supprimées
    for tid in baseline_tasks:
        if tid not in current_tasks:
            changes += 1
    # Changements de scope_status
    for tid in current_tasks:
        if tid in baseline_tasks:
            if current_tasks[tid].get("scope_status") != baseline_tasks[tid].get("scope_status"):
                changes += 1

    if changes == 0:
        level = "soleil"
        detail = "Aucun changement depuis la transmission"
    elif changes <= 3:
        level = "nuage"
        detail = f"{changes} feature(s) modifiée(s)"
    elif changes <= 7:
        level = "pluie"
        detail = f"{changes} features modifiées (>3)"
    else:
        level = "orage"
        detail = f"{changes} features modifiées (>7)"

    return {
        "level": level,
        "detail": detail,
        "changes": changes,
        "snapshot_version": snapshot.get("version"),
        "snapshot_date": snapshot.get("transmitted_at", snapshot.get("frozen_at", ""))[:10],
    }


async def compute_weather(project_id: str, tenant_id: str) -> dict:
    """Calcule les 4 météos automatiques pour un projet."""
    perimeter, budget, calendar, scope_change = await __import__("asyncio").gather(
        compute_perimeter_weather(project_id, tenant_id),
        compute_budget_weather(project_id, tenant_id),
        compute_calendar_weather(project_id, tenant_id),
        compute_scope_change_weather(project_id, tenant_id),
    )
    return {
        "perimeter": perimeter,
        "budget": budget,
        "calendar": calendar,
        "scope_change": scope_change,
    }


# ─── Génération Status Report ─────────────────────────────────────────────────

async def generate_status_report(project_id: str, payload: dict, user: TokenPayload) -> bytes:
    """Sauvegarde le rapport + génère le PPT."""
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not project:
        raise HTTPException(404, "Projet introuvable")

    # Calculer la météo auto
    weather_auto = await compute_weather(project_id, user.tenant_id)

    # Sauvegarder en base
    report_doc = {
        "report_id": str(uuid.uuid4()),
        "project_id": project_id,
        "tenant_id": user.tenant_id,
        "date": _now()[:10],
        "created_at": _now(),
        "perimeter_auto": weather_auto["perimeter"]["level"],
        "perimeter_override": payload.get("perimeter_override"),
        "perimeter_comment": payload.get("perimeter_comment", ""),
        "budget_auto": weather_auto["budget"]["level"],
        "budget_override": payload.get("budget_override"),
        "budget_comment": payload.get("budget_comment", ""),
        "calendar_auto": weather_auto["calendar"]["level"],
        "calendar_override": payload.get("calendar_override"),
        "calendar_comment": payload.get("calendar_comment", ""),
        "scope_change_auto": weather_auto["scope_change"]["level"],
        "scope_change_override": payload.get("scope_change_override"),
        "scope_change_comment": payload.get("scope_change_comment", ""),
        "generated_by": user.user_id,
    }
    await db.project_weather_reports.insert_one(report_doc)

    # Charger les données pour le PPT
    milestones = await db.milestones.find(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    ).to_list(None)

    risks = await db.risks.find(
        {"project_id": project_id, "tenant_id": user.tenant_id, "status": {"$ne": "clos"}},
        {"_id": 0}
    ).to_list(None)

    resources = await db.resources.find(
        {"tenant_id": user.tenant_id}, {"_id": 0, "resource_id": 1, "name": 1}
    ).to_list(None)
    res_map = {r["resource_id"]: r["name"] for r in resources}

    # Programme
    program = None
    if project.get("program_id"):
        program = await db.programs.find_one(
            {"program_id": project["program_id"]}, {"_id": 0, "name": 1}
        )

    # CP name
    cp_name = res_map.get(project.get("owner_id", ""), project.get("metadata", {}).get("sponsor", "—"))

    # Branding
    tenant_doc = await db.tenants.find_one(
        {"tenant_id": user.tenant_id}, {"_id": 0, "settings.ppt_branding": 1}
    )
    branding = (tenant_doc or {}).get("settings", {}).get("ppt_branding")

    # Météo effective (override ou auto)
    weather = {
        "perimeter": {
            "level": payload.get("perimeter_override") or weather_auto["perimeter"]["level"],
            "comment": payload.get("perimeter_comment", ""),
            "detail": weather_auto["perimeter"].get("detail", ""),
        },
        "budget": {
            "level": payload.get("budget_override") or weather_auto["budget"]["level"],
            "comment": payload.get("budget_comment", ""),
            "detail": weather_auto["budget"].get("detail", ""),
        },
        "calendar": {
            "level": payload.get("calendar_override") or weather_auto["calendar"]["level"],
            "comment": payload.get("calendar_comment", ""),
            "detail": weather_auto["calendar"].get("detail", ""),
        },
        "scope_change": {
            "level": payload.get("scope_change_override") or weather_auto["scope_change"]["level"],
            "comment": payload.get("scope_change_comment", ""),
            "detail": weather_auto["scope_change"].get("detail", ""),
        },
    }

    from pptx_generator import generate_status_report_pptx
    buf = generate_status_report_pptx(
        project=project,
        program_name=(program or {}).get("name", "—"),
        cp_name=cp_name,
        weather=weather,
        milestones=milestones,
        risks=risks,
        res_map=res_map,
        branding=branding,
    )
    return buf, report_doc["report_id"]


async def list_reports(project_id: str, user: TokenPayload) -> list:
    """Historique des status reports d'un projet."""
    reports = await db.project_weather_reports.find(
        {"project_id": project_id, "tenant_id": user.tenant_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return reports
