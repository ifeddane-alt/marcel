"""Dossier d'engagement — référentiel de critères de gate, attestations, readiness."""
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload, require_write, require_perm

# (key, label, type auto|attested, check_key, mandatory)
_C = lambda k, l, t, c, m: {"key": k, "label": l, "type": t, "check_key": c, "mandatory": m}

_BASE = [
    _C("resume", "Résumé du projet rédigé", "auto", "description_filled", True),
    _C("perimetre", "Périmètre inclus / exclu formalisé", "auto", "scope_filled", True),
    _C("nfr", "Exigences non fonctionnelles décrites", "auto", "nfr_filled", False),
    _C("entites", "Entités / sites impactés déclarés", "auto", "entities_filled", False),
    _C("strategie", "Rattachement stratégique complet", "auto", "strategic_complete", True),
    _C("documents", "Documents de référence joints", "attested", None, False),
    _C("okr", "Contribution aux objectifs décrite", "auto", "okr_described", True),
    _C("indicateurs", "Indicateurs avancés de succès définis", "auto", "leading_indicators", True),
    _C("scoring", "Scoring valeur / effort renseigné", "auto", "scoring_filled", True),
    _C("impacts", "Impacts applicatifs et métier identifiés", "auto", "impacts_identified", True),
    _C("dependances", "Dépendances identifiées", "auto", "dependencies_declared", False),
    _C("gouvernance", "Équipe et gouvernance définies", "auto", "roles_defined", True),
    _C("jalons", "Jalons clés posés", "auto", "milestones_set", True),
    _C("charges", "Charges estimées par les équipes", "auto", "workload_estimated", True),
    _C("charges_validees", "Charges validées par les responsables", "attested", None, True),
    _C("budget_phase", "Budget de la phase renseigné (Capex)", "auto", "phase_budget", True),
    _C("enveloppe", "Rattachement budgétaire établi", "auto", "envelope_linked", False),
    _C("risques", "Premiers risques identifiés", "auto", "risks_identified", True),
    _C("donnees_perso", "Conformité données personnelles validée (si applicable)", "attested", None, False),
    _C("tiers", "Engagement de tiers validé juridiquement (si applicable)", "attested", None, False),
    _C("supports", "Supports de présentation préparés", "attested", None, False),
]

_IMPL = [
    _C("architecture", "Architecture cible validée", "auto", "arch_validated", True),
    _C("flux", "Impacts applicatifs et flux validés en instance", "attested", None, False),
    _C("features", "Découpage en features réalisé", "auto", "features_split", True),
    _C("charges_features", "Charges détaillées par feature", "auto", "feature_workloads", True),
    _C("build_to_run", "Impact exploitation (build-to-run) anticipé", "auto", "build_to_run_filled", True),
    _C("budget_impl", "Budget de mise en œuvre Capex + Opex", "auto", "budget_impl", True),
    _C("ventilation", "Ventilation budgétaire par entité", "auto", "breakdown_filled", False),
    _C("risques_maj", "Registre des risques à jour", "attested", None, False),
]

_LIGHT = [
    _C("jalons", "Jalons de la phase à jour", "auto", "milestones_set", True),
    _C("charges", "Charges à jour", "auto", "workload_estimated", True),
    _C("budget_impl", "Budget Capex + Opex à jour", "auto", "budget_impl", True),
    _C("risques_maj", "Registre des risques à jour", "attested", None, False),
    _C("supports", "Supports de présentation préparés", "attested", None, False),
]

DEFAULT_CRITERIA = {
    "cadrage": _BASE,
    "conception": _BASE + _IMPL,
    "realisation": _LIGHT,
    "recette": _LIGHT,
    "deploiement": [_C("build_to_run", "Dossier d'exploitation et build-to-run finalisés", "auto", "build_to_run_filled", True)] + _LIGHT,
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _ensure_seeded(tenant_id: str):
    if await db.gate_criteria.count_documents({"tenant_id": tenant_id}) > 0:
        return
    docs = []
    for phase, crits in DEFAULT_CRITERIA.items():
        for order, c in enumerate(crits):
            docs.append({
                "criterion_id": str(uuid.uuid4()), "tenant_id": tenant_id,
                "from_phase": phase, "order": order, "active": True, "custom": False, **c,
            })
    if docs:
        await db.gate_criteria.insert_many(docs)


async def list_criteria(from_phase: str, user: TokenPayload) -> list:
    await _ensure_seeded(user.tenant_id)
    return await db.gate_criteria.find(
        {"tenant_id": user.tenant_id, "from_phase": from_phase}, {"_id": 0}).sort("order", 1).to_list(None)


async def update_criterion(criterion_id: str, data: dict, user: TokenPayload) -> dict:
    require_perm(user, "engagement.manage")
    payload = {k: v for k, v in data.items() if k in ("label", "mandatory", "active") and v is not None}
    res = await db.gate_criteria.update_one(
        {"criterion_id": criterion_id, "tenant_id": user.tenant_id}, {"$set": payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Critère introuvable")
    return await db.gate_criteria.find_one({"criterion_id": criterion_id}, {"_id": 0})


async def create_criterion(data: dict, user: TokenPayload) -> dict:
    require_perm(user, "engagement.manage")
    if not (data.get("label") or "").strip() or data.get("from_phase") not in DEFAULT_CRITERIA:
        raise HTTPException(400, "Label et phase requis")
    n = await db.gate_criteria.count_documents({"tenant_id": user.tenant_id, "from_phase": data["from_phase"]})
    doc = {
        "criterion_id": str(uuid.uuid4()), "tenant_id": user.tenant_id,
        "from_phase": data["from_phase"], "key": f"custom_{uuid.uuid4().hex[:6]}",
        "label": data["label"].strip(), "type": "attested", "check_key": None,
        "mandatory": bool(data.get("mandatory")), "active": True, "custom": True, "order": n,
    }
    await db.gate_criteria.insert_one({**doc})
    return doc


async def delete_criterion(criterion_id: str, user: TokenPayload):
    require_perm(user, "engagement.manage")
    res = await db.gate_criteria.delete_one(
        {"criterion_id": criterion_id, "tenant_id": user.tenant_id, "custom": True})
    if res.deleted_count == 0:
        raise HTTPException(400, "Seuls les critères personnalisés peuvent être supprimés")


async def attest(project_id: str, data: dict, user: TokenPayload) -> dict:
    if data.get("not_applicable") and not (data.get("justification") or "").strip():
        raise HTTPException(400, "Une justification est requise pour marquer un critère non applicable")
    doc = {
        "tenant_id": user.tenant_id, "project_id": project_id,
        "criterion_id": data.get("criterion_id"),
        "checked": bool(data.get("checked")),
        "not_applicable": bool(data.get("not_applicable")),
        "justification": data.get("justification") or "",
        "by": user.user_id, "by_name": user.name, "at": _now(),
    }
    await db.gate_attestations.update_one(
        {"tenant_id": user.tenant_id, "project_id": project_id, "criterion_id": doc["criterion_id"]},
        {"$set": doc}, upsert=True)
    return doc


# ─── Readiness ─────────────────────────────────────────────────────────────────
async def _load_ctx(project: dict, user: TokenPayload) -> dict:
    pid = project["project_id"]
    return {
        "project": project,
        "milestones": await db.milestones.count_documents({"project_id": pid}),
        "risks": await db.risks.count_documents({"project_id": pid}),
        "deps": await db.project_dependencies.count_documents(
            {"tenant_id": user.tenant_id, "$or": [{"source_project_id": pid}, {"target_project_id": pid}]}),
        "features": await db.tasks.find(
            {"project_id": pid, "type": "feature"}, {"_id": 0, "jh_planned": 1}).to_list(None),
        "arch_ok": bool(await db.lifecycle_gates.find_one({
            "project_id": pid, "deliverables": {"$elemMatch": {
                "validator": "ARCHITECTE", "review_status": {"$in": ["valide", "valide_reserves"]}}}})),
    }


def _check(check_key: str, ctx: dict):
    p = ctx["project"]
    checks = {
        "description_filled": lambda: len((p.get("description") or "").strip()) >= 20,
        "scope_filled": lambda: bool(p.get("scope_in")) and bool(p.get("scope_out")),
        "nfr_filled": lambda: bool(p.get("nfr")),
        "entities_filled": lambda: bool(p.get("impacted_entities")),
        "strategic_complete": lambda: bool((p.get("strategic_theme_id") or p.get("program_id"))
                                           and p.get("start_date") and p.get("end_date_forecast")),
        "okr_described": lambda: bool(p.get("outcome") or p.get("expected_result")),
        "leading_indicators": lambda: bool(p.get("leading_indicators")),
        "scoring_filled": lambda: p.get("strategic_alignment") is not None and p.get("business_value") is not None,
        "impacts_identified": lambda: bool(p.get("impacted_application_ids")),
        "dependencies_declared": lambda: ctx["deps"] > 0,
        "roles_defined": lambda: len(p.get("governance_roles") or []) >= 2,
        "milestones_set": lambda: ctx["milestones"] >= 2,
        "workload_estimated": lambda: (p.get("jh_planned") or 0) > 0,
        "phase_budget": lambda: (p.get("capex_planned") or 0) > 0,
        "envelope_linked": lambda: (p.get("budget_total") or 0) > 0,
        "risks_identified": lambda: ctx["risks"] > 0,
        "arch_validated": lambda: ctx["arch_ok"],
        "features_split": lambda: len(ctx["features"]) > 0,
        "feature_workloads": lambda: len(ctx["features"]) > 0 and all((f.get("jh_planned") or 0) > 0 for f in ctx["features"]),
        "build_to_run_filled": lambda: bool(p.get("build_to_run")),
        "budget_impl": lambda: (p.get("capex_planned") or 0) > 0 and (p.get("opex_planned") or 0) > 0,
        "breakdown_filled": lambda: bool(p.get("budget_breakdown")),
    }
    fn = checks.get(check_key)
    return bool(fn()) if fn else False


async def readiness(project_id: str, user: TokenPayload, from_phase: str | None = None) -> dict:
    project = await db.projects.find_one(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Projet introuvable")
    phase = from_phase or project.get("lifecycle_phase") or "cadrage"
    if phase == "run":
        return {"from_phase": phase, "items": [], "score_pct": 100, "ready": True, "mandatory_missing": []}
    criteria = [c for c in await list_criteria(phase, user) if c.get("active")]
    atts = {a["criterion_id"]: a for a in await db.gate_attestations.find(
        {"tenant_id": user.tenant_id, "project_id": project_id}, {"_id": 0}).to_list(None)}
    ctx = await _load_ctx(project, user)
    items, ok_count, mandatory_missing = [], 0, []
    for c in criteria:
        if c["type"] == "auto":
            ok = _check(c["check_key"], ctx)
            att = None
        else:
            att = atts.get(c["criterion_id"])
            ok = bool(att and (att["checked"] or att["not_applicable"]))
        if ok:
            ok_count += 1
        elif c["mandatory"]:
            mandatory_missing.append(c["label"])
        items.append({**c, "ok": ok, "attestation": att})
    score = round(ok_count / len(items) * 100) if items else 100
    return {"from_phase": phase, "items": items, "score_pct": score,
            "ready": not mandatory_missing, "mandatory_missing": mandatory_missing}
