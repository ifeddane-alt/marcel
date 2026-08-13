import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload, has_perm
from core.audit import log_audit
from modules.notifications.service import create_notification

PHASES = [
    {"key": "cadrage",     "label": "Cadrage"},
    {"key": "conception",  "label": "Conception"},
    {"key": "realisation", "label": "Réalisation"},
    {"key": "recette",     "label": "Recette"},
    {"key": "deploiement", "label": "Déploiement"},
    {"key": "run",         "label": "Run"},
]
PHASE_KEYS = [p["key"] for p in PHASES]
PHASE_LABELS = {p["key"]: p["label"] for p in PHASES}

# Livrables attendus pour SORTIR de chaque phase (référentiel standard V1)
DELIVERABLE_TEMPLATES = {
    "cadrage": [
        {"key": "note_cadrage",  "label": "Note de cadrage",  "validator": "PMO"},
        {"key": "business_case", "label": "Business case",    "validator": "PMO"},
    ],
    "conception": [
        {"key": "dossier_architecture", "label": "Dossier d'architecture",                        "validator": "ARCHITECTE"},
        {"key": "dossier_securite",     "label": "Dossier sécurité / classification des données", "validator": "SECURITE"},
    ],
    "realisation": [
        {"key": "cahier_recette",  "label": "Cahier de recette",   "validator": "PMO"},
        {"key": "strategie_tests", "label": "Stratégie de tests",  "validator": "PMO"},
    ],
    "recette": [
        {"key": "pv_recette",           "label": "PV de recette",                              "validator": "PMO"},
        {"key": "tests_securite",       "label": "Rapport de tests sécurité / pentest",        "validator": "SECURITE"},
        {"key": "conformite_standards", "label": "Conformité aux standards d'architecture",    "validator": "ARCHITECTE"},
    ],
    "deploiement": [
        {"key": "dossier_exploitation", "label": "Dossier d'exploitation (DEX)",  "validator": "PMO"},
        {"key": "transfert_run",        "label": "Checklist transfert au run",    "validator": "PMO"},
    ],
}

VALIDATOR_PERMS = {
    "ARCHITECTE": "lifecycle.review_architecture",
    "SECURITE":   "lifecycle.review_security",
    "PMO":        "lifecycle.review_pmo",
}
VALIDATOR_LABELS = {"ARCHITECTE": "Architecture", "SECURITE": "Sécurité", "PMO": "PMO"}

OPEN_STATUSES = ("en_validation", "pret")
REVIEW_STATUSES = ("valide", "valide_reserves", "refuse")
OUTCOME_LABELS = {"go": "Go", "go_reserves": "Go avec réserves", "no_go": "No-Go"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_ready(gate: dict) -> bool:
    dls = gate.get("deliverables") or []
    return all(d.get("provided") and d.get("review_status") in ("valide", "valide_reserves") for d in dls)


async def _get_project(project_id: str, user: TokenPayload) -> dict:
    p = await db.projects.find_one({"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Projet introuvable")
    return p


async def _get_gate(gate_id: str, user: TokenPayload) -> dict:
    g = await db.lifecycle_gates.find_one({"gate_id": gate_id, "tenant_id": user.tenant_id}, {"_id": 0})
    if not g:
        raise HTTPException(404, "Passage introuvable")
    return g


async def _users_with_perm(tenant_id: str, perm: str) -> list:
    profs = await db.profiles.find(
        {"tenant_id": tenant_id, "permissions": {"$in": [perm, "*"]}},
        {"_id": 0, "profile_id": 1},
    ).to_list(None)
    pids = [p["profile_id"] for p in profs]
    if not pids:
        return []
    return await db.users.find(
        {"tenant_id": tenant_id, "profile_id": {"$in": pids}, "is_active": {"$ne": False}},
        {"_id": 0, "user_id": 1, "name": 1},
    ).to_list(None)


def referential() -> dict:
    return {"phases": PHASES, "deliverables": DELIVERABLE_TEMPLATES, "validators": VALIDATOR_LABELS}


async def project_lifecycle(project_id: str, user: TokenPayload) -> dict:
    project = await _get_project(project_id, user)
    gates = await db.lifecycle_gates.find(
        {"project_id": project_id, "tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(None)
    for g in gates:
        g["ready"] = _is_ready(g)
    return {
        "current_phase": project.get("lifecycle_phase") or "cadrage",
        "phases": PHASES,
        "gates": gates,
    }


async def set_phase(project_id: str, phase: str, user: TokenPayload) -> dict:
    if phase not in PHASE_KEYS:
        raise HTTPException(422, "Phase invalide")
    project = await _get_project(project_id, user)
    await db.projects.update_one(
        {"project_id": project_id, "tenant_id": user.tenant_id},
        {"$set": {"lifecycle_phase": phase, "updated_at": _now()}},
    )
    await log_audit(user, "phase_set", "lifecycle", project_id, project.get("name", ""),
                    [{"field": "lifecycle_phase", "old": project.get("lifecycle_phase"), "new": phase}])
    return {"lifecycle_phase": phase}


async def request_gate(project_id: str, data: dict, user: TokenPayload) -> dict:
    project = await _get_project(project_id, user)
    current = project.get("lifecycle_phase") or "cadrage"
    idx = PHASE_KEYS.index(current)
    if idx >= len(PHASE_KEYS) - 1:
        raise HTTPException(400, "Le projet est déjà en phase Run")
    to_phase = PHASE_KEYS[idx + 1]

    existing = await db.lifecycle_gates.find_one({
        "project_id": project_id, "tenant_id": user.tenant_id, "status": {"$in": list(OPEN_STATUSES)},
    })
    if existing:
        raise HTTPException(409, "Un passage est déjà en cours de validation pour ce projet")

    governance_id = data.get("governance_id")
    if data.get("new_governance"):
        from modules.governance.service import create_governance
        g = await create_governance(data["new_governance"], user)
        governance_id = g["governance_id"]
    elif governance_id:
        gov = await db.governance.find_one({"governance_id": governance_id, "tenant_id": user.tenant_id})
        if not gov:
            raise HTTPException(404, "Instance de gouvernance introuvable")

    deliverables = [{
        **t,
        "provided": False,
        "reference": "",
        "review_status": "pending",
        "review_comment": "",
        "reviewed_by": None,
        "reviewed_by_name": "",
        "reviewed_at": None,
    } for t in DELIVERABLE_TEMPLATES.get(current, [])]

    gate = {
        "gate_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "project_id": project_id,
        "project_name": project.get("name", ""),
        "project_code": project.get("code", ""),
        "from_phase": current,
        "to_phase": to_phase,
        "governance_id": governance_id,
        "agenda_item_id": None,
        "target_date": data.get("target_date") or "",
        "status": "pret" if not deliverables else "en_validation",
        "deliverables": deliverables,
        "decision": None,
        "requested_by": user.user_id,
        "requested_by_name": user.name,
        "created_at": _now(),
        "updated_at": _now(),
    }

    if governance_id:
        item_id = str(uuid.uuid4())
        title = f"Passage {project.get('code') or project.get('name')} : {PHASE_LABELS[current]} → {PHASE_LABELS[to_phase]}"
        await db.governance.update_one(
            {"governance_id": governance_id, "tenant_id": user.tenant_id},
            {"$push": {"agenda": {"item_id": item_id, "title": title, "presenter": user.name, "duration_min": 15}}},
        )
        gate["agenda_item_id"] = item_id

    await db.lifecycle_gates.insert_one({**gate})
    gate.pop("_id", None)

    notified = set()
    for perm in {VALIDATOR_PERMS[d["validator"]] for d in deliverables}:
        for u in await _users_with_perm(user.tenant_id, perm):
            if u["user_id"] != user.user_id and u["user_id"] not in notified:
                notified.add(u["user_id"])
                await create_notification(
                    user.tenant_id, u["user_id"], "gate_review_requested",
                    f"{project.get('name')} : livrables du passage {PHASE_LABELS[current]} → {PHASE_LABELS[to_phase]} à valider",
                    metadata={"project_id": project_id, "gate_id": gate["gate_id"]},
                )

    await log_audit(user, "gate_requested", "lifecycle", gate["gate_id"], project.get("name", ""))
    gate["ready"] = _is_ready(gate)
    return gate


async def cancel_gate(gate_id: str, user: TokenPayload) -> None:
    gate = await _get_gate(gate_id, user)
    if gate["status"] not in OPEN_STATUSES:
        raise HTTPException(400, "Ce passage n'est plus annulable")
    await db.lifecycle_gates.update_one(
        {"gate_id": gate_id, "tenant_id": user.tenant_id},
        {"$set": {"status": "annule", "updated_at": _now()}},
    )
    if gate.get("governance_id") and gate.get("agenda_item_id"):
        await db.governance.update_one(
            {"governance_id": gate["governance_id"], "tenant_id": user.tenant_id},
            {"$pull": {"agenda": {"item_id": gate["agenda_item_id"]}}},
        )
    await log_audit(user, "gate_cancelled", "lifecycle", gate_id, gate.get("project_name", ""))


async def update_deliverable(gate_id: str, key: str, data: dict, user: TokenPayload) -> dict:
    gate = await _get_gate(gate_id, user)
    if gate["status"] not in OPEN_STATUSES:
        raise HTTPException(400, "Passage clos — livrables non modifiables")
    dls = gate["deliverables"]
    dl = next((d for d in dls if d["key"] == key), None)
    if not dl:
        raise HTTPException(404, "Livrable introuvable")
    if "provided" in data:
        dl["provided"] = bool(data["provided"])
        if dl["provided"] and dl["review_status"] == "refuse":
            dl["review_status"] = "pending"
    if "reference" in data:
        dl["reference"] = (data["reference"] or "").strip()
    status = "pret" if _is_ready(gate) else "en_validation"
    await db.lifecycle_gates.update_one(
        {"gate_id": gate_id, "tenant_id": user.tenant_id},
        {"$set": {"deliverables": dls, "status": status, "updated_at": _now()}},
    )
    gate["status"] = status
    gate["ready"] = _is_ready(gate)
    return gate


async def review_deliverable(gate_id: str, key: str, data: dict, user: TokenPayload) -> dict:
    gate = await _get_gate(gate_id, user)
    if gate["status"] not in OPEN_STATUSES:
        raise HTTPException(400, "Passage clos — avis non modifiable")
    dls = gate["deliverables"]
    dl = next((d for d in dls if d["key"] == key), None)
    if not dl:
        raise HTTPException(404, "Livrable introuvable")
    perm = VALIDATOR_PERMS[dl["validator"]]
    if not has_perm(user, perm):
        raise HTTPException(403, f"Avis réservé au valideur {VALIDATOR_LABELS[dl['validator']]}")
    status = data.get("status")
    if status not in REVIEW_STATUSES:
        raise HTTPException(422, "Avis invalide (valide / valide_reserves / refuse)")
    dl["review_status"] = status
    dl["review_comment"] = (data.get("comment") or "").strip()
    dl["reviewed_by"] = user.user_id
    dl["reviewed_by_name"] = user.name
    dl["reviewed_at"] = _now()
    gate_status = "pret" if _is_ready(gate) else "en_validation"
    await db.lifecycle_gates.update_one(
        {"gate_id": gate_id, "tenant_id": user.tenant_id},
        {"$set": {"deliverables": dls, "status": gate_status, "updated_at": _now()}},
    )
    labels = {"valide": "validé", "valide_reserves": "validé avec réserves", "refuse": "refusé"}
    if gate.get("requested_by") and gate["requested_by"] != user.user_id:
        await create_notification(
            user.tenant_id, gate["requested_by"], "gate_deliverable_reviewed",
            f"{gate.get('project_name')} : « {dl['label']} » {labels[status]} par {user.name}",
            metadata={"project_id": gate["project_id"], "gate_id": gate_id},
        )
    await log_audit(user, "deliverable_reviewed", "lifecycle", gate_id, gate.get("project_name", ""),
                    [{"field": dl["key"], "old": "pending", "new": status}])
    gate["status"] = gate_status
    gate["ready"] = _is_ready(gate)
    return gate


async def decide_gate(gate_id: str, data: dict, user: TokenPayload) -> dict:
    gate = await _get_gate(gate_id, user)
    if gate["status"] not in OPEN_STATUSES:
        raise HTTPException(400, "Une décision a déjà été prononcée sur ce passage")
    outcome = data.get("outcome")
    if outcome not in OUTCOME_LABELS:
        raise HTTPException(422, "Décision invalide (go / go_reserves / no_go)")
    ready = _is_ready(gate)
    decision = {
        "outcome": outcome,
        "comment": (data.get("comment") or "").strip(),
        "decided_by": user.user_id,
        "decided_by_name": user.name,
        "decided_at": _now(),
        "override": outcome != "no_go" and not ready,
    }
    await db.lifecycle_gates.update_one(
        {"gate_id": gate_id, "tenant_id": user.tenant_id},
        {"$set": {"status": outcome, "decision": decision, "updated_at": _now()}},
    )
    if outcome in ("go", "go_reserves"):
        await db.projects.update_one(
            {"project_id": gate["project_id"], "tenant_id": user.tenant_id},
            {"$set": {"lifecycle_phase": gate["to_phase"], "updated_at": _now()}},
        )
    title = (f"{OUTCOME_LABELS[outcome]} — Passage {PHASE_LABELS[gate['from_phase']]} → "
             f"{PHASE_LABELS[gate['to_phase']]} ({gate.get('project_name')})")
    await db.decisions.insert_one({
        "decision_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "project_id": gate["project_id"],
        "governance_id": gate.get("governance_id"),
        "title": title,
        "description": decision["comment"],
        "category": "stratégique",
        "impact": "Dérogation : livrables non tous validés" if decision["override"] else "",
        "owner": user.name,
        "status": "prise",
        "decision_date": _now()[:10],
        "due_date": gate.get("target_date") or None,
        "created_at": _now(),
    })
    if gate.get("requested_by") and gate["requested_by"] != user.user_id:
        await create_notification(
            user.tenant_id, gate["requested_by"], "gate_decision",
            f"{gate.get('project_name')} : {OUTCOME_LABELS[outcome]} prononcé sur le passage "
            f"{PHASE_LABELS[gate['from_phase']]} → {PHASE_LABELS[gate['to_phase']]}",
            metadata={"project_id": gate["project_id"], "gate_id": gate_id},
        )
    await log_audit(user, "gate_decided", "lifecycle", gate_id, gate.get("project_name", ""),
                    [{"field": "decision", "old": gate["status"], "new": outcome}])
    gate.update({"status": outcome, "decision": decision, "ready": ready})
    return gate


async def my_reviews(user: TokenPayload) -> list:
    validators = [v for v, perm in VALIDATOR_PERMS.items() if has_perm(user, perm)]
    if not validators:
        return []
    gates = await db.lifecycle_gates.find(
        {"tenant_id": user.tenant_id, "status": {"$in": list(OPEN_STATUSES)}}, {"_id": 0}
    ).sort("created_at", 1).to_list(None)
    items = []
    for g in gates:
        for d in g.get("deliverables", []):
            if d["validator"] in validators and d["review_status"] == "pending":
                items.append({
                    "gate_id": g["gate_id"],
                    "project_id": g["project_id"],
                    "project_name": g.get("project_name", ""),
                    "project_code": g.get("project_code", ""),
                    "from_phase": g["from_phase"],
                    "to_phase": g["to_phase"],
                    "target_date": g.get("target_date", ""),
                    "deliverable": d,
                })
    return items


async def portfolio(user: TokenPayload) -> dict:
    gates = await db.lifecycle_gates.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    gov_ids = {g["governance_id"] for g in gates if g.get("governance_id")}
    govs = {}
    if gov_ids:
        async for gv in db.governance.find(
            {"governance_id": {"$in": list(gov_ids)}, "tenant_id": user.tenant_id},
            {"_id": 0, "governance_id": 1, "name": 1, "date_scheduled": 1},
        ):
            govs[gv["governance_id"]] = gv
    for g in gates:
        g["ready"] = _is_ready(g)
        g["governance"] = govs.get(g.get("governance_id"))
        dls = g.get("deliverables", [])
        g["validated_count"] = sum(1 for d in dls if d["review_status"] in ("valide", "valide_reserves"))
        g["deliverable_count"] = len(dls)
    phase_counts = {k: 0 for k in PHASE_KEYS}
    async for p in db.projects.find(
        {"tenant_id": user.tenant_id, "status": {"$nin": ["termine", "annule", "closed"]}},
        {"_id": 0, "lifecycle_phase": 1},
    ):
        phase_counts[p.get("lifecycle_phase") or "cadrage"] += 1
    return {"gates": gates, "phase_counts": phase_counts, "phases": PHASES}
