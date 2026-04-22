import uuid
import io
import csv as csv_mod
from datetime import datetime, timezone, date
from typing import Optional
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload

VALID_FAMILIES = ["epic_lifecycle", "epic_milestone", "transversal"]

FAMILY_TYPES = {
    "epic_lifecycle": [
        "kick_off", "review", "epic_analysis", "general_design", "detailed_design",
        "development", "sit", "uat", "cut_over", "hypercare", "change_management",
    ],
    "epic_milestone": ["go_no_go", "contractual", "roll_out", "key_deliverable", "go_live"],
    "transversal": ["dependency", "regulatory", "decomm"],
}


async def list_milestones(project_id: Optional[str], current_user: TokenPayload) -> list:
    if project_id:
        proj = await db.projects.find_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id}
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Projet introuvable")
        return await db.milestones.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    else:
        projects = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"project_id": 1, "_id": 0}
        ).to_list(None)
        pids = [p["project_id"] for p in projects]
        return await db.milestones.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)


async def create_milestone(data: dict, current_user: TokenPayload) -> dict:
    project_id = data.get("project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id requis")
    proj = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    family = data.get("family")
    if family and family not in VALID_FAMILIES:
        raise HTTPException(status_code=400, detail=f"Famille invalide: {family}")

    milestone_type = data.get("type")
    if family and milestone_type and milestone_type not in FAMILY_TYPES.get(family, []):
        raise HTTPException(
            status_code=400,
            detail=f"Type '{milestone_type}' invalide pour la famille '{family}'",
        )

    attribute = data.get("attribute")
    if attribute and attribute not in ("critical", "strategic"):
        attribute = None
    if attribute and current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        attribute = None

    milestone = {
        "milestone_id": str(uuid.uuid4()),
        "project_id": project_id,
        "tenant_id": current_user.tenant_id,
        "name": (data.get("name") or "").strip(),
        "date_baseline": data.get("date_baseline"),
        "date_forecast": data.get("date_forecast"),
        "date_actual": data.get("date_actual"),
        "status": data.get("status", "planned"),
        "is_governance": bool(data.get("is_governance", False)),
        "family": family,
        "type": milestone_type,
        "attribute": attribute,
        "comment": (data.get("comment") or "")[:500],
        "owner_resource_id": data.get("owner_resource_id"),
        "deliverable": data.get("deliverable"),
        "is_blocking": bool(data.get("is_blocking", False)),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.user_id,
    }
    await db.milestones.insert_one(milestone)
    milestone.pop("_id", None)
    return milestone


async def update_milestone(milestone_id: str, data: dict, current_user: TokenPayload) -> dict:
    existing = await db.milestones.find_one({"milestone_id": milestone_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Jalon introuvable")
    proj = await db.projects.find_one(
        {"project_id": existing["project_id"], "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=403, detail="Accès refusé")

    family = data.get("family", existing.get("family"))
    milestone_type = data.get("type", existing.get("type"))

    if family and family not in VALID_FAMILIES:
        raise HTTPException(status_code=400, detail=f"Famille invalide: {family}")
    if family and milestone_type and milestone_type not in FAMILY_TYPES.get(family, []):
        raise HTTPException(
            status_code=400,
            detail=f"Type '{milestone_type}' invalide pour la famille '{family}'",
        )

    attribute = data.get("attribute", existing.get("attribute"))
    if attribute and attribute not in ("critical", "strategic"):
        attribute = None
    if attribute and current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        attribute = existing.get("attribute")

    updates = {
        "name": (data.get("name", existing.get("name", ""))).strip(),
        "date_baseline": data.get("date_baseline", existing.get("date_baseline")),
        "date_forecast": data.get("date_forecast", existing.get("date_forecast")),
        "date_actual": data.get("date_actual", existing.get("date_actual")),
        "status": data.get("status", existing.get("status", "planned")),
        "is_governance": bool(data.get("is_governance", existing.get("is_governance", False))),
        "family": family,
        "type": milestone_type,
        "attribute": attribute,
        "comment": (data.get("comment", existing.get("comment")) or "")[:500],
        "owner_resource_id": data.get("owner_resource_id", existing.get("owner_resource_id")),
        "deliverable": data.get("deliverable", existing.get("deliverable")),
        "is_blocking": bool(data.get("is_blocking", existing.get("is_blocking", False))),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.milestones.update_one({"milestone_id": milestone_id}, {"$set": updates})
    return {**existing, **updates}


async def delete_milestone(milestone_id: str, current_user: TokenPayload) -> dict:
    existing = await db.milestones.find_one({"milestone_id": milestone_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Jalon introuvable")
    proj = await db.projects.find_one(
        {"project_id": existing["project_id"], "tenant_id": current_user.tenant_id}
    )
    if not proj:
        raise HTTPException(status_code=403, detail="Accès refusé")
    await db.milestones.delete_one({"milestone_id": milestone_id})
    return {"deleted": True, "milestone_id": milestone_id}



# ─── Tableau de bord Réglementaire ──────────────────────────────────────────

def _days_remaining(target_date_str: str | None) -> int | None:
    if not target_date_str:
        return None
    try:
        td = date.fromisoformat(str(target_date_str)[:10])
        return (td - date.today()).days
    except Exception:
        return None


def _urgency_color(days: int | None, status: str | None) -> str:
    if days is None:
        return "grey"
    if status in ("done", "completed"):
        return "done"
    if days < 0:
        return "overdue"
    if days <= 30:
        return "red"
    if days <= 90:
        return "orange"
    return "green"


async def get_regulatory(
    current_user: TokenPayload,
    project_id: str | None = None,
    milestone_type: str | None = None,
    attribute: str | None = None,
    program_id: str | None = None,
) -> list:
    # Tous les projets du tenant
    projs = await db.projects.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0, "project_id": 1, "name": 1, "program_id": 1},
    ).to_list(None)

    # Filtre par programme avant de construire la map
    if program_id:
        projs = [p for p in projs if p.get("program_id") == program_id]

    proj_map = {p["project_id"]: p for p in projs}
    valid_pids = list(proj_map.keys())

    # Filtre de base : type regulatory ou decomm
    query: dict = {
        "project_id": {"$in": valid_pids},
        "type": {"$in": ["regulatory", "decomm"]},
    }
    if project_id:
        query["project_id"] = project_id
    if milestone_type:
        query["type"] = milestone_type
    if attribute:
        query["attribute"] = attribute

    ms_list = await db.milestones.find(query, {"_id": 0}).to_list(None)

    # Enrichissement : ressources (owners)
    owner_ids = list({m.get("owner_resource_id") for m in ms_list if m.get("owner_resource_id")})
    resources = await db.resources.find(
        {"resource_id": {"$in": owner_ids}}, {"_id": 0, "resource_id": 1, "name": 1}
    ).to_list(None) if owner_ids else []
    res_map = {r["resource_id"]: r["name"] for r in resources}

    result = []
    for m in ms_list:
        proj     = proj_map.get(m.get("project_id", ""), {})
        target   = m.get("date_forecast") or m.get("date_baseline")
        days     = _days_remaining(target)
        color    = _urgency_color(days, m.get("status"))
        result.append({
            **m,
            "project_name":   proj.get("name", "?"),
            "owner_name":     res_map.get(m.get("owner_resource_id", ""), "—"),
            "target_date":    target,
            "days_remaining": days,
            "urgency_color":  color,
        })

    # Tri par date cible croissante (None en fin)
    result.sort(key=lambda x: (x["target_date"] or "9999-12-31"))
    return result


async def get_regulatory_kpis(current_user: TokenPayload) -> dict:
    all_ms = await get_regulatory(current_user)
    total = len(all_ms)
    within_90  = sum(1 for m in all_ms if m["days_remaining"] is not None and 0 <= m["days_remaining"] <= 90)
    overdue    = sum(1 for m in all_ms if m["urgency_color"] == "overdue")
    crit_open  = sum(1 for m in all_ms if m.get("attribute") == "critical" and m.get("status") not in ("done", "completed"))
    return {
        "total":      total,
        "within_90":  within_90,
        "overdue":    overdue,
        "crit_open":  crit_open,
    }


async def get_regulatory_csv(current_user: TokenPayload, **filters) -> str:
    ms_list = await get_regulatory(current_user, **filters)
    buf = io.StringIO()
    writer = csv_mod.writer(buf)
    writer.writerow(["Projet", "Type", "Libellé", "Date cible", "Owner", "Statut", "Jours restants", "Attribut", "Bloquant"])
    for m in ms_list:
        writer.writerow([
            m["project_name"], m["type"], m["name"], m.get("target_date", ""),
            m["owner_name"], m.get("status", ""), m.get("days_remaining", ""),
            m.get("attribute", ""), "Oui" if m.get("is_blocking") else "Non",
        ])
    return buf.getvalue()
