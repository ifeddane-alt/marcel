"""
Script de seed pour Projetenne — Groupe Altair Industries (démo CAC 40)
Usage: python seed.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

TENANT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]


def pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ---- IDs fixes pour la cohérence des données ----
PROJECT_IDS = [str(uuid.uuid4()) for _ in range(8)]
RESOURCE_IDS = [str(uuid.uuid4()) for _ in range(10)]

PROJECTS = [
    {
        "project_id": PROJECT_IDS[0],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2025-001",
        "source_tool": "Clarity PPM",
        "name": "Projet Phoenix — Transformation Digitale Groupe",
        "methodology": "safe",
        "status_rag": "orange",
        "budget_total": 4200000,
        "budget_consumed": 2310000,
        "budget_forecast": 4550000,
        "jh_planned": 8400,
        "jh_consumed": 4200,
        "start_date": "2025-01-15",
        "end_date_baseline": "2025-12-31",
        "end_date_forecast": "2026-02-28",
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "DG", "program": "PHOENIX"},
        "created_at": "2025-01-10T10:00:00Z",
    },
    {
        "project_id": PROJECT_IDS[1],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2024-008",
        "source_tool": "Clarity PPM",
        "name": "Modernisation SI Finance & Contrôle de Gestion",
        "methodology": "waterfall",
        "status_rag": "green",
        "budget_total": 1800000,
        "budget_consumed": 1260000,
        "budget_forecast": 1850000,
        "jh_planned": 3600,
        "jh_consumed": 2520,
        "start_date": "2024-09-01",
        "end_date_baseline": "2025-06-30",
        "end_date_forecast": "2025-07-31",
        "last_sync_at": "2025-04-19T08:00:00Z",
        "metadata": {"sponsor": "CFO", "program": "FIN2025"},
        "created_at": "2024-08-15T10:00:00Z",
    },
    {
        "project_id": PROJECT_IDS[2],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2024-003",
        "source_tool": "Clarity PPM",
        "name": "Déploiement ERP SAP S/4HANA — Core Model",
        "methodology": "waterfall",
        "status_rag": "red",
        "budget_total": 5000000,
        "budget_consumed": 4100000,
        "budget_forecast": 6300000,
        "jh_planned": 10000,
        "jh_consumed": 8200,
        "start_date": "2024-03-01",
        "end_date_baseline": "2025-09-30",
        "end_date_forecast": "2026-03-31",
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "DSI", "program": "ERP-SAP"},
        "created_at": "2024-02-15T10:00:00Z",
    },
    {
        "project_id": PROJECT_IDS[3],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2025-004",
        "source_tool": "Jira",
        "name": "Digital Workplace 2025 — Suite Microsoft 365",
        "methodology": "agile",
        "status_rag": "green",
        "budget_total": 800000,
        "budget_consumed": 560000,
        "budget_forecast": 820000,
        "jh_planned": 1600,
        "jh_consumed": 1050,
        "start_date": "2025-02-01",
        "end_date_baseline": "2025-10-31",
        "end_date_forecast": "2025-10-31",
        "last_sync_at": "2025-04-18T08:00:00Z",
        "metadata": {"sponsor": "DRH", "program": "DW2025"},
        "created_at": "2025-01-20T10:00:00Z",
    },
    {
        "project_id": PROJECT_IDS[4],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2025-005",
        "source_tool": "Jira",
        "name": "Programme CRM Salesforce — Sales & Service Cloud",
        "methodology": "safe",
        "status_rag": "orange",
        "budget_total": 2500000,
        "budget_consumed": 1100000,
        "budget_forecast": 2750000,
        "jh_planned": 5000,
        "jh_consumed": 2100,
        "start_date": "2025-03-01",
        "end_date_baseline": "2026-02-28",
        "end_date_forecast": "2026-04-30",
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "CCO", "program": "CRM-SF"},
        "created_at": "2025-02-10T10:00:00Z",
    },
    {
        "project_id": PROJECT_IDS[5],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2025-002",
        "source_tool": "Azure DevOps",
        "name": "Migration Infrastructure Cloud Azure — Datacenter Paris",
        "methodology": "agile",
        "status_rag": "green",
        "budget_total": 1200000,
        "budget_consumed": 660000,
        "budget_forecast": 1180000,
        "jh_planned": 2400,
        "jh_consumed": 1260,
        "start_date": "2025-01-01",
        "end_date_baseline": "2025-12-31",
        "end_date_forecast": "2025-11-30",
        "last_sync_at": "2025-04-19T08:00:00Z",
        "metadata": {"sponsor": "DSI", "program": "CLOUD-AZ"},
        "created_at": "2024-12-01T10:00:00Z",
    },
    {
        "project_id": PROJECT_IDS[6],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2024-011",
        "source_tool": "Jira",
        "name": "Refonte Portail RH & Self-Service Collaborateur",
        "methodology": "agile",
        "status_rag": "red",
        "budget_total": 650000,
        "budget_consumed": 595000,
        "budget_forecast": 860000,
        "jh_planned": 1300,
        "jh_consumed": 1160,
        "start_date": "2024-11-01",
        "end_date_baseline": "2025-05-31",
        "end_date_forecast": "2025-09-30",
        "last_sync_at": "2025-04-18T08:00:00Z",
        "metadata": {"sponsor": "DRH", "program": "RH-PORTAIL"},
        "created_at": "2024-10-15T10:00:00Z",
    },
    {
        "project_id": PROJECT_IDS[7],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2025-006",
        "source_tool": "Clarity PPM",
        "name": "Programme Conformité DORA & NIS2 — Pilier Résilience",
        "methodology": "waterfall",
        "status_rag": "green",
        "budget_total": 900000,
        "budget_consumed": 315000,
        "budget_forecast": 890000,
        "jh_planned": 1800,
        "jh_consumed": 580,
        "start_date": "2025-04-01",
        "end_date_baseline": "2026-03-31",
        "end_date_forecast": "2026-03-31",
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "CISO", "program": "DORA-NIS2"},
        "created_at": "2025-03-01T10:00:00Z",
    },
]

RESOURCES = [
    {"resource_id": RESOURCE_IDS[0], "tenant_id": TENANT_ID, "name": "Ressource_01", "role": "Architecte SI", "capacity_jh_month": 20, "team": "Architecture"},
    {"resource_id": RESOURCE_IDS[1], "tenant_id": TENANT_ID, "name": "Ressource_02", "role": "Chef de Projet Senior", "capacity_jh_month": 22, "team": "PMO"},
    {"resource_id": RESOURCE_IDS[2], "tenant_id": TENANT_ID, "name": "Ressource_03", "role": "Développeur Senior Java", "capacity_jh_month": 20, "team": "Dev Core"},
    {"resource_id": RESOURCE_IDS[3], "tenant_id": TENANT_ID, "name": "Ressource_04", "role": "Business Analyst", "capacity_jh_month": 20, "team": "Métier"},
    {"resource_id": RESOURCE_IDS[4], "tenant_id": TENANT_ID, "name": "Ressource_05", "role": "DevOps Engineer", "capacity_jh_month": 20, "team": "Infrastructure"},
    {"resource_id": RESOURCE_IDS[5], "tenant_id": TENANT_ID, "name": "Ressource_06", "role": "Product Owner", "capacity_jh_month": 18, "team": "Product"},
    {"resource_id": RESOURCE_IDS[6], "tenant_id": TENANT_ID, "name": "Ressource_07", "role": "Scrum Master", "capacity_jh_month": 15, "team": "Agile"},
    {"resource_id": RESOURCE_IDS[7], "tenant_id": TENANT_ID, "name": "Ressource_08", "role": "Data Engineer", "capacity_jh_month": 20, "team": "Data & BI"},
    {"resource_id": RESOURCE_IDS[8], "tenant_id": TENANT_ID, "name": "Ressource_09", "role": "UX/UI Designer", "capacity_jh_month": 18, "team": "Design"},
    {"resource_id": RESOURCE_IDS[9], "tenant_id": TENANT_ID, "name": "Ressource_10", "role": "Expert Sécurité SI", "capacity_jh_month": 15, "team": "Cybersécurité"},
]

ALLOCATIONS = [
    # Phoenix (SAFe)
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[0], "period_month": "2025-01-01", "jh_allocated": 15, "jh_consumed": 15, "allocation_rate": 75},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[1], "period_month": "2025-01-01", "jh_allocated": 20, "jh_consumed": 19, "allocation_rate": 91},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[2], "period_month": "2025-02-01", "jh_allocated": 18, "jh_consumed": 18, "allocation_rate": 90},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[5], "period_month": "2025-02-01", "jh_allocated": 16, "jh_consumed": 15, "allocation_rate": 89},
    # SI Finance
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "resource_id": RESOURCE_IDS[3], "period_month": "2025-01-01", "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "resource_id": RESOURCE_IDS[1], "period_month": "2025-01-01", "jh_allocated": 10, "jh_consumed": 10, "allocation_rate": 45},
    # SAP
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "resource_id": RESOURCE_IDS[0], "period_month": "2025-01-01", "jh_allocated": 5, "jh_consumed": 5, "allocation_rate": 25},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "resource_id": RESOURCE_IDS[3], "period_month": "2025-01-01", "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    # Digital Workplace
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "resource_id": RESOURCE_IDS[8], "period_month": "2025-02-01", "jh_allocated": 15, "jh_consumed": 12, "allocation_rate": 83},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "resource_id": RESOURCE_IDS[6], "period_month": "2025-02-01", "jh_allocated": 12, "jh_consumed": 12, "allocation_rate": 80},
    # CRM Salesforce
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "resource_id": RESOURCE_IDS[5], "period_month": "2025-03-01", "jh_allocated": 18, "jh_consumed": 15, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "resource_id": RESOURCE_IDS[2], "period_month": "2025-03-01", "jh_allocated": 20, "jh_consumed": 18, "allocation_rate": 100},
    # Cloud Azure
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": RESOURCE_IDS[4], "period_month": "2025-01-01", "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": RESOURCE_IDS[0], "period_month": "2025-02-01", "jh_allocated": 8, "jh_consumed": 8, "allocation_rate": 40},
    # Portail RH
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "resource_id": RESOURCE_IDS[8], "period_month": "2025-01-01", "jh_allocated": 18, "jh_consumed": 18, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "resource_id": RESOURCE_IDS[3], "period_month": "2025-01-01", "jh_allocated": 15, "jh_consumed": 15, "allocation_rate": 75},
    # DORA NIS2
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "resource_id": RESOURCE_IDS[9], "period_month": "2025-04-01", "jh_allocated": 15, "jh_consumed": 10, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "resource_id": RESOURCE_IDS[7], "period_month": "2025-04-01", "jh_allocated": 10, "jh_consumed": 8, "allocation_rate": 50},
]

MILESTONES = [
    # Phoenix
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "name": "Kick-off ART Phoenix", "date_baseline": "2025-01-20", "date_forecast": "2025-01-20", "date_actual": "2025-01-20", "status": "achieved", "is_governance": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "name": "PI Planning #1 — PI2025-Q1", "date_baseline": "2025-03-15", "date_forecast": "2025-03-22", "date_actual": "2025-03-22", "status": "achieved", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "name": "Livraison MVP Core Digitale", "date_baseline": "2025-06-30", "date_forecast": "2025-08-31", "date_actual": None, "status": "at_risk", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "name": "Déploiement national Phase 1", "date_baseline": "2025-10-01", "date_forecast": "2025-12-01", "date_actual": None, "status": "at_risk", "is_governance": False},
    # SI Finance
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "name": "Recette fonctionnelle SI Finance", "date_baseline": "2025-04-30", "date_forecast": "2025-04-30", "date_actual": "2025-04-28", "status": "achieved", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "name": "Migration données historiques", "date_baseline": "2025-05-31", "date_forecast": "2025-05-31", "date_actual": None, "status": "planned", "is_governance": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "name": "Go-Live SI Finance", "date_baseline": "2025-06-30", "date_forecast": "2025-07-31", "date_actual": None, "status": "planned", "is_governance": True},
    # SAP
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "name": "Blueprint validé FICO/SD", "date_baseline": "2024-06-30", "date_forecast": "2024-08-15", "date_actual": "2024-08-15", "status": "achieved", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "name": "Recette intégration ERP-BI", "date_baseline": "2025-03-31", "date_forecast": "2025-07-31", "date_actual": None, "status": "delayed", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "name": "Go-Live SAP S/4HANA", "date_baseline": "2025-09-30", "date_forecast": "2026-03-31", "date_actual": None, "status": "delayed", "is_governance": True},
    # Digital Workplace
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "name": "Déploiement Teams & SharePoint Phase 1", "date_baseline": "2025-04-30", "date_forecast": "2025-04-30", "date_actual": "2025-04-25", "status": "achieved", "is_governance": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "name": "Formation collaborateurs (2 000 users)", "date_baseline": "2025-07-31", "date_forecast": "2025-07-31", "date_actual": None, "status": "planned", "is_governance": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "name": "Clôture projet Digital Workplace", "date_baseline": "2025-10-31", "date_forecast": "2025-10-31", "date_actual": None, "status": "planned", "is_governance": True},
    # CRM Salesforce
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "name": "Design Phase validé — Sales Cloud", "date_baseline": "2025-04-30", "date_forecast": "2025-05-15", "date_actual": None, "status": "at_risk", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "name": "Pilote commercial région Île-de-France", "date_baseline": "2025-09-30", "date_forecast": "2025-11-30", "date_actual": None, "status": "planned", "is_governance": False},
    # Cloud Azure
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "name": "Migration Datacenter Paris — Wave 1", "date_baseline": "2025-03-31", "date_forecast": "2025-03-31", "date_actual": "2025-03-28", "status": "achieved", "is_governance": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "name": "Migration Wave 2 — Applications critiques", "date_baseline": "2025-08-31", "date_forecast": "2025-08-31", "date_actual": None, "status": "planned", "is_governance": True},
    # Portail RH
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "name": "Livraison Portail RH v1 (prévu)", "date_baseline": "2025-03-31", "date_forecast": "2025-06-30", "date_actual": None, "status": "delayed", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "name": "Tests UAT collaborateurs", "date_baseline": "2025-04-30", "date_forecast": "2025-08-31", "date_actual": None, "status": "delayed", "is_governance": False},
    # DORA NIS2
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "name": "GAP Analysis DORA validée", "date_baseline": "2025-05-31", "date_forecast": "2025-05-31", "date_actual": None, "status": "planned", "is_governance": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "name": "Plan de remédiation approuvé COMEX", "date_baseline": "2025-07-31", "date_forecast": "2025-07-31", "date_actual": None, "status": "planned", "is_governance": True},
]

GOVERNANCE = [
    {
        "governance_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "name": "COPIL Mensuel Avril 2025 — Portefeuille Projets",
        "type": "copil",
        "date_scheduled": "2025-04-24T14:00:00Z",
        "projects_scope": PROJECT_IDS[:5],
        "sanity_check_status": "passed",
        "sanity_check_report": {
            "checks": [
                {"rule": "Budget forecast > budget total", "projects_flagged": [PROJECT_IDS[2]], "severity": "high"},
                {"rule": "End forecast > baseline + 90j", "projects_flagged": [PROJECT_IDS[2], PROJECT_IDS[6]], "severity": "medium"},
            ],
            "summary": "2 projets nécessitent une attention particulière.",
        },
    },
    {
        "governance_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "name": "COMEX Transformation Digitale — Bilan S1 2025",
        "type": "comex",
        "date_scheduled": "2025-06-15T09:00:00Z",
        "projects_scope": PROJECT_IDS[:3],
        "sanity_check_status": "pending",
        "sanity_check_report": {},
    },
    {
        "governance_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "name": "Steering Committee ERP SAP S/4HANA — Point d'avancement Q2",
        "type": "steering",
        "date_scheduled": "2025-05-07T10:00:00Z",
        "projects_scope": [PROJECT_IDS[2]],
        "sanity_check_status": "failed",
        "sanity_check_report": {
            "checks": [
                {"rule": "Budget forecast > budget total + 20%", "projects_flagged": [PROJECT_IDS[2]], "severity": "critical"},
                {"rule": "Milestone critique dépassé > 6 mois", "projects_flagged": [PROJECT_IDS[2]], "severity": "critical"},
            ],
            "summary": "Situation critique — dépassement budget +26% et retard jalon Go-Live de 6 mois.",
        },
    },
    {
        "governance_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "name": "COPIL Conformité DORA & NIS2 — Lancement Programme",
        "type": "copil",
        "date_scheduled": "2025-04-10T11:00:00Z",
        "projects_scope": [PROJECT_IDS[7]],
        "sanity_check_status": "passed",
        "sanity_check_report": {"summary": "Projet conforme aux critères de lancement."},
    },
    {
        "governance_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "name": "Review Programme CRM Salesforce — Q2 2025",
        "type": "review",
        "date_scheduled": "2025-05-20T14:30:00Z",
        "projects_scope": [PROJECT_IDS[4]],
        "sanity_check_status": "pending",
        "sanity_check_report": {},
    },
]


async def seed():
    print("=== Seed Projetenne ===")

    # Tenant
    existing = await db.tenants.find_one({"tenant_id": TENANT_ID})
    if existing:
        print("Données de seed déjà présentes. Suppression et re-création...")
        await db.tenants.delete_many({"tenant_id": TENANT_ID})
        await db.users.delete_many({"tenant_id": TENANT_ID})
        await db.projects.delete_many({"tenant_id": TENANT_ID})
        await db.resources.delete_many({"tenant_id": TENANT_ID})
        await db.allocations.delete_many({})
        await db.milestones.delete_many({})
        await db.governance.delete_many({"tenant_id": TENANT_ID})

    await db.tenants.insert_one({
        "tenant_id": TENANT_ID,
        "name": "Groupe Altair Industries",
        "plan": "enterprise",
        "settings": {"currency": "EUR", "locale": "fr-FR"},
        "created_at": "2024-01-01T00:00:00Z",
    })
    print("Tenant créé : Groupe Altair Industries")

    # Users
    users = [
        {"user_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "email": "admin@altair.fr", "name": "Sophie Martin", "role": "TENANT_ADMIN", "password_hash": pw("Admin1234!")},
        {"user_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "email": "pmo@altair.fr", "name": "Thomas Dubois", "role": "PMO_USER", "password_hash": pw("Pmo1234!")},
        {"user_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "email": "viewer@altair.fr", "name": "Marie Leclerc", "role": "READ_ONLY", "password_hash": pw("View1234!")},
    ]
    await db.users.insert_many(users)
    print(f"Utilisateurs créés : {[u['email'] for u in users]}")

    await db.projects.insert_many(PROJECTS)
    print(f"Projets créés : {len(PROJECTS)}")

    await db.resources.insert_many(RESOURCES)
    print(f"Ressources créées : {len(RESOURCES)}")

    await db.allocations.insert_many(ALLOCATIONS)
    print(f"Allocations créées : {len(ALLOCATIONS)}")

    await db.milestones.insert_many(MILESTONES)
    print(f"Jalons créés : {len(MILESTONES)}")

    await db.governance.insert_many(GOVERNANCE)
    print(f"Instances de gouvernance créées : {len(GOVERNANCE)}")

    print("\n=== Comptes disponibles ===")
    print("  admin@altair.fr    / Admin1234!  (TENANT_ADMIN)")
    print("  pmo@altair.fr      / Pmo1234!    (PMO_USER)")
    print("  viewer@altair.fr   / View1234!   (READ_ONLY)")
    print("\nSeed terminé avec succès.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
