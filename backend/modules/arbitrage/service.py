"""
Service Arbitrage Portefeuille.
Scoring multi-critère, enveloppes budgétaires, scénarios what-if.
"""
from fastapi import HTTPException
from datetime import datetime, timezone
import uuid

from core.database import db
from core.auth import TokenPayload, is_ownership_restricted
from .schemas import ScoringPatch, ArbitrageWeightsUpdate, EnvelopeUpsert, ScenarioCreate

# ─── Poids par défaut ─────────────────────────────────────────────────────────
DEFAULT_WEIGHTS = {
    "w1": 0.20,   # alignement_stratégique
    "w2": 0.25,   # valeur_business
    "w3": 0.15,   # roi_estimated
    "w4": 0.15,   # urgence
    "w5": 0.15,   # risque (soustractif)
    "w6": 0.10,   # complexité (soustractif)
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Calcul du score normalisé 0–100 ─────────────────────────────────────────

def compute_score(project: dict, weights: dict) -> float:
    """
    Score = W1×align + W2×bv + W3×roi + W4×urg − W5×risk − W6×complexity
    Échelle 1–5 pour chaque critère. Retourne un score normalisé 0–100.
    """
    align = float(project.get("strategic_alignment") or 3)
    bv    = float(project.get("business_value") or 3)
    roi   = float(project.get("roi_estimated") or 3)
    urg   = float(project.get("urgency") or 3)
    risk  = float(project.get("risk_score") or 3)
    comp  = float(project.get("complexity") or 3)

    w1 = float(weights.get("w1", 0.20))
    w2 = float(weights.get("w2", 0.25))
    w3 = float(weights.get("w3", 0.15))
    w4 = float(weights.get("w4", 0.15))
    w5 = float(weights.get("w5", 0.15))
    w6 = float(weights.get("w6", 0.10))

    raw = w1 * align + w2 * bv + w3 * roi + w4 * urg - w5 * risk - w6 * comp

    pos_w = w1 + w2 + w3 + w4
    neg_w = w5 + w6
    max_raw = pos_w * 5 - neg_w * 1
    min_raw = pos_w * 1 - neg_w * 5

    if max_raw == min_raw:
        return 50.0

    normalized = (raw - min_raw) / (max_raw - min_raw) * 100
    return round(max(0.0, min(100.0, normalized)), 1)


# ─── Poids du tenant ──────────────────────────────────────────────────────────

async def _get_weights(tenant_id: str) -> dict:
    tenant = await db.tenants.find_one(
        {"tenant_id": tenant_id},
        {"_id": 0, "settings.arbitrage_weights": 1},
    )
    w = (tenant or {}).get("settings", {}).get("arbitrage_weights") or {}
    return {**DEFAULT_WEIGHTS, **w}


async def get_weights(user: TokenPayload) -> dict:
    return await _get_weights(user.tenant_id)


async def update_weights(data: ArbitrageWeightsUpdate, user: TokenPayload) -> dict:
    w = data.model_dump()
    await db.tenants.update_one(
        {"tenant_id": user.tenant_id},
        {"$set": {"settings.arbitrage_weights": w}},
        upsert=True,
    )
    return w


# ─── Résumé portefeuille avec scores ─────────────────────────────────────────

async def get_portfolio_summary(user: TokenPayload) -> dict:
    query: dict = {"tenant_id": user.tenant_id}
    if is_ownership_restricted(user, "projects.view_own"):
        query["owner_id"] = user.user_id

    projects = await db.projects.find(query, {"_id": 0}).to_list(None)
    weights = await _get_weights(user.tenant_id)

    scored = []
    for p in projects:
        scored.append({
            "project_id":            p.get("project_id"),
            "name":                  p.get("name"),
            "status":                p.get("status"),
            "status_rag":            p.get("status_rag"),
            "capex_planned":         p.get("capex_planned", 0) or 0,
            "opex_planned":          p.get("opex_planned", 0) or 0,
            "budget_total":          p.get("budget_total", 0) or 0,
            "strategic_alignment":   p.get("strategic_alignment"),
            "business_value":        p.get("business_value"),
            "roi_estimated":         p.get("roi_estimated"),
            "urgency":               p.get("urgency"),
            "risk_score":            p.get("risk_score"),
            "complexity":            p.get("complexity"),
            "score":                 compute_score(p, weights),
        })

    scored.sort(key=lambda x: x["score"], reverse=True)

    total_capex = sum(p["capex_planned"] for p in scored)
    total_opex  = sum(p["opex_planned"]  for p in scored)
    total_budget = sum(p["budget_total"] for p in scored)

    return {
        "projects": scored,
        "weights":  weights,
        "totals": {
            "capex_planned": total_capex,
            "opex_planned":  total_opex,
            "budget_total":  total_budget,
        },
    }


# ─── Patch scoring d'un projet ────────────────────────────────────────────────

async def patch_project_scoring(project_id: str, data: ScoringPatch, user: TokenPayload) -> dict:
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Aucun champ à mettre à jour")

    # Vérifier que le projet appartient bien au tenant
    proj = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not proj:
        raise HTTPException(404, "Projet introuvable")

    # CP: ne peut modifier que ses propres projets
    if is_ownership_restricted(user, "projects.view_own") and proj.get("owner_id") != user.user_id:
        raise HTTPException(403, "Accès refusé — projet non assigné")

    await db.projects.update_one(
        {"project_id": project_id, "tenant_id": user.tenant_id},
        {"$set": updates},
    )
    proj.update(updates)
    weights = await _get_weights(user.tenant_id)
    return {"project_id": project_id, **updates, "score": compute_score(proj, weights)}


# ─── Enveloppes budgétaires ───────────────────────────────────────────────────

async def list_envelopes(user: TokenPayload) -> list:
    envelopes = await db.portfolio_envelopes.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("year", -1).to_list(None)
    return envelopes


async def upsert_envelope(data: EnvelopeUpsert, user: TokenPayload) -> dict:
    existing = await db.portfolio_envelopes.find_one(
        {"tenant_id": user.tenant_id, "year": data.year}
    )
    doc = {
        "tenant_id":      user.tenant_id,
        "year":           data.year,
        "label":          data.label or f"Enveloppe Portefeuille {data.year}",
        "capex_envelope": data.capex_envelope,
        "opex_envelope":  data.opex_envelope,
        "total_envelope": data.capex_envelope + data.opex_envelope,
        "updated_at":     _now(),
    }
    if existing:
        await db.portfolio_envelopes.update_one(
            {"tenant_id": user.tenant_id, "year": data.year},
            {"$set": doc},
        )
        doc["envelope_id"] = existing.get("envelope_id", str(uuid.uuid4()))
    else:
        doc["envelope_id"] = str(uuid.uuid4())
        doc["created_at"] = _now()
        await db.portfolio_envelopes.insert_one(doc)

    result = await db.portfolio_envelopes.find_one(
        {"tenant_id": user.tenant_id, "year": data.year}, {"_id": 0}
    )
    return result or doc


async def delete_envelope(envelope_id: str, user: TokenPayload) -> dict:
    env = await db.portfolio_envelopes.find_one(
        {"envelope_id": envelope_id, "tenant_id": user.tenant_id}
    )
    if not env:
        raise HTTPException(404, "Enveloppe introuvable")
    await db.portfolio_envelopes.delete_one({"envelope_id": envelope_id})
    return {"deleted": True}


# ─── Scénarios What-if ────────────────────────────────────────────────────────

async def list_scenarios(user: TokenPayload) -> list:
    return await db.scenarios.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(None)


async def save_scenario(data: ScenarioCreate, user: TokenPayload) -> dict:
    doc = {
        "scenario_id":  str(uuid.uuid4()),
        "tenant_id":    user.tenant_id,
        "name":         data.name,
        "description":  data.description,
        "modifications": data.modifications,
        "summary":      data.summary,
        "created_by":   user.user_id,
        "created_at":   _now(),
        "status":       "draft",
    }
    await db.scenarios.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def apply_scenario(scenario_id: str, user: TokenPayload) -> dict:
    """Applique les modifications d'un scénario aux vrais projets."""
    scenario = await db.scenarios.find_one(
        {"scenario_id": scenario_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not scenario:
        raise HTTPException(404, "Scénario introuvable")

    applied = []
    ALLOWED_FIELDS = {
        "status", "status_rag", "capex_planned", "opex_planned",
        "budget_total", "start_date", "end_date_forecast",
        "strategic_alignment", "business_value", "roi_estimated",
        "urgency", "risk_score", "complexity",
    }

    for mod in scenario.get("modifications", []):
        project_id = mod.get("project_id")
        if not project_id:
            continue
        updates = {k: v for k, v in mod.items() if k in ALLOWED_FIELDS and k != "project_id"}
        if not updates:
            continue
        result = await db.projects.update_one(
            {"project_id": project_id, "tenant_id": user.tenant_id},
            {"$set": updates},
        )
        if result.modified_count:
            applied.append(project_id)

    await db.scenarios.update_one(
        {"scenario_id": scenario_id},
        {"$set": {"status": "applied", "applied_at": _now(), "applied_by": user.user_id}},
    )
    return {"applied": len(applied), "project_ids": applied}


async def delete_scenario(scenario_id: str, user: TokenPayload) -> dict:
    s = await db.scenarios.find_one(
        {"scenario_id": scenario_id, "tenant_id": user.tenant_id}
    )
    if not s:
        raise HTTPException(404, "Scénario introuvable")
    await db.scenarios.delete_one({"scenario_id": scenario_id})
    return {"deleted": True}
