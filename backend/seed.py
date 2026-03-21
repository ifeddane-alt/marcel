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

GOVERNANCE = [    {
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

TASKS = [
    # ===== P0 — Projet Phoenix (SAFe) — ORANGE =====
    # Epic Cadrage: end 2025-03-31, ref 2025-04-30 → delay 30j → RED date
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "name": "Epic — Cadrage & Architecture SAFe", "type": "epic", "status": "in_progress",
     "date_start_planned": "2025-01-15", "date_end_planned": "2025-03-31",
     "date_start_actual": "2025-01-15", "date_end_actual": None,
     "budget_planned_k": 350, "budget_consumed_k": 200, "budget_restant_estime": 155,
     "jh_planned": 700, "jh_consumed": 400, "jh_restants_estimes": 310,
     "resource_id": RESOURCE_IDS[0], "created_at": "2025-01-10T10:00:00Z"},
    # Feature Data: end 2025-08-31, future → delay 0, budget 104% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "name": "Feature — Plateforme Data Unifiée v1", "type": "feature", "status": "in_progress",
     "date_start_planned": "2025-02-01", "date_end_planned": "2025-08-31",
     "date_start_actual": "2025-02-03", "date_end_actual": None,
     "budget_planned_k": 1100, "budget_consumed_k": 700, "budget_restant_estime": 450,
     "jh_planned": 2200, "jh_consumed": 1400, "jh_restants_estimes": 900,
     "resource_id": RESOURCE_IDS[7], "created_at": "2025-01-10T10:00:00Z"},
    # US ERP DataLake: delayed, end 2025-06-30 future → delay 0 but budget 103% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "name": "User Story — Intégration ERP → Data Lake", "type": "user_story", "status": "delayed",
     "date_start_planned": "2025-03-01", "date_end_planned": "2025-06-30",
     "date_start_actual": "2025-03-10", "date_end_actual": None,
     "budget_planned_k": 800, "budget_consumed_k": 550, "budget_restant_estime": 280,
     "jh_planned": 1600, "jh_consumed": 1000, "jh_restants_estimes": 560,
     "resource_id": RESOURCE_IDS[1], "created_at": "2025-01-10T10:00:00Z"},
    # Portail Client: not_started, future → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "name": "Feature — Portail Client Digital", "type": "feature", "status": "not_started",
     "date_start_planned": "2025-09-01", "date_end_planned": "2025-12-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 900, "budget_consumed_k": 0, "budget_restant_estime": 900,
     "jh_planned": 1800, "jh_consumed": 0, "jh_restants_estimes": 1800,
     "resource_id": RESOURCE_IDS[8], "created_at": "2025-01-10T10:00:00Z"},
    # Sécurisation: completed, delay -1j → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "name": "Tâche — Sécurisation Infrastructure Production", "type": "tâche", "status": "completed",
     "date_start_planned": "2025-01-20", "date_end_planned": "2025-02-28",
     "date_start_actual": "2025-01-20", "date_end_actual": "2025-02-27",
     "budget_planned_k": 250, "budget_consumed_k": 250, "budget_restant_estime": 0,
     "jh_planned": 500, "jh_consumed": 500, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[4], "created_at": "2025-01-10T10:00:00Z"},
    # Reporting: end 2025-07-31, future → delay 0, budget 107% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "name": "User Story — Module Reporting Exécutif", "type": "user_story", "status": "in_progress",
     "date_start_planned": "2025-04-01", "date_end_planned": "2025-07-31",
     "date_start_actual": "2025-04-05", "date_end_actual": None,
     "budget_planned_k": 650, "budget_consumed_k": 380, "budget_restant_estime": 320,
     "jh_planned": 1300, "jh_consumed": 700, "jh_restants_estimes": 640,
     "resource_id": RESOURCE_IDS[7], "created_at": "2025-01-10T10:00:00Z"},

    # ===== P1 — SI Finance (Waterfall) — GREEN =====
    # Analyse: completed, delay -1j → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "name": "Tâche — Analyse des Besoins Fonctionnels Finance", "type": "tâche", "status": "completed",
     "date_start_planned": "2024-09-01", "date_end_planned": "2024-10-15",
     "date_start_actual": "2024-09-01", "date_end_actual": "2024-10-14",
     "budget_planned_k": 200, "budget_consumed_k": 190, "budget_restant_estime": 0,
     "jh_planned": 400, "jh_consumed": 380, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[3], "created_at": "2024-08-15T10:00:00Z"},
    # Conception: completed, delay +5j → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "name": "Tâche — Conception Architecture SI Finance", "type": "tâche", "status": "completed",
     "date_start_planned": "2024-10-16", "date_end_planned": "2024-12-15",
     "date_start_actual": "2024-10-16", "date_end_actual": "2024-12-20",
     "budget_planned_k": 350, "budget_consumed_k": 340, "budget_restant_estime": 0,
     "jh_planned": 700, "jh_consumed": 680, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[0], "created_at": "2024-08-15T10:00:00Z"},
    # Dev Comptabilité: in_progress, end 2025-04-30 = ref → delay 0, budget 100% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "name": "Tâche — Développement Module Comptabilité Générale", "type": "tâche", "status": "in_progress",
     "date_start_planned": "2025-01-02", "date_end_planned": "2025-04-30",
     "date_start_actual": "2025-01-06", "date_end_actual": None,
     "budget_planned_k": 480, "budget_consumed_k": 380, "budget_restant_estime": 100,
     "jh_planned": 960, "jh_consumed": 720, "jh_restants_estimes": 240,
     "resource_id": RESOURCE_IDS[2], "created_at": "2024-08-15T10:00:00Z"},
    # Dev CdG: in_progress, end 2025-05-15 future → delay 0, budget 99% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "name": "Tâche — Développement Module Contrôle de Gestion", "type": "tâche", "status": "in_progress",
     "date_start_planned": "2025-01-15", "date_end_planned": "2025-05-15",
     "date_start_actual": "2025-01-20", "date_end_actual": None,
     "budget_planned_k": 400, "budget_consumed_k": 260, "budget_restant_estime": 135,
     "jh_planned": 800, "jh_consumed": 560, "jh_restants_estimes": 240,
     "resource_id": RESOURCE_IDS[3], "created_at": "2024-08-15T10:00:00Z"},
    # Recette: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "name": "Tâche — Recette & Tests d'Intégration", "type": "tâche", "status": "not_started",
     "date_start_planned": "2025-05-16", "date_end_planned": "2025-06-15",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 200, "budget_consumed_k": 0, "budget_restant_estime": 200,
     "jh_planned": 400, "jh_consumed": 0, "jh_restants_estimes": 400,
     "resource_id": RESOURCE_IDS[3], "created_at": "2024-08-15T10:00:00Z"},
    # Formation: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "name": "Tâche — Formation Équipes Finance & Déploiement", "type": "tâche", "status": "not_started",
     "date_start_planned": "2025-06-16", "date_end_planned": "2025-07-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 120, "budget_consumed_k": 0, "budget_restant_estime": 120,
     "jh_planned": 240, "jh_consumed": 0, "jh_restants_estimes": 240,
     "resource_id": RESOURCE_IDS[1], "created_at": "2024-08-15T10:00:00Z"},

    # ===== P2 — SAP S/4HANA (Waterfall) — RED =====
    # Blueprint FICO: completed, delay +15j → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "name": "Tâche — Blueprint FICO/CO", "type": "tâche", "status": "completed",
     "date_start_planned": "2024-03-01", "date_end_planned": "2024-05-31",
     "date_start_actual": "2024-03-01", "date_end_actual": "2024-06-15",
     "budget_planned_k": 400, "budget_consumed_k": 430, "budget_restant_estime": 0,
     "jh_planned": 800, "jh_consumed": 860, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[3], "created_at": "2024-02-15T10:00:00Z"},
    # Blueprint MMSD: completed, delay +20j → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "name": "Tâche — Blueprint MM/SD/PP", "type": "tâche", "status": "completed",
     "date_start_planned": "2024-05-01", "date_end_planned": "2024-08-31",
     "date_start_actual": "2024-05-10", "date_end_actual": "2024-09-20",
     "budget_planned_k": 450, "budget_consumed_k": 480, "budget_restant_estime": 0,
     "jh_planned": 900, "jh_consumed": 960, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[3], "created_at": "2024-02-15T10:00:00Z"},
    # RICEFW: delayed, end 2025-03-31, ref 2025-04-30 → delay 30j + budget 122% → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "name": "Tâche — Développement RICEFW & Spécifiques Métier", "type": "tâche", "status": "delayed",
     "date_start_planned": "2024-07-01", "date_end_planned": "2025-03-31",
     "date_start_actual": "2024-07-15", "date_end_actual": None,
     "budget_planned_k": 1800, "budget_consumed_k": 1950, "budget_restant_estime": 250,
     "jh_planned": 3600, "jh_consumed": 3800, "jh_restants_estimes": 450,
     "resource_id": RESOURCE_IDS[2], "created_at": "2024-02-15T10:00:00Z"},
    # Migration données: delayed, end 2025-02-28, ref 2025-04-30 → delay 61j + budget 153% → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "name": "Tâche — Migration & Reprise de Données Historiques", "type": "tâche", "status": "delayed",
     "date_start_planned": "2024-09-01", "date_end_planned": "2025-02-28",
     "date_start_actual": "2024-09-20", "date_end_actual": None,
     "budget_planned_k": 700, "budget_consumed_k": 820, "budget_restant_estime": 250,
     "jh_planned": 1400, "jh_consumed": 1500, "jh_restants_estimes": 400,
     "resource_id": RESOURCE_IDS[7], "created_at": "2024-02-15T10:00:00Z"},
    # Tests régression: in_progress, end 2025-05-31 future → delay 0, budget 103% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "name": "Tâche — Tests de Régression & Intégration SI", "type": "tâche", "status": "in_progress",
     "date_start_planned": "2025-01-15", "date_end_planned": "2025-05-31",
     "date_start_actual": "2025-02-01", "date_end_actual": None,
     "budget_planned_k": 600, "budget_consumed_k": 380, "budget_restant_estime": 240,
     "jh_planned": 1200, "jh_consumed": 700, "jh_restants_estimes": 520,
     "resource_id": RESOURCE_IDS[2], "created_at": "2024-02-15T10:00:00Z"},
    # Go-Live préparation: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "name": "Tâche — Préparation Go-Live & Plan Cutover", "type": "tâche", "status": "not_started",
     "date_start_planned": "2025-10-01", "date_end_planned": "2026-01-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 500, "budget_consumed_k": 0, "budget_restant_estime": 500,
     "jh_planned": 1000, "jh_consumed": 0, "jh_restants_estimes": 1000,
     "resource_id": RESOURCE_IDS[1], "created_at": "2024-02-15T10:00:00Z"},
    # Hypercare: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "name": "Tâche — Hypercare & Support Post-Go-Live", "type": "tâche", "status": "not_started",
     "date_start_planned": "2026-02-01", "date_end_planned": "2026-03-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 400, "budget_consumed_k": 0, "budget_restant_estime": 400,
     "jh_planned": 800, "jh_consumed": 0, "jh_restants_estimes": 800,
     "resource_id": RESOURCE_IDS[1], "created_at": "2024-02-15T10:00:00Z"},

    # ===== P3 — Digital Workplace (Agile) — GREEN =====
    # Teams/Exchange: completed, delay -3j → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "name": "Feature — Déploiement Teams & Exchange Online", "type": "feature", "status": "completed",
     "date_start_planned": "2025-02-01", "date_end_planned": "2025-03-31",
     "date_start_actual": "2025-02-01", "date_end_actual": "2025-03-28",
     "budget_planned_k": 120, "budget_consumed_k": 115, "budget_restant_estime": 0,
     "jh_planned": 240, "jh_consumed": 230, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[4], "created_at": "2025-01-20T10:00:00Z"},
    # SharePoint: in_progress, end 2025-07-31 future → delay 0, budget 100% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "name": "Feature — Intranet SharePoint Nouvelle Génération", "type": "feature", "status": "in_progress",
     "date_start_planned": "2025-03-01", "date_end_planned": "2025-07-31",
     "date_start_actual": "2025-03-03", "date_end_actual": None,
     "budget_planned_k": 250, "budget_consumed_k": 170, "budget_restant_estime": 80,
     "jh_planned": 500, "jh_consumed": 330, "jh_restants_estimes": 170,
     "resource_id": RESOURCE_IDS[8], "created_at": "2025-01-20T10:00:00Z"},
    # Power Automate: in_progress, end 2025-07-31 → delay 0, budget 100% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "name": "User Story — Workflows Power Automate RH & Finance", "type": "user_story", "status": "in_progress",
     "date_start_planned": "2025-04-01", "date_end_planned": "2025-07-31",
     "date_start_actual": "2025-04-07", "date_end_actual": None,
     "budget_planned_k": 150, "budget_consumed_k": 95, "budget_restant_estime": 55,
     "jh_planned": 300, "jh_consumed": 190, "jh_restants_estimes": 110,
     "resource_id": RESOURCE_IDS[5], "created_at": "2025-01-20T10:00:00Z"},
    # Power BI: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "name": "Feature — Power BI Dashboards Métier", "type": "feature", "status": "not_started",
     "date_start_planned": "2025-07-01", "date_end_planned": "2025-10-15",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 180, "budget_consumed_k": 0, "budget_restant_estime": 180,
     "jh_planned": 360, "jh_consumed": 0, "jh_restants_estimes": 360,
     "resource_id": RESOURCE_IDS[7], "created_at": "2025-01-20T10:00:00Z"},
    # Formation Wave 1: completed, delay -5j → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "name": "Tâche — Formation Utilisateurs Wave 1 (500 users)", "type": "tâche", "status": "completed",
     "date_start_planned": "2025-04-01", "date_end_planned": "2025-04-30",
     "date_start_actual": "2025-04-01", "date_end_actual": "2025-04-25",
     "budget_planned_k": 80, "budget_consumed_k": 78, "budget_restant_estime": 0,
     "jh_planned": 160, "jh_consumed": 155, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[6], "created_at": "2025-01-20T10:00:00Z"},

    # ===== P4 — CRM Salesforce (SAFe) — ORANGE =====
    # Epic Architecture: completed, delay +3j + budget 102.5% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "name": "Epic — Architecture & Gouvernance Data CRM", "type": "epic", "status": "completed",
     "date_start_planned": "2025-03-01", "date_end_planned": "2025-04-15",
     "date_start_actual": "2025-03-01", "date_end_actual": "2025-04-18",
     "budget_planned_k": 200, "budget_consumed_k": 205, "budget_restant_estime": 0,
     "jh_planned": 400, "jh_consumed": 410, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[0], "created_at": "2025-02-10T10:00:00Z"},
    # Sales Cloud: in_progress, end 2025-10-31 future → delay 0, budget 103% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "name": "Feature — Implémentation Sales Cloud", "type": "feature", "status": "in_progress",
     "date_start_planned": "2025-04-01", "date_end_planned": "2025-10-31",
     "date_start_actual": "2025-04-07", "date_end_actual": None,
     "budget_planned_k": 750, "budget_consumed_k": 420, "budget_restant_estime": 355,
     "jh_planned": 1500, "jh_consumed": 800, "jh_restants_estimes": 740,
     "resource_id": RESOURCE_IDS[5], "created_at": "2025-02-10T10:00:00Z"},
    # Intégration CRM-SAP: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "name": "Feature — Intégration CRM-SAP ERP", "type": "feature", "status": "not_started",
     "date_start_planned": "2025-09-01", "date_end_planned": "2026-01-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 600, "budget_consumed_k": 0, "budget_restant_estime": 600,
     "jh_planned": 1200, "jh_consumed": 0, "jh_restants_estimes": 1200,
     "resource_id": RESOURCE_IDS[2], "created_at": "2025-02-10T10:00:00Z"},
    # Dashboard Perf: in_progress, end 2025-08-31 future → delay 0, budget 105% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "name": "User Story — Dashboard Performance Commerciale", "type": "user_story", "status": "in_progress",
     "date_start_planned": "2025-05-01", "date_end_planned": "2025-08-31",
     "date_start_actual": "2025-05-05", "date_end_actual": None,
     "budget_planned_k": 300, "budget_consumed_k": 195, "budget_restant_estime": 115,
     "jh_planned": 600, "jh_consumed": 380, "jh_restants_estimes": 220,
     "resource_id": RESOURCE_IDS[5], "created_at": "2025-02-10T10:00:00Z"},
    # Service Cloud: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "name": "Feature — Service Cloud — Gestion Tickets Clients", "type": "feature", "status": "not_started",
     "date_start_planned": "2025-11-01", "date_end_planned": "2026-03-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 450, "budget_consumed_k": 0, "budget_restant_estime": 450,
     "jh_planned": 900, "jh_consumed": 0, "jh_restants_estimes": 900,
     "resource_id": RESOURCE_IDS[6], "created_at": "2025-02-10T10:00:00Z"},
    # Migration CRM: in_progress, end 2025-09-30 future → delay 0, budget 105.6% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "name": "Tâche — Migration Données CRM Legacy → Salesforce", "type": "tâche", "status": "in_progress",
     "date_start_planned": "2025-06-01", "date_end_planned": "2025-09-30",
     "date_start_actual": "2025-06-10", "date_end_actual": None,
     "budget_planned_k": 180, "budget_consumed_k": 150, "budget_restant_estime": 40,
     "jh_planned": 360, "jh_consumed": 300, "jh_restants_estimes": 80,
     "resource_id": RESOURCE_IDS[7], "created_at": "2025-02-10T10:00:00Z"},

    # ===== P5 — Cloud Azure (Agile) — GREEN =====
    # Landing Zone: completed, delay -3j → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "name": "Tâche — Architecture Azure Landing Zone", "type": "tâche", "status": "completed",
     "date_start_planned": "2025-01-01", "date_end_planned": "2025-01-31",
     "date_start_actual": "2025-01-01", "date_end_actual": "2025-01-28",
     "budget_planned_k": 100, "budget_consumed_k": 95, "budget_restant_estime": 0,
     "jh_planned": 200, "jh_consumed": 190, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[0], "created_at": "2024-12-01T10:00:00Z"},
    # Wave 1: completed, delay -3j → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "name": "Feature — Migration Wave 1 — Services Non-Critiques", "type": "feature", "status": "completed",
     "date_start_planned": "2025-02-01", "date_end_planned": "2025-03-31",
     "date_start_actual": "2025-02-01", "date_end_actual": "2025-03-28",
     "budget_planned_k": 200, "budget_consumed_k": 195, "budget_restant_estime": 0,
     "jh_planned": 400, "jh_consumed": 395, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[4], "created_at": "2024-12-01T10:00:00Z"},
    # Wave 2: in_progress, end 2025-08-31 future → delay 0, budget 98.7% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "name": "Feature — Migration Wave 2 — Applications Critiques", "type": "feature", "status": "in_progress",
     "date_start_planned": "2025-04-01", "date_end_planned": "2025-08-31",
     "date_start_actual": "2025-04-03", "date_end_actual": None,
     "budget_planned_k": 380, "budget_consumed_k": 210, "budget_restant_estime": 165,
     "jh_planned": 760, "jh_consumed": 400, "jh_restants_estimes": 355,
     "resource_id": RESOURCE_IDS[4], "created_at": "2024-12-01T10:00:00Z"},
    # IAM: completed, delay -3j → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "name": "Tâche — Sécurité & IAM — Configuration Zero Trust", "type": "tâche", "status": "completed",
     "date_start_planned": "2025-02-15", "date_end_planned": "2025-04-15",
     "date_start_actual": "2025-02-15", "date_end_actual": "2025-04-12",
     "budget_planned_k": 160, "budget_consumed_k": 155, "budget_restant_estime": 0,
     "jh_planned": 320, "jh_consumed": 310, "jh_restants_estimes": 0,
     "resource_id": RESOURCE_IDS[9], "created_at": "2024-12-01T10:00:00Z"},
    # FinOps: in_progress, end 2025-11-30 future → delay 0, budget 97% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "name": "Feature — FinOps & Optimisation Coûts Azure", "type": "feature", "status": "in_progress",
     "date_start_planned": "2025-06-01", "date_end_planned": "2025-11-30",
     "date_start_actual": "2025-06-05", "date_end_actual": None,
     "budget_planned_k": 100, "budget_consumed_k": 25, "budget_restant_estime": 72,
     "jh_planned": 200, "jh_consumed": 50, "jh_restants_estimes": 145,
     "resource_id": RESOURCE_IDS[7], "created_at": "2024-12-01T10:00:00Z"},

    # ===== P6 — Portail RH (Agile) — RED =====
    # Module Congés: delayed, end 2025-01-31 → delay 89j + budget 161% → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "name": "Feature — Module Congés & Absences Self-Service", "type": "feature", "status": "delayed",
     "date_start_planned": "2024-11-01", "date_end_planned": "2025-01-31",
     "date_start_actual": "2024-11-04", "date_end_actual": None,
     "budget_planned_k": 130, "budget_consumed_k": 145, "budget_restant_estime": 65,
     "jh_planned": 260, "jh_consumed": 285, "jh_restants_estimes": 135,
     "resource_id": RESOURCE_IDS[8], "created_at": "2024-10-15T10:00:00Z"},
    # Fiche Paie: delayed, end 2025-02-28 → delay 61j + budget 173% → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "name": "Feature — Fiche de Paie Dématérialisée", "type": "feature", "status": "delayed",
     "date_start_planned": "2024-11-15", "date_end_planned": "2025-02-28",
     "date_start_actual": "2024-11-18", "date_end_actual": None,
     "budget_planned_k": 150, "budget_consumed_k": 170, "budget_restant_estime": 90,
     "jh_planned": 300, "jh_consumed": 340, "jh_restants_estimes": 170,
     "resource_id": RESOURCE_IDS[8], "created_at": "2024-10-15T10:00:00Z"},
    # Onboarding: delayed, end 2025-03-31 → delay 30j + budget 167% → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "name": "User Story — Parcours Onboarding Digital Collaborateur", "type": "user_story", "status": "delayed",
     "date_start_planned": "2025-01-01", "date_end_planned": "2025-03-31",
     "date_start_actual": "2025-01-10", "date_end_actual": None,
     "budget_planned_k": 120, "budget_consumed_k": 130, "budget_restant_estime": 70,
     "jh_planned": 240, "jh_consumed": 260, "jh_restants_estimes": 140,
     "resource_id": RESOURCE_IDS[8], "created_at": "2024-10-15T10:00:00Z"},
    # Tests Perf: in_progress, end 2025-04-30 = ref → delay 0, budget 102.5% → ORANGE
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "name": "Tâche — Tests de Performance & Charge", "type": "tâche", "status": "in_progress",
     "date_start_planned": "2025-03-01", "date_end_planned": "2025-04-30",
     "date_start_actual": "2025-03-15", "date_end_actual": None,
     "budget_planned_k": 80, "budget_consumed_k": 60, "budget_restant_estime": 22,
     "jh_planned": 160, "jh_consumed": 120, "jh_restants_estimes": 42,
     "resource_id": RESOURCE_IDS[2], "created_at": "2024-10-15T10:00:00Z"},
    # Workday: delayed, end 2025-05-31 (future) → delay 0 but budget 176.7% → RED
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "name": "Feature — Intégration SIRH Workday", "type": "feature", "status": "delayed",
     "date_start_planned": "2025-02-01", "date_end_planned": "2025-05-31",
     "date_start_actual": "2025-02-10", "date_end_actual": None,
     "budget_planned_k": 150, "budget_consumed_k": 165, "budget_restant_estime": 100,
     "jh_planned": 300, "jh_consumed": 330, "jh_restants_estimes": 180,
     "resource_id": RESOURCE_IDS[9], "created_at": "2024-10-15T10:00:00Z"},

    # ===== P7 — DORA & NIS2 (Waterfall) — GREEN =====
    # GAP Analysis: in_progress, end 2025-05-31 future → delay 0, budget 99% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "name": "Tâche — GAP Analysis DORA & NIS2", "type": "tâche", "status": "in_progress",
     "date_start_planned": "2025-04-01", "date_end_planned": "2025-05-31",
     "date_start_actual": "2025-04-02", "date_end_actual": None,
     "budget_planned_k": 150, "budget_consumed_k": 120, "budget_restant_estime": 28,
     "jh_planned": 300, "jh_consumed": 230, "jh_restants_estimes": 55,
     "resource_id": RESOURCE_IDS[9], "created_at": "2025-03-01T10:00:00Z"},
    # Cartographie: in_progress, end 2025-06-30 future → delay 0, budget 97.5% → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "name": "Tâche — Cartographie Actifs & Processus Critiques", "type": "tâche", "status": "in_progress",
     "date_start_planned": "2025-04-15", "date_end_planned": "2025-06-30",
     "date_start_actual": "2025-04-15", "date_end_actual": None,
     "budget_planned_k": 200, "budget_consumed_k": 90, "budget_restant_estime": 105,
     "jh_planned": 400, "jh_consumed": 170, "jh_restants_estimes": 225,
     "resource_id": RESOURCE_IDS[0], "created_at": "2025-03-01T10:00:00Z"},
    # Politique Sécurité: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "name": "Tâche — Politique Sécurité & PCA/PRA", "type": "tâche", "status": "not_started",
     "date_start_planned": "2025-07-01", "date_end_planned": "2025-09-30",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 200, "budget_consumed_k": 0, "budget_restant_estime": 200,
     "jh_planned": 400, "jh_consumed": 0, "jh_restants_estimes": 400,
     "resource_id": RESOURCE_IDS[9], "created_at": "2025-03-01T10:00:00Z"},
    # Plan Remédiation: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "name": "Tâche — Plan de Remédiation NIS2", "type": "tâche", "status": "not_started",
     "date_start_planned": "2025-08-01", "date_end_planned": "2025-10-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 180, "budget_consumed_k": 0, "budget_restant_estime": 180,
     "jh_planned": 360, "jh_consumed": 0, "jh_restants_estimes": 360,
     "resource_id": RESOURCE_IDS[9], "created_at": "2025-03-01T10:00:00Z"},
    # Tests Résilience: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "name": "Tâche — Tests Résilience Opérationnelle", "type": "tâche", "status": "not_started",
     "date_start_planned": "2025-11-01", "date_end_planned": "2026-01-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 130, "budget_consumed_k": 0, "budget_restant_estime": 130,
     "jh_planned": 260, "jh_consumed": 0, "jh_restants_estimes": 260,
     "resource_id": RESOURCE_IDS[4], "created_at": "2025-03-01T10:00:00Z"},
    # Rapport DORA: not_started → GREEN
    {"task_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "name": "Tâche — Rapport DORA — Soumission Régulateur", "type": "tâche", "status": "not_started",
     "date_start_planned": "2026-01-01", "date_end_planned": "2026-03-31",
     "date_start_actual": None, "date_end_actual": None,
     "budget_planned_k": 80, "budget_consumed_k": 0, "budget_restant_estime": 80,
     "jh_planned": 160, "jh_consumed": 0, "jh_restants_estimes": 160,
     "resource_id": RESOURCE_IDS[1], "created_at": "2025-03-01T10:00:00Z"},
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
        "settings": {
            "currency": "EUR",
            "locale": "fr-FR",
            "task_rag": {
                "budget_threshold_pct": 115,
                "delay_threshold_days": 5,
                "reference_date": "2025-04-30",
            },
        },
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

    # Tasks seed
    await db.tasks.delete_many({})
    await db.tasks.insert_many(TASKS)
    print(f"Tâches créées : {len(TASKS)}")

    print("\n=== Comptes disponibles ===")
    print("  admin@altair.fr    / Admin1234!  (TENANT_ADMIN)")
    print("  pmo@altair.fr      / Pmo1234!    (PMO_USER)")
    print("  viewer@altair.fr   / View1234!   (READ_ONLY)")
    print("\nSeed terminé avec succès.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
