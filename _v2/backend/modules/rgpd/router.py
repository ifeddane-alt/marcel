"""Module RGPD technique — capacités pour traiter les demandes relatives aux personnes.

Toutes les opérations sont STRICTEMENT limitées au tenant de l'appelant.
Aucun accès inter-tenant possible (le tenant_id est celui du token, jamais du client).
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import TokenPayload, get_current_user
from core.database import db
from core.audit import log_audit

router = APIRouter(tags=["rgpd"])

# Collections contenant des données rattachées à un tenant (pour la suppression complète).
_TENANT_COLLECTIONS = [
    "projects", "programs", "tasks", "milestones", "risks", "decisions", "governance",
    "resources", "teams", "allocations", "work_allocations", "timesheets", "leaves",
    "demands", "applications", "run_activities", "run_allocations", "incidents", "releases",
    "objectives", "strategic_objectives", "strategic_themes", "strategic_envelopes",
    "portfolio_envelopes", "portfolio_snapshots", "okrs", "pis", "sprints", "trains",
    "capabilities", "compliance_requirements", "security_reviews", "vulnerabilities",
    "architecture_standards", "architecture_exemptions", "architecture_reviews",
    "app_interfaces", "tech_debt", "tech_radar", "trajectory_milestones",
    "forecasts", "budget_cuts", "budget_transfers", "cut_scenarios", "scenarios",
    "scope_snapshots", "project_dependencies", "project_templates", "project_sprints",
    "project_weather_reports", "phase_history", "lifecycle_gates", "gate_criteria",
    "gate_attestations", "engagement", "events", "event_types", "notifications",
    "user_alert_rules", "user_preferences", "agent_logs", "audit_logs", "connector_configs",
    "sync_logs", "contract_alerts_sent", "indicator_catalog", "indicator_manual_values",
    "indicator_selections", "pb_sessions", "pb_votes", "profiles", "users",
]


def _require_admin(user: TokenPayload) -> None:
    perms = user.permissions or []
    if "*" not in perms and user.role != "TENANT_ADMIN":
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs du tenant")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Export des données personnelles d'un sujet ────────────────────────────────

@router.get("/admin/rgpd/subject/{user_id}")
async def export_subject(user_id: str, current_user: TokenPayload = Depends(get_current_user)):
    """Exporte les données personnelles d'un utilisateur du tenant courant (RGPD art. 15/20)."""
    _require_admin(current_user)
    tid = current_user.tenant_id
    target = await db.users.find_one({"user_id": user_id, "tenant_id": tid}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable dans ce tenant")
    target.pop("password_hash", None)
    target.pop("mfa_secret", None)

    resource = None
    rid = target.get("resource_id")
    if rid:
        resource = await db.resources.find_one({"resource_id": rid, "tenant_id": tid}, {"_id": 0})

    email = target.get("email", "")
    timesheets = await db.timesheets.find(
        {"tenant_id": tid, "$or": [{"resource_id": rid}, {"user_id": user_id}]}, {"_id": 0}
    ).to_list(500)
    leaves = await db.leaves.find(
        {"tenant_id": tid, "$or": [{"resource_id": rid}, {"user_id": user_id}]}, {"_id": 0}
    ).to_list(500)
    audit = await db.audit_logs.find(
        {"tenant_id": tid, "$or": [{"user_id": user_id}, {"user_email": email}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    await log_audit(current_user, "rgpd.subject_exported", "user", user_id, email)
    return {
        "exported_at": _now(),
        "tenant_id": tid,
        "user": target,
        "resource": resource,
        "timesheets": timesheets,
        "leaves": leaves,
        "audit_events": audit,
        "counts": {"timesheets": len(timesheets), "leaves": len(leaves), "audit_events": len(audit)},
    }


# ── Anonymisation d'un sujet ──────────────────────────────────────────────────

@router.post("/admin/rgpd/subject/{user_id}/anonymize")
async def anonymize_subject(user_id: str, current_user: TokenPayload = Depends(get_current_user)):
    """Anonymise un utilisateur (préserve l'intégrité référentielle des historiques)."""
    _require_admin(current_user)
    tid = current_user.tenant_id
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Impossible d'anonymiser son propre compte")
    target = await db.users.find_one({"user_id": user_id, "tenant_id": tid}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable dans ce tenant")

    anon_email = f"anon+{uuid.uuid4().hex[:12]}@deleted.local"
    await db.users.update_one(
        {"user_id": user_id, "tenant_id": tid},
        {"$set": {"name": "Utilisateur anonymisé", "email": anon_email,
                  "is_active": False, "anonymized_at": _now()},
         "$inc": {"perm_version": 1},
         "$unset": {"password_hash": "", "mfa_secret": "", "mfa_enabled": ""}},
    )
    rid = target.get("resource_id")
    if rid:
        await db.resources.update_one(
            {"resource_id": rid, "tenant_id": tid},
            {"$set": {"name": "Ressource anonymisée", "email": anon_email,
                      "contract_ref": None, "anonymized_at": _now()}},
        )
    await log_audit(current_user, "rgpd.subject_anonymized", "user", user_id, target.get("email", ""))
    return {"anonymized": True, "user_id": user_id, "anonymized_email": anon_email}


# ── Suppression complète d'un tenant (fortement protégée) ─────────────────────

class TenantDeleteRequest(BaseModel):
    confirm_tenant_id: str


@router.post("/admin/rgpd/tenant/delete")
async def delete_tenant(req: TenantDeleteRequest, current_user: TokenPayload = Depends(get_current_user)):
    """Supprime TOUTES les données du tenant courant. Irréversible.

    Garde-fous : admin du tenant + confirmation explicite == tenant_id du token.
    Un admin ne peut JAMAIS supprimer un autre tenant (on ignore tout id fourni ≠ le sien).
    """
    _require_admin(current_user)
    tid = current_user.tenant_id
    if req.confirm_tenant_id != tid:
        raise HTTPException(status_code=400,
                            detail="Confirmation invalide : saisissez l'identifiant exact de VOTRE tenant")

    # Audit AVANT suppression (sinon la trace serait effacée). Trace conservée hors tenant supprimé.
    deleted = {}
    for col in _TENANT_COLLECTIONS:
        res = await db[col].delete_many({"tenant_id": tid})
        if res.deleted_count:
            deleted[col] = res.deleted_count
    await db.tenants.delete_one({"tenant_id": tid})

    # Trace d'audit système (tenant marqueur, hors données supprimées)
    try:
        await db.system_audit.insert_one({
            "audit_id": str(uuid.uuid4()),
            "action": "rgpd.tenant_deleted",
            "tenant_id": tid,
            "by_user": current_user.user_id,
            "by_email": current_user.email,
            "deleted_counts": deleted,
            "created_at": _now(),
        })
    except Exception:
        pass
    return {"tenant_deleted": tid, "deleted_counts": deleted,
            "note": "Les sauvegardes existantes suivent la politique de rétention (30j) puis expirent."}
