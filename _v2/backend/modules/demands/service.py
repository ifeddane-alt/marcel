"""Service Gestion de la Demande — Workflow de qualification PMO.

Workflow :
  nouvelle → qualifiee (qualify)
  qualifiee → priorisee (prioritize, priority_score obligatoire)
  priorisee → acceptee (accept)
  priorisee → refusee (refuse, rejection_reason obligatoire)
  acceptee → convertie (convert → crée un projet)
"""
from fastapi import HTTPException
from datetime import datetime, timezone
import uuid

from core.database import db
from core.auth import TokenPayload
from .schemas import DemandCreate, DemandUpdate, DemandTransitionRequest, ConvertToProjectRequest

# Transitions valides : status courant → {action: nouveau status}
_TRANSITIONS = {
    "nouvelle":  {"qualify": "qualifiee"},
    "qualifiee": {"prioritize": "priorisee"},
    "priorisee": {"accept": "acceptee", "refuse": "refusee"},
    "acceptee":  {},
    "refusee":   {},
    "convertie": {},
}


def _require_pmo_admin(user: TokenPayload) -> None:
    if user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants (PMO/Admin requis)")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── CRUD ─────────────────────────────────────────────────────────────────────

async def list_demands(user: TokenPayload, status: str | None, urgency: str | None):
    query: dict = {"tenant_id": user.tenant_id}
    if status:
        query["status"] = status
    if urgency:
        query["urgency"] = urgency
    return await db.demands.find(query, {"_id": 0}).sort("created_at", -1).to_list(None)


async def get_demand(demand_id: str, user: TokenPayload) -> dict:
    d = await db.demands.find_one(
        {"demand_id": demand_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not d:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    return d


async def create_demand(data: DemandCreate, user: TokenPayload) -> dict:
    # Tout rôle non READ_ONLY peut créer
    if user.role == "READ_ONLY":
        raise HTTPException(status_code=403, detail="Droits insuffisants")
    now = _now()
    doc = {
        "demand_id": str(uuid.uuid4()),
        "tenant_id": user.tenant_id,
        "status": "nouvelle",
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_at": now,
        "updated_at": now,
        **data.model_dump(exclude_none=True),
    }
    await db.demands.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_demand(demand_id: str, data: DemandUpdate, user: TokenPayload) -> dict:
    _require_pmo_admin(user)
    await get_demand(demand_id, user)  # 404 check
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return await get_demand(demand_id, user)
    updates["updated_at"] = _now()
    await db.demands.update_one(
        {"demand_id": demand_id, "tenant_id": user.tenant_id}, {"$set": updates}
    )
    return await get_demand(demand_id, user)


async def delete_demand(demand_id: str, user: TokenPayload) -> dict:
    _require_pmo_admin(user)
    await get_demand(demand_id, user)  # 404 check
    await db.demands.delete_one({"demand_id": demand_id, "tenant_id": user.tenant_id})
    return {"ok": True}


# ─── Workflow ─────────────────────────────────────────────────────────────────

async def transition_demand(
    demand_id: str, data: DemandTransitionRequest, user: TokenPayload
) -> dict:
    _require_pmo_admin(user)
    d = await get_demand(demand_id, user)
    current = d["status"]
    allowed = _TRANSITIONS.get(current, {})

    if data.action not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Transition '{data.action}' impossible depuis le statut '{current}'",
        )

    if data.action == "prioritize" and data.priority_score is None:
        raise HTTPException(status_code=400, detail="Le score de priorité est obligatoire")
    if data.action == "refuse" and not data.rejection_reason:
        raise HTTPException(status_code=400, detail="Le motif de refus est obligatoire")

    new_status = allowed[data.action]
    now = _now()
    updates: dict = {"status": new_status, "updated_at": now}

    if data.action == "qualify":
        updates["qualified_by"] = user.user_id
        updates["qualified_by_name"] = user.name
        updates["qualified_at"] = now
    if data.action == "prioritize":
        updates["priority_score"] = data.priority_score
        updates["prioritized_by"] = user.user_id
        updates["prioritized_at"] = now
    if data.action == "refuse":
        updates["rejection_reason"] = data.rejection_reason
        updates["refused_by"] = user.user_id
        updates["refused_at"] = now
    if data.action == "accept":
        updates["accepted_by"] = user.user_id
        updates["accepted_at"] = now

    await db.demands.update_one(
        {"demand_id": demand_id, "tenant_id": user.tenant_id}, {"$set": updates}
    )
    return await get_demand(demand_id, user)


async def convert_to_project(
    demand_id: str, data: ConvertToProjectRequest, user: TokenPayload
) -> dict:
    _require_pmo_admin(user)
    d = await get_demand(demand_id, user)
    if d["status"] != "acceptee":
        raise HTTPException(
            status_code=400, detail="Seule une demande 'acceptée' peut être convertie en projet"
        )
    now = _now()
    project_id = str(uuid.uuid4())
    project = {
        "project_id": project_id,
        "tenant_id": user.tenant_id,
        "created_at": now,
        "budget_consumed": 0.0,
        "budget_forecast": data.budget_total or 0.0,
        "owner_resource_id": None,
        **data.model_dump(exclude_none=True),
    }
    await db.projects.insert_one(project)
    project.pop("_id", None)

    # Marquer la demande comme convertie
    await db.demands.update_one(
        {"demand_id": demand_id, "tenant_id": user.tenant_id},
        {"$set": {"status": "convertie", "converted_project_id": project_id, "updated_at": now}},
    )
    return {"project_id": project_id, "demand": await get_demand(demand_id, user)}


# ─── Seed démo ───────────────────────────────────────────────────────────────

async def seed_demo_demands(tenant_id: str) -> dict:
    """Insère 10 demandes de démo si aucune n'existe pour le tenant."""
    existing = await db.demands.count_documents({"tenant_id": tenant_id})
    if existing >= 5:
        return {"seeded": 0, "message": "Données de démo déjà présentes"}

    now = datetime.now(timezone.utc)

    def ts(days_ago: int = 0) -> str:
        from datetime import timedelta
        return (now - timedelta(days=days_ago)).isoformat()

    demands = [
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Migration SI Finance vers SAP S/4HANA Cloud",
            "description": "Remplacement de l'ERP Finance actuel par SAP S/4HANA Cloud pour améliorer les clôtures comptables et la consolidation groupe.",
            "requester": "Marie Dupont",
            "requester_department": "Direction Financière",
            "business_value": "Réduction de 40% des délais de clôture mensuelle. Meilleure traçabilité des flux inter-entités.",
            "estimated_budget": 850000.0,
            "urgency": "high",
            "status": "nouvelle",
            "priority_score": None,
            "created_by": "system",
            "created_by_name": "Marie Dupont",
            "created_at": ts(15),
            "updated_at": ts(15),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Plateforme de gestion documentaire RH",
            "description": "Centralisation de tous les documents RH (contrats, bulletins de paie, evaluations) dans une GED sécurisée avec signature électronique.",
            "requester": "Jean-Pierre Moreau",
            "requester_department": "DRH",
            "business_value": "Conformité RGPD, économie de 200k€/an en impressions et archivage papier.",
            "estimated_budget": 320000.0,
            "urgency": "medium",
            "status": "qualifiee",
            "priority_score": None,
            "qualified_by": "system",
            "qualified_by_name": "Thomas Dubois",
            "qualified_at": ts(8),
            "created_by": "system",
            "created_by_name": "Jean-Pierre Moreau",
            "created_at": ts(22),
            "updated_at": ts(8),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Automatisation des rapports réglementaires DORA",
            "description": "Développement d'un module d'automatisation pour la génération des rapports DORA NIS2 exigés par la BCE et l'ACPR.",
            "requester": "Sophie Martin",
            "requester_department": "Conformité & Risques",
            "business_value": "Eviter les amendes réglementaires estimées à 5M€ et réduire de 80% le temps de reporting.",
            "estimated_budget": 450000.0,
            "urgency": "critical",
            "status": "priorisee",
            "priority_score": 92,
            "qualified_by": "system",
            "qualified_by_name": "Thomas Dubois",
            "qualified_at": ts(18),
            "prioritized_by": "system",
            "prioritized_at": ts(10),
            "created_by": "system",
            "created_by_name": "Sophie Martin",
            "created_at": ts(25),
            "updated_at": ts(10),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "CRM unifié pour les équipes commerciales",
            "description": "Déploiement de Salesforce CRM pour unifier le suivi client, automatiser les relances et améliorer le taux de conversion.",
            "requester": "Antoine Lefevre",
            "requester_department": "Direction Commerciale",
            "business_value": "Augmentation de 15% du chiffre d'affaires grâce à une meilleure gestion des opportunités.",
            "estimated_budget": 680000.0,
            "urgency": "high",
            "status": "acceptee",
            "priority_score": 78,
            "qualified_by": "system",
            "qualified_by_name": "Thomas Dubois",
            "qualified_at": ts(30),
            "prioritized_by": "system",
            "prioritized_at": ts(20),
            "accepted_by": "system",
            "accepted_at": ts(12),
            "created_by": "system",
            "created_by_name": "Antoine Lefevre",
            "created_at": ts(45),
            "updated_at": ts(12),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Infrastructure Cloud Azure pour les applications métiers",
            "description": "Migration des applications métiers critiques vers Azure pour améliorer la résilience et la scalabilité.",
            "requester": "Pierre Dumont",
            "requester_department": "DSI",
            "business_value": "Réduction de 30% des coûts d'infrastructure et SLA 99.99%.",
            "estimated_budget": 1200000.0,
            "urgency": "high",
            "status": "convertie",
            "priority_score": 85,
            "qualified_by": "system",
            "qualified_by_name": "Thomas Dubois",
            "qualified_at": ts(60),
            "prioritized_by": "system",
            "prioritized_at": ts(50),
            "accepted_by": "system",
            "accepted_at": ts(40),
            "converted_project_id": str(uuid.uuid4()),
            "created_by": "system",
            "created_by_name": "Pierre Dumont",
            "created_at": ts(75),
            "updated_at": ts(35),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Chatbot IA pour support client niveau 1",
            "description": "Intégration d'un assistant conversationnel IA capable de traiter 70% des demandes de support niveau 1 sans intervention humaine.",
            "requester": "Isabelle Rousseau",
            "requester_department": "Service Client",
            "business_value": "Économie de 500k€/an sur les coûts de support et amélioration du NPS.",
            "estimated_budget": 380000.0,
            "urgency": "medium",
            "status": "refusee",
            "priority_score": None,
            "qualified_by": "system",
            "qualified_by_name": "Thomas Dubois",
            "qualified_at": ts(40),
            "prioritized_by": "system",
            "prioritized_at": ts(30),
            "refused_by": "system",
            "refused_at": ts(20),
            "rejection_reason": "Budget IT gelé pour le T1-T2. Réévaluation prévue en Q3 2026. Projet à replanifier avec le nouveau budget digital.",
            "created_by": "system",
            "created_by_name": "Isabelle Rousseau",
            "created_at": ts(55),
            "updated_at": ts(20),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Portail libre-service employé (ESS)",
            "description": "Création d'un portail RH en libre-service permettant aux employés de gérer leurs congés, notes de frais et demandes administratives.",
            "requester": "Nathalie Bernard",
            "requester_department": "DRH",
            "business_value": "Réduction de 60% des sollicitations RH répétitives, meilleure expérience collaborateur.",
            "estimated_budget": 220000.0,
            "urgency": "low",
            "status": "nouvelle",
            "priority_score": None,
            "created_by": "system",
            "created_by_name": "Nathalie Bernard",
            "created_at": ts(5),
            "updated_at": ts(5),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Tableau de bord temps réel pour la supply chain",
            "description": "Développement d'un dashboard opérationnel connecté aux ERP et WMS pour suivre en temps réel les flux de la supply chain.",
            "requester": "François Petit",
            "requester_department": "Supply Chain",
            "business_value": "Réduction de 25% des ruptures de stock et optimisation du taux de service.",
            "estimated_budget": 310000.0,
            "urgency": "medium",
            "status": "qualifiee",
            "priority_score": None,
            "qualified_by": "system",
            "qualified_by_name": "Thomas Dubois",
            "qualified_at": ts(6),
            "created_by": "system",
            "created_by_name": "François Petit",
            "created_at": ts(14),
            "updated_at": ts(6),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Cybersécurité : SOC interne et SIEM",
            "description": "Mise en place d'un Security Operations Center interne avec une solution SIEM pour détecter et répondre aux incidents de sécurité.",
            "requester": "Marc Girard",
            "requester_department": "RSSI",
            "business_value": "Conformité NIS2, réduction du temps de détection des incidents de 72h à moins de 4h.",
            "estimated_budget": 950000.0,
            "urgency": "critical",
            "status": "priorisee",
            "priority_score": 96,
            "qualified_by": "system",
            "qualified_by_name": "Thomas Dubois",
            "qualified_at": ts(20),
            "prioritized_by": "system",
            "prioritized_at": ts(12),
            "created_by": "system",
            "created_by_name": "Marc Girard",
            "created_at": ts(30),
            "updated_at": ts(12),
        },
        {
            "demand_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "title": "Analytics avancée : Data Lake & BI self-service",
            "description": "Création d'un Data Lake centralisé alimenté par toutes les sources IT et d'une plateforme BI en libre-service pour les métiers.",
            "requester": "Céline Moreau",
            "requester_department": "Direction Générale",
            "business_value": "Démocratisation de la data, décisions basées sur les données, ROI estimé à 3M€ sur 3 ans.",
            "estimated_budget": 1500000.0,
            "urgency": "high",
            "status": "nouvelle",
            "priority_score": None,
            "created_by": "system",
            "created_by_name": "Céline Moreau",
            "created_at": ts(3),
            "updated_at": ts(3),
        },
    ]

    await db.demands.delete_many({"tenant_id": tenant_id})
    await db.demands.insert_many(demands)
    return {"seeded": len(demands)}
