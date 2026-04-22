"""
Script de seed pour Projetenne — Groupe Altair Industries (démo CAC 40)
Usage: python seed.py
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, date, timedelta
from dateutil.relativedelta import relativedelta
from pathlib import Path

# Helper: date relative au mois courant pour les allocations
_today = date.today()


def _month(delta: int = 0) -> str:
    """Retourne le premier jour du mois relatif à aujourd'hui (YYYY-MM-DD)."""
    return (_today.replace(day=1) + relativedelta(months=delta)).strftime("%Y-%m-%d")

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
VENDOR_RESOURCE_IDS = [str(uuid.uuid4()) for _ in range(5)]

# SAFe — Chantier 3
TRAIN_ID         = str(uuid.uuid4())
PI_IDS           = [str(uuid.uuid4()) for _ in range(2)]
SPRINT_IDS       = [str(uuid.uuid4()) for _ in range(4)]
CAPABILITY_IDS   = [str(uuid.uuid4()) for _ in range(5)]
GOVERNANCE_IDS = [str(uuid.uuid4()) for _ in range(5)]
PROGRAM_IDS = [str(uuid.uuid4()) for _ in range(4)]
TEAM_IDS = [str(uuid.uuid4()) for _ in range(5)]

# Mapping programmes :
# PROGRAM_IDS[0] = Transformation Digitale & Métiers  → P0 Phoenix, P4 CRM Salesforce
# PROGRAM_IDS[1] = Modernisation SI & Infrastructure  → P2 ERP SAP, P5 Cloud Azure
# PROGRAM_IDS[2] = Pilotage Finance & Expérience Coll → P1 SI Finance, P3 Digital Workplace
# PROGRAM_IDS[3] = Conformité, RH & Résilience        → P6 Portail RH, P7 DORA NIS2

TEAMS = [
    {
        "team_id": TEAM_IDS[0],
        "tenant_id": TENANT_ID,
        "name": "Dev A",
        "manager_resource_id": RESOURCE_IDS[2],
        "train_id": None,
        "created_at": "2025-01-01T00:00:00Z",
    },
    {
        "team_id": TEAM_IDS[1],
        "tenant_id": TENANT_ID,
        "name": "Dev B",
        "manager_resource_id": RESOURCE_IDS[5],
        "train_id": None,
        "created_at": "2025-01-01T00:00:00Z",
    },
    {
        "team_id": TEAM_IDS[2],
        "tenant_id": TENANT_ID,
        "name": "Infra",
        "manager_resource_id": RESOURCE_IDS[4],
        "train_id": None,
        "created_at": "2025-01-01T00:00:00Z",
    },
    {
        "team_id": TEAM_IDS[3],
        "tenant_id": TENANT_ID,
        "name": "QA",
        "manager_resource_id": RESOURCE_IDS[6],
        "train_id": None,
        "created_at": "2025-01-01T00:00:00Z",
    },
    {
        "team_id": TEAM_IDS[4],
        "tenant_id": TENANT_ID,
        "name": "Support",
        "manager_resource_id": RESOURCE_IDS[9],
        "train_id": None,
        "created_at": "2025-01-01T00:00:00Z",
    },
]

PROGRAMS = [
    {
        "program_id": PROGRAM_IDS[0],
        "tenant_id": TENANT_ID,
        "name": "Transformation Digitale & Métiers",
        "description": "Refonte des processus métiers via le digital : CRM, collaboration, expérience client et groupe.",
        "owner": "Sophie Martin",
        "start_date": "2025-01-01",
        "end_date": "2026-12-31",
        "budget_keur": 6750,
        "status": "active",
    },
    {
        "program_id": PROGRAM_IDS[1],
        "tenant_id": TENANT_ID,
        "name": "Modernisation SI & Infrastructure",
        "description": "Migration vers une architecture Cloud-first et déploiement ERP SAP S/4HANA groupe.",
        "owner": "Jean-Philippe Moreau",
        "start_date": "2024-03-01",
        "end_date": "2026-06-30",
        "budget_keur": 6200,
        "status": "active",
    },
    {
        "program_id": PROGRAM_IDS[2],
        "tenant_id": TENANT_ID,
        "name": "Pilotage Finance & Expérience Collaborateur",
        "description": "Modernisation du SI Finance, du contrôle de gestion et des outils de travail M365.",
        "owner": "Marie-Christine Dupont",
        "start_date": "2024-09-01",
        "end_date": "2026-03-31",
        "budget_keur": 2600,
        "status": "active",
    },
    {
        "program_id": PROGRAM_IDS[3],
        "tenant_id": TENANT_ID,
        "name": "Conformité, RH & Résilience",
        "description": "Conformité DORA/NIS2, refonte portail RH collaborateur et résilience opérationnelle.",
        "owner": "Isabelle Fontaine",
        "start_date": "2024-11-01",
        "end_date": "2026-03-31",
        "budget_keur": 1550,
        "status": "active",
    },
]

PROJECTS = [
    {
        "project_id": PROJECT_IDS[0],
        "tenant_id": TENANT_ID,
        "source_id": "PRJ-2025-001",
        "source_tool": "Clarity PPM",
        "name": "Projet Phoenix — Transformation Digitale Groupe",
        "methodology": "safe",
        "status_rag": "orange",
        "status": "actif",
        "capex_planned": 1260000,
        "capex_consumed": 693000,
        "opex_planned": 2940000,
        "opex_consumed": 1617000,
        "budget_total": 4200000,
        "budget_consumed": 2310000,
        "budget_forecast": 4550000,
        "eac": 4550000,
        "budget_revision_history": [
            {"date": "2025-03-01", "old_eac": 4200000, "new_eac": 4550000,
             "reason": "Extension périmètre — ajout module reporting exécutif", "author": "Sophie Martin"},
        ],
        "jh_planned": 8400,
        "jh_consumed": 4200,
        "start_date": "2025-01-15",
        "end_date_baseline": "2025-12-31",
        "end_date_forecast": "2026-02-28",
        "end_date_actual": None,
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "DG", "program": "PHOENIX"},
        "program_id": PROGRAM_IDS[0],
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
        "status": "actif",
        "capex_planned": 360000,
        "capex_consumed": 252000,
        "opex_planned": 1440000,
        "opex_consumed": 1008000,
        "budget_total": 1800000,
        "budget_consumed": 1260000,
        "budget_forecast": 1850000,
        "eac": 1850000,
        "budget_revision_history": [
            {"date": "2025-01-15", "old_eac": 1800000, "new_eac": 1850000,
             "reason": "Dépassement charges de recette fonctionnelle", "author": "Thomas Dubois"},
        ],
        "jh_planned": 3600,
        "jh_consumed": 2520,
        "start_date": "2024-09-01",
        "end_date_baseline": "2025-06-30",
        "end_date_forecast": "2025-07-31",
        "end_date_actual": None,
        "last_sync_at": "2025-04-19T08:00:00Z",
        "metadata": {"sponsor": "CFO", "program": "FIN2025"},
        "program_id": PROGRAM_IDS[2],
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
        "status": "actif",
        "capex_planned": 2000000,
        "capex_consumed": 1640000,
        "opex_planned": 3000000,
        "opex_consumed": 2460000,
        "budget_total": 5000000,
        "budget_consumed": 4100000,
        "budget_forecast": 6300000,
        "eac": 6300000,
        "budget_revision_history": [
            {"date": "2024-11-15", "old_eac": 5000000, "new_eac": 5800000,
             "reason": "Complexité migration données — 3 entités supplémentaires", "author": "Sophie Martin"},
            {"date": "2025-02-20", "old_eac": 5800000, "new_eac": 6300000,
             "reason": "Extension contrat intégrateur — dérive planning blueprint", "author": "Thomas Dubois"},
        ],
        "jh_planned": 10000,
        "jh_consumed": 8200,
        "start_date": "2024-03-01",
        "end_date_baseline": "2025-09-30",
        "end_date_forecast": "2026-03-31",
        "end_date_actual": None,
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "DSI", "program": "ERP-SAP"},
        "program_id": PROGRAM_IDS[1],
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
        "status": "actif",
        "capex_planned": 240000,
        "capex_consumed": 168000,
        "opex_planned": 560000,
        "opex_consumed": 392000,
        "budget_total": 800000,
        "budget_consumed": 560000,
        "budget_forecast": 820000,
        "eac": 820000,
        "budget_revision_history": [],
        "jh_planned": 1600,
        "jh_consumed": 1050,
        "start_date": "2025-02-01",
        "end_date_baseline": "2025-10-31",
        "end_date_forecast": "2025-10-31",
        "end_date_actual": None,
        "last_sync_at": "2025-04-18T08:00:00Z",
        "metadata": {"sponsor": "DRH", "program": "DW2025"},
        "program_id": PROGRAM_IDS[2],
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
        "status": "actif",
        "capex_planned": 750000,
        "capex_consumed": 330000,
        "opex_planned": 1750000,
        "opex_consumed": 770000,
        "budget_total": 2500000,
        "budget_consumed": 1100000,
        "budget_forecast": 2750000,
        "eac": 2750000,
        "budget_revision_history": [
            {"date": "2025-04-05", "old_eac": 2500000, "new_eac": 2750000,
             "reason": "Ajout Sales Cloud Professional Edition — 150 licences supplémentaires", "author": "Sophie Martin"},
        ],
        "jh_planned": 5000,
        "jh_consumed": 2100,
        "start_date": "2025-03-01",
        "end_date_baseline": "2026-02-28",
        "end_date_forecast": "2026-04-30",
        "end_date_actual": None,
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "CCO", "program": "CRM-SF"},
        "program_id": PROGRAM_IDS[0],
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
        "status": "actif",
        "capex_planned": 600000,
        "capex_consumed": 330000,
        "opex_planned": 600000,
        "opex_consumed": 330000,
        "budget_total": 1200000,
        "budget_consumed": 660000,
        "budget_forecast": 1180000,
        "eac": 1180000,
        "budget_revision_history": [],
        "jh_planned": 2400,
        "jh_consumed": 1260,
        "start_date": "2025-01-01",
        "end_date_baseline": "2025-12-31",
        "end_date_forecast": "2025-11-30",
        "end_date_actual": None,
        "last_sync_at": "2025-04-19T08:00:00Z",
        "metadata": {"sponsor": "DSI", "program": "CLOUD-AZ"},
        "program_id": PROGRAM_IDS[1],
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
        "status": "en_pause",
        "capex_planned": 195000,
        "capex_consumed": 178500,
        "opex_planned": 455000,
        "opex_consumed": 416500,
        "budget_total": 650000,
        "budget_consumed": 595000,
        "budget_forecast": 860000,
        "eac": 860000,
        "budget_revision_history": [
            {"date": "2025-02-01", "old_eac": 650000, "new_eac": 750000,
             "reason": "Retard livraison backend — replanification sprint Q2", "author": "Thomas Dubois"},
            {"date": "2025-04-01", "old_eac": 750000, "new_eac": 860000,
             "reason": "Mise en pause projet — reprise Q3 2025 après arbitrage budgétaire", "author": "Sophie Martin"},
        ],
        "jh_planned": 1300,
        "jh_consumed": 1160,
        "start_date": "2024-11-01",
        "end_date_baseline": "2025-05-31",
        "end_date_forecast": "2025-09-30",
        "end_date_actual": None,
        "last_sync_at": "2025-04-18T08:00:00Z",
        "metadata": {"sponsor": "DRH", "program": "RH-PORTAIL"},
        "program_id": PROGRAM_IDS[3],
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
        "status": "en_preparation",
        "capex_planned": 270000,
        "capex_consumed": 94500,
        "opex_planned": 630000,
        "opex_consumed": 220500,
        "budget_total": 900000,
        "budget_consumed": 315000,
        "budget_forecast": 890000,
        "eac": 890000,
        "budget_revision_history": [],
        "jh_planned": 1800,
        "jh_consumed": 580,
        "start_date": "2025-04-01",
        "end_date_baseline": "2026-03-31",
        "end_date_forecast": "2026-03-31",
        "end_date_actual": None,
        "last_sync_at": "2025-04-20T08:00:00Z",
        "metadata": {"sponsor": "CISO", "program": "DORA-NIS2"},
        "program_id": PROGRAM_IDS[3],
        "created_at": "2025-03-01T10:00:00Z",
    },
]

RESOURCES = [
    {"resource_id": RESOURCE_IDS[0], "tenant_id": TENANT_ID, "name": "Sophie Martin", "role": "Architecte SI",
     "capacity_jh_month": 20, "team": "Dev A", "team_id": TEAM_IDS[0], "tjm_eur": 900, "availability_rate": 100},
    {"resource_id": RESOURCE_IDS[1], "tenant_id": TENANT_ID, "name": "Thomas Dubois", "role": "Chef de Projet Senior",
     "capacity_jh_month": 22, "team": "Dev A", "team_id": TEAM_IDS[0], "tjm_eur": 800, "availability_rate": 100},
    {"resource_id": RESOURCE_IDS[2], "tenant_id": TENANT_ID, "name": "Alexandre Moreau", "role": "Développeur Senior Java",
     "capacity_jh_month": 20, "team": "Dev A", "team_id": TEAM_IDS[0], "tjm_eur": 600, "availability_rate": 100},
    {"resource_id": RESOURCE_IDS[3], "tenant_id": TENANT_ID, "name": "Marie Fontaine", "role": "Business Analyst",
     "capacity_jh_month": 20, "team": "Dev B", "team_id": TEAM_IDS[1], "tjm_eur": 700, "availability_rate": 100},
    {"resource_id": RESOURCE_IDS[4], "tenant_id": TENANT_ID, "name": "Nicolas Petit", "role": "DevOps Engineer",
     "capacity_jh_month": 20, "team": "Infra", "team_id": TEAM_IDS[2], "tjm_eur": 600, "availability_rate": 100},
    {"resource_id": RESOURCE_IDS[5], "tenant_id": TENANT_ID, "name": "Isabelle Bernard", "role": "Product Owner",
     "capacity_jh_month": 18, "team": "Dev B", "team_id": TEAM_IDS[1], "tjm_eur": 700, "availability_rate": 100},
    {"resource_id": RESOURCE_IDS[6], "tenant_id": TENANT_ID, "name": "Julien Girard", "role": "Scrum Master",
     "capacity_jh_month": 15, "team": "QA", "team_id": TEAM_IDS[3], "tjm_eur": 550, "availability_rate": 80},
    {"resource_id": RESOURCE_IDS[7], "tenant_id": TENANT_ID, "name": "Camille Rousseau", "role": "Data Engineer",
     "capacity_jh_month": 20, "team": "Dev B", "team_id": TEAM_IDS[1], "tjm_eur": 600, "availability_rate": 100},
    {"resource_id": RESOURCE_IDS[8], "tenant_id": TENANT_ID, "name": "Lucie Dumont", "role": "UX/UI Designer",
     "capacity_jh_month": 18, "team": "QA", "team_id": TEAM_IDS[3], "tjm_eur": 550, "availability_rate": 90},
    {"resource_id": RESOURCE_IDS[9], "tenant_id": TENANT_ID, "name": "Marc Lefebvre", "role": "Expert Sécurité SI",
     "capacity_jh_month": 15, "team": "Support", "team_id": TEAM_IDS[4], "tjm_eur": 500, "availability_rate": 100},
    # ── Ressources externes — Suivi Fournisseurs (Bloc 2c) ────────────────────
    {"resource_id": VENDOR_RESOURCE_IDS[0], "tenant_id": TENANT_ID,
     "name": "Jean-Baptiste Renard", "role": "Consultant Cloud & DevOps",
     "capacity_jh_month": 20, "team": None, "team_id": None,
     "tjm_eur": 750, "availability_rate": 100,
     "resource_type": "externe_regie", "vendor": "Capgemini",
     "contract_tjm": 700, "forfait_envelope": None, "forfait_consumed": None,
     "contract_start": "2025-01-15", "contract_end": "2026-12-31"},
    {"resource_id": VENDOR_RESOURCE_IDS[1], "tenant_id": TENANT_ID,
     "name": "Aurore Chaumont", "role": "Data Architect",
     "capacity_jh_month": 18, "team": None, "team_id": None,
     "tjm_eur": 1020, "availability_rate": 100,
     "resource_type": "externe_regie", "vendor": "Accenture",
     "contract_tjm": 850, "forfait_envelope": None, "forfait_consumed": None,
     "contract_start": "2025-04-01", "contract_end": "2026-03-31"},
    {"resource_id": VENDOR_RESOURCE_IDS[2], "tenant_id": TENANT_ID,
     "name": "TMA SAP Module FI/CO", "role": "Prestation forfait",
     "capacity_jh_month": 0, "team": None, "team_id": None,
     "tjm_eur": None, "availability_rate": 100,
     "resource_type": "externe_forfait", "vendor": "Sopra Steria",
     "contract_tjm": None, "forfait_envelope": 180000, "forfait_consumed": 164700,
     "contract_start": "2025-01-01", "contract_end": "2026-06-30"},
    {"resource_id": VENDOR_RESOURCE_IDS[3], "tenant_id": TENANT_ID,
     "name": "Audit Cybersécurité DORA/NIS2", "role": "Prestation forfait",
     "capacity_jh_month": 0, "team": None, "team_id": None,
     "tjm_eur": None, "availability_rate": 100,
     "resource_type": "externe_forfait", "vendor": "IBM France",
     "contract_tjm": None, "forfait_envelope": 250000, "forfait_consumed": 62500,
     "contract_start": "2025-09-01", "contract_end": "2026-12-31"},
    {"resource_id": VENDOR_RESOURCE_IDS[4], "tenant_id": TENANT_ID,
     "name": "Kévin Marchand", "role": "Cloud Engineer Azure",
     "capacity_jh_month": 20, "team": None, "team_id": None,
     "tjm_eur": 680, "availability_rate": 100,
     "resource_type": "externe_regie", "vendor": "Atos",
     "contract_tjm": 680, "forfait_envelope": None, "forfait_consumed": None,
     "contract_start": "2025-02-01", "contract_end": "2026-03-15"},
]

ALLOCATIONS = [
    # Phoenix (SAFe)
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[0], "period_month": _month(-3), "jh_allocated": 15, "jh_consumed": 15, "allocation_rate": 75},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[1], "period_month": _month(-2), "jh_allocated": 20, "jh_consumed": 19, "allocation_rate": 91},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[2], "period_month": _month(-1), "jh_allocated": 18, "jh_consumed": 18, "allocation_rate": 90},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[5], "period_month": _month(0),  "jh_allocated": 16, "jh_consumed":  0, "allocation_rate": 89},
    # SI Finance
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "resource_id": RESOURCE_IDS[3], "period_month": _month(-3), "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "resource_id": RESOURCE_IDS[1], "period_month": _month(-2), "jh_allocated": 10, "jh_consumed": 10, "allocation_rate": 45},
    # SAP
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "resource_id": RESOURCE_IDS[0], "period_month": _month(-2), "jh_allocated":  5, "jh_consumed":  5, "allocation_rate": 25},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "resource_id": RESOURCE_IDS[3], "period_month": _month(-1), "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    # Digital Workplace
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "resource_id": RESOURCE_IDS[8], "period_month": _month(-1), "jh_allocated": 15, "jh_consumed": 12, "allocation_rate": 83},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "resource_id": RESOURCE_IDS[6], "period_month": _month(0),  "jh_allocated": 12, "jh_consumed":  0, "allocation_rate": 80},
    # CRM Salesforce
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "resource_id": RESOURCE_IDS[5], "period_month": _month(0),  "jh_allocated": 18, "jh_consumed":  0, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "resource_id": RESOURCE_IDS[2], "period_month": _month(1),  "jh_allocated": 20, "jh_consumed":  0, "allocation_rate": 100},
    # Cloud Azure
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": RESOURCE_IDS[4], "period_month": _month(-1), "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": RESOURCE_IDS[0], "period_month": _month(0),  "jh_allocated":  8, "jh_consumed":  0, "allocation_rate": 40},
    # Portail RH
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "resource_id": RESOURCE_IDS[8], "period_month": _month(1),  "jh_allocated": 18, "jh_consumed":  0, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "resource_id": RESOURCE_IDS[3], "period_month": _month(2),  "jh_allocated": 15, "jh_consumed":  0, "allocation_rate": 75},
    # DORA NIS2
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "resource_id": RESOURCE_IDS[9], "period_month": _month(0),  "jh_allocated": 15, "jh_consumed":  0, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "resource_id": RESOURCE_IDS[7], "period_month": _month(1),  "jh_allocated": 10, "jh_consumed":  0, "allocation_rate": 50},
    # Dev A — Thomas Dubois (Chef de Projet) charge mois courant
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": RESOURCE_IDS[1], "period_month": _month(0),  "jh_allocated": 16, "jh_consumed":  4, "allocation_rate": 73},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "resource_id": RESOURCE_IDS[1], "period_month": _month(0),  "jh_allocated":  6, "jh_consumed":  2, "allocation_rate": 27},
    # Dev A — Alexandre Moreau (Dev Java) charge mois courant
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "resource_id": RESOURCE_IDS[2], "period_month": _month(0),  "jh_allocated": 12, "jh_consumed":  5, "allocation_rate": 60},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "resource_id": RESOURCE_IDS[2], "period_month": _month(0),  "jh_allocated":  8, "jh_consumed":  3, "allocation_rate": 40},
    # ── Allocations ressources externes fournisseurs ───────────────────────────
    # Capgemini (Jean-Baptiste Renard) → Cloud Azure (P5)
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": VENDOR_RESOURCE_IDS[0], "period_month": _month(-2), "jh_allocated": 18, "jh_consumed": 18, "allocation_rate": 90},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": VENDOR_RESOURCE_IDS[0], "period_month": _month(-1), "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": VENDOR_RESOURCE_IDS[0], "period_month": _month(0),  "jh_allocated": 16, "jh_consumed":  5, "allocation_rate": 80},
    # Accenture (Aurore Chaumont) → Phoenix SAFe (P0)
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": VENDOR_RESOURCE_IDS[1], "period_month": _month(-3), "jh_allocated": 15, "jh_consumed": 15, "allocation_rate": 83},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": VENDOR_RESOURCE_IDS[1], "period_month": _month(-2), "jh_allocated": 18, "jh_consumed": 18, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "resource_id": VENDOR_RESOURCE_IDS[1], "period_month": _month(-1), "jh_allocated": 18, "jh_consumed": 16, "allocation_rate": 100},
    # Atos (Kévin Marchand) → Cloud Azure (P5)
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": VENDOR_RESOURCE_IDS[4], "period_month": _month(-1), "jh_allocated": 20, "jh_consumed": 20, "allocation_rate": 100},
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "resource_id": VENDOR_RESOURCE_IDS[4], "period_month": _month(0),  "jh_allocated": 15, "jh_consumed":  8, "allocation_rate": 75},
    # Sopra Steria (TMA SAP) → SAP (P2) — forfait, suivi par envelope/consumed
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "resource_id": VENDOR_RESOURCE_IDS[2], "period_month": _month(-6), "jh_allocated": 0, "jh_consumed": 0, "allocation_rate": 100},
    # IBM France (Audit DORA) → DORA NIS2 (P7) — forfait
    {"allocation_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "resource_id": VENDOR_RESOURCE_IDS[3], "period_month": _month(-3), "jh_allocated": 0, "jh_consumed": 0, "allocation_rate": 100},
]

MILESTONES = [
    # Phoenix (P0) — SAFe
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "tenant_id": TENANT_ID,
     "name": "Kick-off ART Phoenix", "date_baseline": "2025-01-20", "date_forecast": "2025-01-20", "date_actual": "2025-01-20",
     "status": "achieved", "is_governance": False,
     "family": "epic_lifecycle", "type": "kick_off", "attribute": None,
     "comment": "Kick-off officiel avec toutes les équipes ART", "owner_resource_id": RESOURCE_IDS[1],
     "deliverable": "Feuille de route ART validée", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "tenant_id": TENANT_ID,
     "name": "PI Planning #1 — PI2025-Q1", "date_baseline": "2025-03-15", "date_forecast": "2025-03-22", "date_actual": "2025-03-22",
     "status": "achieved", "is_governance": True,
     "family": "epic_lifecycle", "type": "review", "attribute": None,
     "comment": "PI Planning 2 jours — 45 participants", "owner_resource_id": RESOURCE_IDS[1],
     "deliverable": "PI Objectives + Program Board", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "tenant_id": TENANT_ID,
     "name": "Livraison MVP Core Digitale", "date_baseline": "2025-06-30", "date_forecast": "2025-08-31", "date_actual": None,
     "status": "at_risk", "is_governance": True,
     "family": "epic_milestone", "type": "key_deliverable", "attribute": "critical",
     "comment": "Retard de 2 mois — impact budget et planning national", "owner_resource_id": RESOURCE_IDS[0],
     "deliverable": "MVP validé par les métiers (UAT réussie)", "is_blocking": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[0], "tenant_id": TENANT_ID,
     "name": "Déploiement national Phase 1", "date_baseline": "2025-10-01", "date_forecast": "2025-12-01", "date_actual": None,
     "status": "at_risk", "is_governance": False,
     "family": "epic_milestone", "type": "roll_out", "attribute": "strategic",
     "comment": "Déploiement 15 sites prioritaires — dépend du MVP", "owner_resource_id": RESOURCE_IDS[1],
     "deliverable": "Go-live 15 sites validé", "is_blocking": False},
    # SI Finance (P1) — Waterfall
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "tenant_id": TENANT_ID,
     "name": "Recette fonctionnelle SI Finance", "date_baseline": "2025-04-30", "date_forecast": "2025-04-30", "date_actual": "2025-04-28",
     "status": "achieved", "is_governance": True,
     "family": "epic_lifecycle", "type": "sit", "attribute": None,
     "comment": "Recette fonctionnelle réussie — 98% des scénarios validés", "owner_resource_id": RESOURCE_IDS[3],
     "deliverable": "PV de recette signé", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "tenant_id": TENANT_ID,
     "name": "Migration données historiques", "date_baseline": "2025-05-31", "date_forecast": "2025-05-31", "date_actual": None,
     "status": "planned", "is_governance": False,
     "family": "epic_milestone", "type": "key_deliverable", "attribute": None,
     "comment": "Migration 5 ans de données comptables", "owner_resource_id": RESOURCE_IDS[2],
     "deliverable": "Rapport de migration validé par DAF", "is_blocking": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[1], "tenant_id": TENANT_ID,
     "name": "Go-Live SI Finance", "date_baseline": "2025-06-30", "date_forecast": "2025-07-31", "date_actual": None,
     "status": "planned", "is_governance": True,
     "family": "epic_milestone", "type": "go_live", "attribute": "critical",
     "comment": "Go-live conditionné à la validation de la migration données", "owner_resource_id": RESOURCE_IDS[1],
     "deliverable": "Système Finance opérationnel en production", "is_blocking": False},
    # SAP S/4HANA (P2) — Waterfall
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "tenant_id": TENANT_ID,
     "name": "Blueprint validé FICO/SD", "date_baseline": "2024-06-30", "date_forecast": "2024-08-15", "date_actual": "2024-08-15",
     "status": "achieved", "is_governance": True,
     "family": "epic_lifecycle", "type": "general_design", "attribute": None,
     "comment": "Blueprint FICO, CO, SD validé après 3 ateliers", "owner_resource_id": RESOURCE_IDS[0],
     "deliverable": "Document Blueprint signé", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "tenant_id": TENANT_ID,
     "name": "Recette intégration ERP-BI", "date_baseline": "2025-03-31", "date_forecast": "2025-07-31", "date_actual": None,
     "status": "delayed", "is_governance": True,
     "family": "epic_lifecycle", "type": "uat", "attribute": "critical",
     "comment": "Retard 4 mois — anomalies RICEFW bloquantes", "owner_resource_id": RESOURCE_IDS[2],
     "deliverable": "PV UAT BI signé — 0 anomalie bloquante", "is_blocking": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[2], "tenant_id": TENANT_ID,
     "name": "Go-Live SAP S/4HANA", "date_baseline": "2025-09-30", "date_forecast": "2026-03-31", "date_actual": None,
     "status": "delayed", "is_governance": True,
     "family": "epic_milestone", "type": "go_live", "attribute": "critical",
     "comment": "Retard 6 mois — conditionné à UAT + formation. Impact budget +26%", "owner_resource_id": RESOURCE_IDS[0],
     "deliverable": "SAP S/4HANA opérationnel — Hypercare activée", "is_blocking": False},
    # Digital Workplace (P3)
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "tenant_id": TENANT_ID,
     "name": "Déploiement Teams & SharePoint Phase 1", "date_baseline": "2025-04-30", "date_forecast": "2025-04-30", "date_actual": "2025-04-25",
     "status": "achieved", "is_governance": False,
     "family": "epic_milestone", "type": "roll_out", "attribute": None,
     "comment": "Phase 1 — Siège + 3 sites régionaux", "owner_resource_id": RESOURCE_IDS[6],
     "deliverable": "Teams/SharePoint actifs sur 4 sites", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "tenant_id": TENANT_ID,
     "name": "Formation collaborateurs (2 000 users)", "date_baseline": "2025-07-31", "date_forecast": "2025-07-31", "date_actual": None,
     "status": "planned", "is_governance": False,
     "family": "epic_lifecycle", "type": "change_management", "attribute": None,
     "comment": "Plan de conduite du changement — e-learning + présentiel", "owner_resource_id": RESOURCE_IDS[8],
     "deliverable": "100% collaborateurs formés", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[3], "tenant_id": TENANT_ID,
     "name": "Clôture projet Digital Workplace", "date_baseline": "2025-10-31", "date_forecast": "2025-10-31", "date_actual": None,
     "status": "planned", "is_governance": True,
     "family": "epic_milestone", "type": "key_deliverable", "attribute": "strategic",
     "comment": "Clôture formelle — bilan ROI et rex", "owner_resource_id": RESOURCE_IDS[1],
     "deliverable": "Bilan projet + rapport ROI validé COMEX", "is_blocking": False},
    # CRM Salesforce (P4)
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "tenant_id": TENANT_ID,
     "name": "Design Phase validé — Sales Cloud", "date_baseline": "2025-04-30", "date_forecast": "2025-05-15", "date_actual": None,
     "status": "at_risk", "is_governance": True,
     "family": "epic_lifecycle", "type": "general_design", "attribute": None,
     "comment": "Ateliers de design en cours — 2 Use Cases bloquants non résolus", "owner_resource_id": RESOURCE_IDS[5],
     "deliverable": "Design Document Sales Cloud validé", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[4], "tenant_id": TENANT_ID,
     "name": "Pilote commercial région Île-de-France", "date_baseline": "2025-09-30", "date_forecast": "2025-11-30", "date_actual": None,
     "status": "planned", "is_governance": False,
     "family": "epic_milestone", "type": "roll_out", "attribute": "strategic",
     "comment": "Pilote 50 commerciaux IdF — 2 mois avant déploiement national", "owner_resource_id": RESOURCE_IDS[5],
     "deliverable": "Rapport pilote + décision GO déploiement national", "is_blocking": False},
    # Cloud Landing Zone (P5)
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "tenant_id": TENANT_ID,
     "name": "Migration Datacenter Paris — Wave 1", "date_baseline": "2025-03-31", "date_forecast": "2025-03-31", "date_actual": "2025-03-28",
     "status": "achieved", "is_governance": False,
     "family": "epic_lifecycle", "type": "cut_over", "attribute": None,
     "comment": "Wave 1 réussie — 12 apps migrées sans incident", "owner_resource_id": RESOURCE_IDS[4],
     "deliverable": "PV migration Wave 1 signé", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[5], "tenant_id": TENANT_ID,
     "name": "Migration Wave 2 — Applications critiques", "date_baseline": "2025-08-31", "date_forecast": "2025-08-31", "date_actual": None,
     "status": "planned", "is_governance": True,
     "family": "epic_milestone", "type": "roll_out", "attribute": "critical",
     "comment": "Wave 2 = apps critiques métier (ERP, Finance). Fenêtre maintenance weekend", "owner_resource_id": RESOURCE_IDS[4],
     "deliverable": "35 apps critiques migrées + tests de reprise validés", "is_blocking": False},
    # Portail RH (P6)
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "tenant_id": TENANT_ID,
     "name": "Livraison Portail RH v1 (prévu)", "date_baseline": "2025-03-31", "date_forecast": "2025-06-30", "date_actual": None,
     "status": "delayed", "is_governance": True,
     "family": "epic_milestone", "type": "key_deliverable", "attribute": None,
     "comment": "Retard 3 mois — ressources UX/UI insuffisantes", "owner_resource_id": RESOURCE_IDS[8],
     "deliverable": "Portail RH v1 déployé et accessible collaborateurs", "is_blocking": False},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[6], "tenant_id": TENANT_ID,
     "name": "Tests UAT collaborateurs", "date_baseline": "2025-04-30", "date_forecast": "2025-08-31", "date_actual": None,
     "status": "delayed", "is_governance": False,
     "family": "epic_lifecycle", "type": "uat", "attribute": None,
     "comment": "UAT prévue 4 semaines — panel 100 collaborateurs", "owner_resource_id": RESOURCE_IDS[8],
     "deliverable": "PV UAT signé par DRH", "is_blocking": True},
    # DORA NIS2 (P7) — Transversal réglementaire
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "tenant_id": TENANT_ID,
     "name": "GAP Analysis DORA validée", "date_baseline": "2025-05-31", "date_forecast": "2025-05-31", "date_actual": None,
     "status": "planned", "is_governance": True,
     "family": "transversal", "type": "regulatory", "attribute": "critical",
     "comment": "Obligation réglementaire DORA — deadline légale jan 2025. Analyse des écarts vs socle DORA", "owner_resource_id": RESOURCE_IDS[9],
     "deliverable": "Rapport GAP Analysis + liste des non-conformités", "is_blocking": True},
    {"milestone_id": str(uuid.uuid4()), "project_id": PROJECT_IDS[7], "tenant_id": TENANT_ID,
     "name": "Plan de remédiation approuvé COMEX", "date_baseline": "2025-07-31", "date_forecast": "2025-07-31", "date_actual": None,
     "status": "planned", "is_governance": True,
     "family": "transversal", "type": "regulatory", "attribute": "critical",
     "comment": "Présentation COMEX + validation plan 18 mois", "owner_resource_id": RESOURCE_IDS[9],
     "deliverable": "Plan de remédiation signé COMEX + budget validé", "is_blocking": False},
]

GOVERNANCE = [    {
        "governance_id": GOVERNANCE_IDS[0],
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
        "governance_id": GOVERNANCE_IDS[1],
        "tenant_id": TENANT_ID,
        "name": "COMEX Transformation Digitale — Bilan S1 2025",
        "type": "comex",
        "date_scheduled": "2025-06-15T09:00:00Z",
        "projects_scope": PROJECT_IDS[:3],
        "sanity_check_status": "pending",
        "sanity_check_report": {},
    },
    {
        "governance_id": GOVERNANCE_IDS[2],
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
        "governance_id": GOVERNANCE_IDS[3],
        "tenant_id": TENANT_ID,
        "name": "COPIL Conformité DORA & NIS2 — Lancement Programme",
        "type": "copil",
        "date_scheduled": "2025-04-10T11:00:00Z",
        "projects_scope": [PROJECT_IDS[7]],
        "sanity_check_status": "passed",
        "sanity_check_report": {"summary": "Projet conforme aux critères de lancement."},
    },
    {
        "governance_id": GOVERNANCE_IDS[4],
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

# ===== RISKS =====
RISKS = [
    # P0 — Phoenix SAFe (orange, actif) — 5 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Architecture legacy incompatible avec nouveaux modules SI",
     "description": "Les API du SI existant ne supportent pas les protocoles REST des nouveaux modules.",
     "category": "technique", "probability": 4, "impact": 4, "criticality": 16, "status": "identifié",
     "mitigation_plan": "Refonte couche middleware API — sprint dédié en PI3", "owner": "Sophie Martin",
     "due_date": "2025-07-31", "created_at": "2025-01-20T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Dépassement budget phase 2 — module reporting exécutif",
     "description": "Scope creep détecté sur le module reporting — +30% d'effort estimé.",
     "category": "budget", "probability": 3, "impact": 4, "criticality": 12, "status": "traité",
     "mitigation_plan": "Réduction scope reporting V1 — V2 reportée au T4", "owner": "Thomas Dubois",
     "due_date": "2025-09-30", "created_at": "2025-02-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Retard PI Planning Q3 — dépendances inter-équipes non résolues",
     "category": "planning", "probability": 3, "impact": 3, "criticality": 9, "status": "identifié",
     "mitigation_plan": "Anticipation PI Planning 6 semaines — alignement Product Owners", "owner": "Sophie Martin",
     "due_date": "2025-08-15", "created_at": "2025-02-15T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Départ Scrum Master clé en cours de PI",
     "category": "ressource", "probability": 2, "impact": 3, "criticality": 6, "status": "accepté",
     "mitigation_plan": "Backup Scrum Master identifié — plan de transition documenté", "owner": "Thomas Dubois",
     "due_date": "2025-06-30", "created_at": "2025-03-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Évolution réglementation données personnelles — RGPD",
     "category": "conformité", "probability": 2, "impact": 2, "criticality": 4, "status": "clos",
     "mitigation_plan": "Revue DPO effectuée — conformité validée Q1 2025", "owner": "Sophie Martin",
     "due_date": None, "created_at": "2025-01-15T10:00:00Z"},

    # P1 — SI Finance (waterfall, vert, actif) — 4 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Retard recette fonctionnelle FICO/SD — refus MOA",
     "category": "planning", "probability": 3, "impact": 3, "criticality": 9, "status": "traité",
     "mitigation_plan": "Plan de rattrapage CFO — 2 sprints supplémentaires alloués", "owner": "Thomas Dubois",
     "due_date": "2025-06-15", "created_at": "2025-01-10T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Incompatibilité modules comptabilité analytique avec ERP cible",
     "category": "technique", "probability": 2, "impact": 3, "criticality": 6, "status": "identifié",
     "mitigation_plan": "Test d'intégration planifié sprint 8", "owner": "Sophie Martin",
     "due_date": "2025-05-31", "created_at": "2025-02-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Indisponibilité experts métier Contrôle de Gestion",
     "category": "ressource", "probability": 2, "impact": 3, "criticality": 6, "status": "accepté",
     "mitigation_plan": "Convention de disponibilité signée avec CFO — 20% du temps garanti", "owner": "Thomas Dubois",
     "due_date": "2025-06-30", "created_at": "2025-02-10T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Hausse imprévue coûts licences ERP supplémentaires",
     "category": "budget", "probability": 2, "impact": 2, "criticality": 4, "status": "clos",
     "mitigation_plan": "Négociation tarifaire validée avec éditeur — tarif figé 2025", "owner": "Thomas Dubois",
     "due_date": None, "created_at": "2025-01-20T10:00:00Z"},

    # P2 — SAP S/4HANA (waterfall, rouge, actif) — 6 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Corruption données migration batch FICO — 5 millions de lignes",
     "description": "Risque critique de perte d'intégrité lors de la migration des données comptables historiques.",
     "category": "technique", "probability": 4, "impact": 5, "criticality": 20, "status": "identifié",
     "mitigation_plan": "Double validation pre-prod + rollback plan documenté + tests charge", "owner": "Sophie Martin",
     "due_date": "2025-08-31", "created_at": "2025-01-05T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Retard Go-Live de 6 mois — blueprint non validé par COMEX",
     "description": "Validation blueprint bloquée — résistance métier sur le périmètre SAP.",
     "category": "planning", "probability": 4, "impact": 5, "criticality": 20, "status": "traité",
     "mitigation_plan": "Steering Committee mensuel renforcé — DG impliqué directement", "owner": "Thomas Dubois",
     "due_date": "2025-12-31", "created_at": "2024-11-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Dépassement budget intégrateur Capgemini > 40%",
     "category": "budget", "probability": 4, "impact": 4, "criticality": 16, "status": "identifié",
     "mitigation_plan": "Révision contrat T&M → passage en forfait phase 3", "owner": "Thomas Dubois",
     "due_date": "2025-06-30", "created_at": "2025-02-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Pénurie consultants SAP FICO certifiés S/4HANA",
     "category": "ressource", "probability": 3, "impact": 4, "criticality": 12, "status": "identifié",
     "mitigation_plan": "Contrats long-terme avec 2 ESN partenaires SAP Gold", "owner": "Sophie Martin",
     "due_date": "2025-09-30", "created_at": "2025-01-15T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Non-conformité RGPD lors migration données RH vers S/4HANA",
     "category": "conformité", "probability": 2, "impact": 4, "criticality": 8, "status": "traité",
     "mitigation_plan": "Audit RGPD planifié — DPO intégré dans workstream conformité", "owner": "Sophie Martin",
     "due_date": "2025-07-31", "created_at": "2025-03-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Mise à jour critique SAP bloquante en phase de recette",
     "category": "externe", "probability": 2, "impact": 3, "criticality": 6, "status": "accepté",
     "mitigation_plan": "Freeze environnement recette documenté — veille patchs SAP", "owner": "Thomas Dubois",
     "due_date": None, "created_at": "2025-02-20T10:00:00Z"},

    # P3 — Digital Workplace (agile, vert, actif) — 4 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Faible adoption utilisateurs M365 — résistance au changement",
     "category": "planning", "probability": 3, "impact": 3, "criticality": 9, "status": "identifié",
     "mitigation_plan": "Programme Change Management DRH — réseau d'ambassadeurs par BU", "owner": "Sophie Martin",
     "due_date": "2025-08-31", "created_at": "2025-03-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Retard déploiement SharePoint — blocage droits Active Directory",
     "category": "technique", "probability": 2, "impact": 3, "criticality": 6, "status": "traité",
     "mitigation_plan": "Script automation AD — coordination avec équipe IT sécurité", "owner": "Thomas Dubois",
     "due_date": "2025-06-30", "created_at": "2025-02-10T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Quota formations insuffisant — 2 000 collaborateurs concernés",
     "category": "ressource", "probability": 2, "impact": 2, "criticality": 4, "status": "accepté",
     "mitigation_plan": "E-learning Microsoft Learn activé — autoformation guidée", "owner": "Thomas Dubois",
     "due_date": "2025-09-30", "created_at": "2025-02-20T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Évolution politique tarifaire Microsoft 365 en cours d'exercice",
     "category": "budget", "probability": 1, "impact": 3, "criticality": 3, "status": "accepté",
     "mitigation_plan": "Contrat 3 ans signé — tarifs figés jusqu'à 2027", "owner": "Thomas Dubois",
     "due_date": None, "created_at": "2025-01-25T10:00:00Z"},

    # P4 — CRM Salesforce (SAFe, orange, actif) — 5 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "Intégration ERP ↔ Salesforce — mapping données complexe",
     "description": "Structure objet CRM incompatible avec modèle ERP — nécessite middleware.",
     "category": "technique", "probability": 3, "impact": 4, "criticality": 12, "status": "identifié",
     "mitigation_plan": "POC intégration MuleSoft — sprint dédié PI2", "owner": "Sophie Martin",
     "due_date": "2025-08-31", "created_at": "2025-03-15T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "Retard configuration Sales Cloud — release Salesforce bloquante",
     "category": "planning", "probability": 3, "impact": 3, "criticality": 9, "status": "identifié",
     "mitigation_plan": "Veille releases Salesforce — tests sandbox avant chaque upgrade", "owner": "Sophie Martin",
     "due_date": "2025-10-31", "created_at": "2025-03-20T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "Hausse licences Salesforce > 30% lors renouvellement",
     "category": "budget", "probability": 3, "impact": 3, "criticality": 9, "status": "traité",
     "mitigation_plan": "Négociation enterprise agreement pluriannuel — accord cadre 3 ans", "owner": "Thomas Dubois",
     "due_date": "2025-11-30", "created_at": "2025-04-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "Expert Salesforce certifié indisponible sur PI3",
     "category": "ressource", "probability": 2, "impact": 4, "criticality": 8, "status": "identifié",
     "mitigation_plan": "Contrat backup avec ESN Salesforce Partner Gold", "owner": "Sophie Martin",
     "due_date": "2025-09-30", "created_at": "2025-04-05T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "RGPD — transfert données clients vers instances Salesforce US",
     "category": "conformité", "probability": 2, "impact": 3, "criticality": 6, "status": "traité",
     "mitigation_plan": "DPA Salesforce signé + validation DPO interne", "owner": "Thomas Dubois",
     "due_date": "2025-06-30", "created_at": "2025-03-01T10:00:00Z"},

    # P5 — Cloud Azure (agile, vert, actif) — 4 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Indisponibilité Azure France Central durant migration live",
     "description": "Panne de la région Azure France Central en window de migration critique.",
     "category": "externe", "probability": 2, "impact": 5, "criticality": 10, "status": "identifié",
     "mitigation_plan": "Architecture multi-région — failover West Europe automatique", "owner": "Sophie Martin",
     "due_date": "2025-06-30", "created_at": "2025-01-15T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Retard migration Wave 2 — dépendance applicative SAP S/4HANA",
     "category": "planning", "probability": 3, "impact": 3, "criticality": 9, "status": "identifié",
     "mitigation_plan": "Coordination planning cross-projets Phoenix & SAP", "owner": "Thomas Dubois",
     "due_date": "2025-09-30", "created_at": "2025-03-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Dérive coûts Cloud — surconsommation compute et storage",
     "category": "budget", "probability": 3, "impact": 2, "criticality": 6, "status": "traité",
     "mitigation_plan": "Azure Cost Management — alertes budget et caps configurés", "owner": "Thomas Dubois",
     "due_date": "2025-12-31", "created_at": "2025-02-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Perte données lors bascule datacenter Paris → Azure",
     "category": "technique", "probability": 1, "impact": 5, "criticality": 5, "status": "traité",
     "mitigation_plan": "Backup double quotidien + tests restauration mensuels", "owner": "Sophie Martin",
     "due_date": None, "created_at": "2025-01-05T10:00:00Z"},

    # P6 — Portail RH (agile, rouge, en_pause) — 5 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "API SIRH incompatible — refonte contrat ESN nécessaire",
     "description": "L'API SIRH ne respecte pas les standards REST — nécessite couche d'abstraction coûteuse.",
     "category": "technique", "probability": 4, "impact": 4, "criticality": 16, "status": "identifié",
     "mitigation_plan": "Analyse compatibilité API + POC couche abstraction Sprint 12", "owner": "Thomas Dubois",
     "due_date": "2025-10-31", "created_at": "2024-12-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Dépassement budget ESN > 50% — avenant refusé par DG",
     "description": "L'ESN réclame 50% de surcoût pour la refonte technique — pas encore validé.",
     "category": "budget", "probability": 4, "impact": 4, "criticality": 16, "status": "traité",
     "mitigation_plan": "Renégociation contrat en cours — arbitrage DG attendu septembre", "owner": "Thomas Dubois",
     "due_date": "2025-07-31", "created_at": "2025-01-15T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Retard backend persistant — équipe dev insuffisante sprint 8-12",
     "category": "planning", "probability": 4, "impact": 3, "criticality": 12, "status": "traité",
     "mitigation_plan": "Renfort 2 développeurs seniors — budget validé par DRH", "owner": "Sophie Martin",
     "due_date": "2025-08-31", "created_at": "2025-02-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Turnover équipe développement — 3 départs sur 6 mois",
     "category": "ressource", "probability": 3, "impact": 3, "criticality": 9, "status": "identifié",
     "mitigation_plan": "Plan de rétention RH + documentation technique systématique", "owner": "Thomas Dubois",
     "due_date": "2025-09-30", "created_at": "2025-03-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Évolution SIRH imposée par DRH en cours de projet",
     "category": "externe", "probability": 2, "impact": 3, "criticality": 6, "status": "accepté",
     "mitigation_plan": "Gel des évolutions SIRH validé par DRH — clause contractuelle", "owner": "Sophie Martin",
     "due_date": None, "created_at": "2025-01-20T10:00:00Z"},

    # P7 — DORA & NIS2 (waterfall, vert, en_preparation) — 5 risques
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Non-conformité DORA à la deadline réglementaire janvier 2025",
     "description": "Risque de sanction AMF si les exigences DORA ne sont pas respectées dans les délais.",
     "category": "conformité", "probability": 3, "impact": 5, "criticality": 15, "status": "identifié",
     "mitigation_plan": "Plan d'accélération CISO — jalons critiques priorisés en Q2", "owner": "Sophie Martin",
     "due_date": "2025-12-31", "created_at": "2025-04-05T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Nouvelles exigences NIS2 élargissant le périmètre en cours d'exercice",
     "category": "externe", "probability": 3, "impact": 4, "criticality": 12, "status": "identifié",
     "mitigation_plan": "Veille réglementaire mensuelle — groupe de travail CISO + DG", "owner": "Thomas Dubois",
     "due_date": "2025-10-31", "created_at": "2025-04-10T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Lacunes outils monitoring résilience opérationnelle",
     "category": "technique", "probability": 2, "impact": 4, "criticality": 8, "status": "traité",
     "mitigation_plan": "Déploiement Azure Monitor + SIEM Sentinel — planning validé", "owner": "Sophie Martin",
     "due_date": "2025-09-30", "created_at": "2025-04-01T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Dépassement budget audit externe conformité DORA",
     "category": "budget", "probability": 2, "impact": 3, "criticality": 6, "status": "accepté",
     "mitigation_plan": "Plafond contractuel fixé avec cabinet d'audit", "owner": "Thomas Dubois",
     "due_date": "2025-11-30", "created_at": "2025-04-05T10:00:00Z"},
    {"risk_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Retard GAP Analysis — refus COMEX de valider le périmètre NIS2",
     "category": "planning", "probability": 2, "impact": 3, "criticality": 6, "status": "identifié",
     "mitigation_plan": "Présentation COMEX préparée avec CISO + DG — slides validées", "owner": "Sophie Martin",
     "due_date": "2025-08-31", "created_at": "2025-04-01T10:00:00Z"},
]


DECISIONS = [
    # ===== P0 — Projet Phoenix (SAFe, ORANGE, actif) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Go / No-Go — Lancement Wave 2 (Modules Finance & RH)",
     "description": "Arbitrage COMEX sur le lancement de la seconde vague du projet Phoenix incluant les modules Finance et RH.",
     "category": "stratégique", "status": "prise",
     "decision_date": "2025-04-15", "due_date": "2025-06-30",
     "owner": "Sophie Martin",
     "impact": "Engagement de 1,2 M€ supplémentaires. Mobilisation de 6 ressources additionnelles sur Q2-Q3.",
     "governance_id": GOVERNANCE_IDS[1], "created_at": "2025-04-15T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Arbitrage scope — Retrait module Reporting Exécutif de Wave 1",
     "description": "Le module Reporting Exécutif est sorti du périmètre Wave 1 et reporté en Wave 3.",
     "category": "périmètre", "status": "appliquée",
     "decision_date": "2025-03-01", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Économie de 6 semaines sur Wave 1. Risque de mécontentement DG différé.",
     "governance_id": GOVERNANCE_IDS[0], "created_at": "2025-03-01T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Extension périmètre — Intégration legacy ERP SAP dans Wave 2",
     "description": "Ajout de l'intégration SAP au périmètre Wave 2 suite à la demande de la DSI Finance.",
     "category": "périmètre", "status": "en_cours",
     "decision_date": "2025-04-20", "due_date": "2025-07-31",
     "owner": "Thomas Dubois",
     "impact": "Surcoût estimé à 180 K€. Décalage possible Wave 2 de 3 semaines.",
     "governance_id": None, "created_at": "2025-04-20T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[0],
     "title": "Renfort RTE SAFe — Recrutement externe confirmé",
     "description": "Recrutement d'un Release Train Engineer externe pour renforcer la capacité SAFe sur PI2-PI3.",
     "category": "ressources", "status": "appliquée",
     "decision_date": "2025-02-10", "due_date": None,
     "owner": "Thomas Dubois",
     "impact": "Coût : 85 K€. Gain estimé : +20% vélocité sur PI2.",
     "governance_id": None, "created_at": "2025-02-10T10:00:00Z"},

    # ===== P1 — Modernisation SI Finance (waterfall, VERT, actif) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Choix outil consolidation — BlackLine retenu vs OneStream",
     "description": "Arbitrage final en faveur de BlackLine pour la consolidation financière.",
     "category": "technique", "status": "appliquée",
     "decision_date": "2025-01-20", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Économie de licence : -80 K€/an vs OneStream. Formation 5 jours/utilisateur.",
     "governance_id": GOVERNANCE_IDS[1], "created_at": "2025-01-20T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Validation go-live Phase 2 — Module Controlling & Trésorerie",
     "description": "Le COPIL valide le go-live de la phase 2 au 15 octobre 2025.",
     "category": "planning", "status": "prise",
     "decision_date": "2025-04-15", "due_date": "2025-10-15",
     "owner": "Sophie Martin",
     "impact": "Mobilisation de 3 ressources supplémentaires sur Q3. Validation plan de migration données.",
     "governance_id": GOVERNANCE_IDS[0], "created_at": "2025-04-15T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Réduction périmètre — Retrait flux SWIFT Phase 1",
     "description": "Les flux SWIFT sont reportés en Phase 3 pour tenir les délais réglementaires Phase 1.",
     "category": "périmètre", "status": "appliquée",
     "decision_date": "2025-02-15", "due_date": None,
     "owner": "Thomas Dubois",
     "impact": "Phase 1 préservée. Revue contrat ESN nécessaire — avenant en cours.",
     "governance_id": None, "created_at": "2025-02-15T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[1],
     "title": "Conformité DSP2 — Audit tiers validé avant chaque go-live",
     "description": "Le COPIL impose un audit de sécurité tiers obligatoire avant chaque go-live.",
     "category": "conformité", "status": "en_cours",
     "decision_date": "2025-03-20", "due_date": "2025-09-30",
     "owner": "Sophie Martin",
     "impact": "Coût audit : 40 K€. Contrainte planning de 3 semaines sur Phase 2.",
     "governance_id": GOVERNANCE_IDS[0], "created_at": "2025-03-20T10:00:00Z"},

    # ===== P2 — ERP SAP S/4HANA (waterfall, ROUGE, actif) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Révision budget — Augmentation enveloppe de 26% validée",
     "description": "Le Steering Committee valide le dépassement budgétaire lié aux imprévus d'intégration.",
     "category": "budgétaire", "status": "prise",
     "decision_date": "2025-04-07", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Enveloppe révisée : +1,8 M€. Rapport d'avancement mensuel obligatoire.",
     "governance_id": GOVERNANCE_IDS[2], "created_at": "2025-04-07T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Report Go-Live — Décalage de 6 mois décidé en Steering Committee",
     "description": "Face aux retards d'intégration, le Go-Live est reporté de juin à décembre 2025.",
     "category": "planning", "status": "appliquée",
     "decision_date": "2025-04-07", "due_date": "2025-12-15",
     "owner": "Sophie Martin",
     "impact": "Surcoût maintenance legacy estimé à 600 K€. Risque social fort.",
     "governance_id": GOVERNANCE_IDS[2], "created_at": "2025-04-07T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Remplacement intégrateur — Appel d'offres lancé",
     "description": "Suite aux défaillances, un AO est lancé pour sélectionner un nouveau partenaire.",
     "category": "ressources", "status": "en_cours",
     "decision_date": "2025-04-10", "due_date": "2025-06-01",
     "owner": "Thomas Dubois",
     "impact": "Risque de transition 6-8 semaines. Pénalités contractuelles en cours d'évaluation.",
     "governance_id": None, "created_at": "2025-04-10T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[2],
     "title": "Réduction périmètre Wave 1 — Module SD reporté en Wave 2",
     "description": "Le module Sales & Distribution est sorti de Wave 1 pour prioriser FI/CO/MM.",
     "category": "périmètre", "status": "appliquée",
     "decision_date": "2025-03-20", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Wave 1 : -3 mois de charge. Wave 2 : +4 mois de charge. Accord COMEX obtenu.",
     "governance_id": GOVERNANCE_IDS[2], "created_at": "2025-03-20T10:00:00Z"},

    # ===== P3 — Microsoft 365 (waterfall, VERT, actif) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Plan de déploiement accéléré — 2 000 utilisateurs en 3 mois",
     "description": "Adoption d'un plan de déploiement accéléré pour couvrir les 2 000 utilisateurs avant fin Q2.",
     "category": "planning", "status": "en_cours",
     "decision_date": "2025-03-01", "due_date": "2025-06-30",
     "owner": "Sophie Martin",
     "impact": "Mobilisation équipe support 3 mois. Programme e-learning activé.",
     "governance_id": None, "created_at": "2025-03-01T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Contrat Microsoft 365 E3 — Renouvellement pluriannuel signé",
     "description": "Signature d'un contrat E3 pluriannuel (3 ans) pour sécuriser les tarifs.",
     "category": "budgétaire", "status": "appliquée",
     "decision_date": "2025-01-15", "due_date": None,
     "owner": "Thomas Dubois",
     "impact": "Économie : -18% vs renouvellement annuel. Engagement ferme 3 ans.",
     "governance_id": None, "created_at": "2025-01-15T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Conformité RGPD — Données Teams archivées en région UE uniquement",
     "description": "Décision d'archiver toutes les communications Teams dans une région EU.",
     "category": "conformité", "status": "appliquée",
     "decision_date": "2025-02-01", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Conformité RGPD assurée. Surcoût stockage : +12 K€/an.",
     "governance_id": None, "created_at": "2025-02-01T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[3],
     "title": "Gouvernance Teams — Mise en place d'une charte d'utilisation obligatoire",
     "description": "Charte d'utilisation Microsoft Teams avec validation DRH.",
     "category": "gouvernance", "status": "proposée",
     "decision_date": None, "due_date": "2025-07-31",
     "owner": "Thomas Dubois",
     "impact": "Réduction risque prolifération workspaces. Meilleure traçabilité des échanges.",
     "governance_id": None, "created_at": "2025-04-10T10:00:00Z"},

    # ===== P4 — CRM Salesforce (SAFe, ORANGE, actif) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "Architecture d'intégration — MuleSoft retenu comme ESB",
     "description": "Choix de MuleSoft comme middleware d'intégration entre Salesforce et SAP.",
     "category": "technique", "status": "appliquée",
     "decision_date": "2025-03-15", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Coût intégration : +120 K€. Résilience et maintenabilité améliorées.",
     "governance_id": GOVERNANCE_IDS[4], "created_at": "2025-03-15T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "Enterprise Agreement Salesforce — Négociation pluriannuelle",
     "description": "Validation de la stratégie de négociation pour un enterprise agreement 3 ans.",
     "category": "budgétaire", "status": "prise",
     "decision_date": "2025-04-01", "due_date": "2025-09-30",
     "owner": "Thomas Dubois",
     "impact": "Objectif : -20% tarifs vs renouvellement standard.",
     "governance_id": GOVERNANCE_IDS[4], "created_at": "2025-04-01T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "Retrait Service Cloud du périmètre PI2",
     "description": "Service Cloud reporté à PI3 pour tenir le délai go-live Sales Cloud.",
     "category": "périmètre", "status": "appliquée",
     "decision_date": "2025-03-20", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Go-live Sales Cloud maintenu. Ressources réallouées sur intégration ERP.",
     "governance_id": None, "created_at": "2025-03-20T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[4],
     "title": "DPA Salesforce — Signature clauses contractuelles RGPD",
     "description": "Décision de signer les clauses contractuelles type RGPD avec Salesforce Inc.",
     "category": "conformité", "status": "appliquée",
     "decision_date": "2025-03-01", "due_date": None,
     "owner": "Thomas Dubois",
     "impact": "Conformité RGPD assurée. Validation DPO obtenue.",
     "governance_id": None, "created_at": "2025-03-01T10:00:00Z"},

    # ===== P5 — Migration Cloud Azure (agile, VERT, actif) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Architecture multi-région Azure — Failover West Europe activé",
     "description": "Adoption d'une architecture Azure multi-région pour garantir la continuité de service.",
     "category": "technique", "status": "appliquée",
     "decision_date": "2025-01-20", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Surcoût : +45 K€/an. RTO réduit de 4h à 30min.",
     "governance_id": None, "created_at": "2025-01-20T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Dépendance Wave 2 — Conditionnement au planning SAP S/4HANA",
     "description": "La migration Wave 2 est conditionnée par la disponibilité du projet SAP.",
     "category": "planning", "status": "en_cours",
     "decision_date": "2025-03-15", "due_date": "2025-09-30",
     "owner": "Thomas Dubois",
     "impact": "Risque report 2-3 mois si SAP prend du retard. Plan B en élaboration.",
     "governance_id": None, "created_at": "2025-03-15T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Azure Cost Management — Caps budgétaires par projet configurés",
     "description": "Mise en place de caps budgétaires Azure par projet pour éviter les dérives.",
     "category": "budgétaire", "status": "appliquée",
     "decision_date": "2025-02-01", "due_date": None,
     "owner": "Thomas Dubois",
     "impact": "Alertes à 80% et 95% du cap. Désactivation automatique ressources non critiques.",
     "governance_id": None, "created_at": "2025-02-01T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[5],
     "title": "Tests de restauration — Validation mensuelle obligatoire",
     "description": "Tests de restauration complets chaque mois pour toutes les waves.",
     "category": "gouvernance", "status": "appliquée",
     "decision_date": "2025-01-10", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Réduction risque perte données. Charge : 2 JH/mois.",
     "governance_id": None, "created_at": "2025-01-10T10:00:00Z"},

    # ===== P6 — Portail RH (agile, ROUGE, en_pause) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Suspension projet — Mise en pause en attente arbitrage ESN",
     "description": "Le COPIL met le projet en pause jusqu'à résolution du différend avec l'ESN.",
     "category": "stratégique", "status": "appliquée",
     "decision_date": "2025-04-01", "due_date": "2025-07-01",
     "owner": "Sophie Martin",
     "impact": "Gel des dépenses projet. Risque social : équipe interne en attente.",
     "governance_id": GOVERNANCE_IDS[0], "created_at": "2025-04-01T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Arbitrage DG — Plafond avenant ESN à +35%",
     "description": "La DG refuse le surcoût de +50% et propose un plafond à +35%.",
     "category": "budgétaire", "status": "prise",
     "decision_date": "2025-03-25", "due_date": "2025-06-30",
     "owner": "Sophie Martin",
     "impact": "Économie de 15% vs demande ESN. Négociation contrat toujours en cours.",
     "governance_id": None, "created_at": "2025-03-25T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Couche abstraction API SIRH — POC conditionne la reprise",
     "description": "Reprise du projet conditionnée à la validation d'un POC technique API SIRH.",
     "category": "technique", "status": "en_cours",
     "decision_date": "2025-04-10", "due_date": "2025-06-01",
     "owner": "Thomas Dubois",
     "impact": "Risque technique levé si POC OK. Coût POC : 25 K€.",
     "governance_id": None, "created_at": "2025-04-10T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[6],
     "title": "Renfort équipe — 2 développeurs seniors recrutés",
     "description": "Recrutement de 2 développeurs seniors via SSII pour renforcer le backend.",
     "category": "ressources", "status": "appliquée",
     "decision_date": "2025-02-20", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Budget : +180 K€. Intégration équipe prévue sur sprint 9.",
     "governance_id": None, "created_at": "2025-02-20T10:00:00Z"},

    # ===== P7 — DORA & NIS2 (waterfall, VERT, en_preparation) =====
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Validation périmètre NIS2 — Entités essentielles et importantes identifiées",
     "description": "Le COPIL DORA valide la cartographie des entités concernées par NIS2.",
     "category": "conformité", "status": "appliquée",
     "decision_date": "2025-04-10", "due_date": None,
     "owner": "Sophie Martin",
     "impact": "Périmètre clairement défini. Documentation DPO complète.",
     "governance_id": GOVERNANCE_IDS[3], "created_at": "2025-04-10T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Azure Sentinel — Déploiement SIEM priorisé en Q2",
     "description": "Déploiement de Microsoft Sentinel priorisé pour couvrir les exigences DORA.",
     "category": "technique", "status": "en_cours",
     "decision_date": "2025-04-01", "due_date": "2025-06-30",
     "owner": "Thomas Dubois",
     "impact": "Couverture monitoring DORA : +70%. Ressource CISO dédiée sur Q2.",
     "governance_id": GOVERNANCE_IDS[3], "created_at": "2025-04-01T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Budget audit DORA — Plafond contractuel cabinet fixé à 180 K€",
     "description": "Plafonnement contractuel de la mission d'audit tiers à 180 K€ ferme.",
     "category": "budgétaire", "status": "prise",
     "decision_date": "2025-04-05", "due_date": "2025-11-30",
     "owner": "Sophie Martin",
     "impact": "Maîtrise budgétaire assurée. Pénalités retard cabinet prévues.",
     "governance_id": GOVERNANCE_IDS[3], "created_at": "2025-04-05T10:00:00Z"},
    {"decision_id": str(uuid.uuid4()), "tenant_id": TENANT_ID, "project_id": PROJECT_IDS[7],
     "title": "Escalade COMEX — Présentation GAP Analysis NIS2 en juin",
     "description": "Décision d'escalader la validation du périmètre NIS2 au COMEX de juin.",
     "category": "gouvernance", "status": "proposée",
     "decision_date": None, "due_date": "2025-06-15",
     "owner": "Thomas Dubois",
     "impact": "Levée du blocage COMEX pour valider le périmètre NIS2.",
     "governance_id": None, "created_at": "2025-04-10T10:00:00Z"},
]

# ===== WORK ALLOCATIONS (S1-05) =====
# Seed : 3-5 allocations par projet (tâche × ressource × phase)
# task IDs are dynamic in TASKS list above — we pick by project position


def _wa(task_offset, project_idx, resource_idx, phase, planned, consumed):
    """Helper: work allocation using positional task (task within project group)."""
    return {
        "work_allocation_id": str(uuid.uuid4()),
        "tenant_id": TENANT_ID,
        "task_id": None,          # Will be resolved at seed time
        "resource_id": RESOURCE_IDS[resource_idx],
        "phase": phase,
        "planned_md": planned,
        "consumed_md": consumed,
        "created_at": "2025-04-20T10:00:00Z",
        "_project_idx": project_idx,
        "_task_offset": task_offset,
    }


# We'll populate task_ids in the seed function
WORK_ALLOCATIONS_TEMPLATE = [
    # P0 — Phoenix (tasks 0-5 in TASKS)
    _wa(0, 0, 0, "analyse",        15.0, 12.0),   # Architecte → Epic Cadrage
    _wa(0, 0, 1, "conception",     10.0, 8.0),    # CdP → Epic Cadrage
    _wa(1, 0, 7, "implementation", 40.0, 32.0),   # Data Engineer → Feature Data
    _wa(2, 0, 2, "implementation", 30.0, 20.0),   # Dev Java → US ERP DataLake
    _wa(5, 0, 7, "review",         10.0, 5.0),    # Data Engineer → US Reporting

    # P1 — SI Finance (tasks 6-11)
    _wa(0, 1, 3, "analyse",        15.0, 15.0),   # BA → Analyse besoins
    _wa(2, 1, 2, "implementation", 25.0, 18.0),   # Dev Java → Dev Comptabilité
    _wa(3, 1, 3, "implementation", 20.0, 12.0),   # BA → Dev CdG

    # P2 — SAP (tasks 12-18)
    _wa(2, 2, 2, "implementation", 50.0, 45.0),   # Dev Java → RICEFW
    _wa(3, 2, 7, "implementation", 30.0, 25.0),   # Data Engineer → Migration données
    _wa(4, 2, 2, "test",           15.0, 8.0),    # Dev Java → Tests régression

    # P3 — Digital Workplace (tasks 19-23)
    _wa(0, 3, 4, "implementation", 12.0, 12.0),   # DevOps → Teams/Exchange
    _wa(1, 3, 8, "implementation", 18.0, 10.0),   # UX → SharePoint
    _wa(2, 3, 5, "analyse",         8.0, 5.0),    # PO → Power Automate

    # P4 — CRM Salesforce (tasks 24-29)
    _wa(0, 4, 0, "conception",     10.0, 10.0),   # Architecte → Epic Architecture
    _wa(1, 4, 5, "implementation", 22.0, 12.0),   # PO → Sales Cloud
    _wa(3, 4, 5, "analyse",         8.0, 5.0),    # PO → Dashboard perf

    # P5 — Cloud Azure (tasks 30-34)
    _wa(0, 5, 4, "implementation", 10.0, 9.5),    # DevOps → Landing Zone
    _wa(2, 5, 4, "implementation", 20.0, 10.0),   # DevOps → Wave 2

    # P6 — Portail RH (tasks 35-39)
    _wa(0, 6, 8, "implementation", 20.0, 22.0),   # UX → Congés
    _wa(1, 6, 8, "implementation", 18.0, 20.0),   # UX → Fiche Paie

    # P7 — DORA NIS2 (tasks 40-45)
    _wa(0, 7, 9, "analyse",        12.0, 9.0),    # Sécurité → GAP Analysis
    _wa(1, 7, 0, "analyse",        10.0, 4.5),    # Architecte → Cartographie
    # CdP Senior (Thomas Dubois) — tâche Recette SI Finance + pilotage Phoenix
    _wa(4, 1, 1, "recette",        12.0, 2.0),    # CdP → Recette & Tests SI Finance
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
        await db.teams.delete_many({"tenant_id": TENANT_ID})
        await db.governance.delete_many({"tenant_id": TENANT_ID})
        await db.programs.delete_many({"tenant_id": TENANT_ID})

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

    await db.programs.insert_many(PROGRAMS)
    print(f"Programmes créés : {len(PROGRAMS)}")

    await db.resources.insert_many(RESOURCES)
    print(f"Ressources créées : {len(RESOURCES)}")

    await db.allocations.insert_many(ALLOCATIONS)
    print(f"Allocations créées : {len(ALLOCATIONS)}")

    await db.milestones.insert_many(MILESTONES)
    print(f"Jalons créés : {len(MILESTONES)}")

    await db.governance.insert_many(GOVERNANCE)
    print(f"Instances de gouvernance créées : {len(GOVERNANCE)}")

    # Teams seed
    await db.teams.delete_many({"tenant_id": TENANT_ID})
    await db.teams.insert_many(TEAMS)
    print(f"Équipes créées : {len(TEAMS)}")

    # Tasks seed
    await db.tasks.delete_many({})
    await db.tasks.insert_many(TASKS)
    print(f"Tâches créées : {len(TASKS)}")

    # Risks seed
    await db.risks.delete_many({})
    await db.risks.insert_many(RISKS)
    print(f"Risques créés : {len(RISKS)}")

    # Decisions seed
    await db.decisions.delete_many({})
    await db.decisions.insert_many(DECISIONS)
    print(f"Décisions créées : {len(DECISIONS)}")

    # Work Allocations seed (S1-05)
    # Résoudre les task_ids depuis la DB
    await db.work_allocations.delete_many({})
    # Grouper les tâches par projet
    all_tasks = await db.tasks.find({"tenant_id": TENANT_ID}, {"_id": 0, "task_id": 1, "project_id": 1}).to_list(None)
    tasks_by_project = {}
    for t in all_tasks:
        pid = t["project_id"]
        tasks_by_project.setdefault(pid, []).append(t["task_id"])

    work_allocs_to_insert = []
    for wa in WORK_ALLOCATIONS_TEMPLATE:
        proj_idx = wa.pop("_project_idx")
        task_offset = wa.pop("_task_offset")
        proj_id = PROJECT_IDS[proj_idx]
        proj_tasks = tasks_by_project.get(proj_id, [])
        if task_offset < len(proj_tasks):
            wa["task_id"] = proj_tasks[task_offset]
            work_allocs_to_insert.append(wa)

    if work_allocs_to_insert:
        await db.work_allocations.insert_many(work_allocs_to_insert)
    print(f"Work allocations créées : {len(work_allocs_to_insert)}")

    # ── Timesheets seed (S3-01) ──────────────────────────────────────────────
    import random as _rnd
    _rnd.seed(42)
    await db.timesheets.delete_many({"tenant_id": TENANT_ID})

    # Lier les utilisateurs admin et pmo à des ressources
    admin_rid = RESOURCE_IDS[0]
    pmo_rid   = RESOURCE_IDS[1]
    await db.users.update_one(
        {"email": "admin@altair.fr", "tenant_id": TENANT_ID},
        {"$set": {"resource_id": admin_rid}},
    )
    await db.users.update_one(
        {"email": "pmo@altair.fr", "tenant_id": TENANT_ID},
        {"$set": {"resource_id": pmo_rid}},
    )

    # Récupérer les work_allocations pour les 4 premières ressources
    seed_rids = RESOURCE_IDS[:4]
    wa_docs = await db.work_allocations.find(
        {"resource_id": {"$in": seed_rids}, "tenant_id": TENANT_ID},
        {"_id": 0, "work_allocation_id": 1, "resource_id": 1},
    ).to_list(None)
    wa_by_res: dict = {}
    for wa in wa_docs:
        wa_by_res.setdefault(wa["resource_id"], []).append(wa["work_allocation_id"])

    ts_to_insert = []
    today_d = date.today()
    # Semaine courante = lundi
    this_monday = today_d - timedelta(days=today_d.weekday())

    # Statuts par semaine (offset depuis semaine courante)
    week_cfg = [
        (-3, "validated", True),   # il y a 3 semaines → validé
        (-2, "validated", True),   # il y a 2 semaines → validé
        (-1, "submitted", False),  # semaine dernière → soumis
        (0,  "draft",     False),  # semaine courante → brouillon
    ]

    for rid in seed_rids:
        wa_ids_for_rid = wa_by_res.get(rid, [])[:2]
        if not wa_ids_for_rid:
            continue
        for (w_offset, status, accounted) in week_cfg:
            week_mon = this_monday + timedelta(weeks=w_offset)
            sub_at   = (datetime(week_mon.year, week_mon.month, week_mon.day,
                                  18, 0, 0, tzinfo=timezone.utc) + timedelta(days=5)).isoformat()
            val_at   = (datetime(week_mon.year, week_mon.month, week_mon.day,
                                  9, 0, 0, tzinfo=timezone.utc) + timedelta(days=7)).isoformat()
            for day_off in range(5):   # Lun–Ven
                day_d = week_mon + timedelta(days=day_off)
                for waid in wa_ids_for_rid:
                    jh = round(_rnd.uniform(0.5, 2.5) * 2) / 2  # multiple de 0.5
                    doc = {
                        "timesheet_id":      str(uuid.uuid4()),
                        "tenant_id":         TENANT_ID,
                        "resource_id":       rid,
                        "work_allocation_id": waid,
                        "date":              day_d.isoformat(),
                        "jh_value":          jh,
                        "status":            status,
                        "accounted":         accounted,
                        "submitted_at":      sub_at if status in ("submitted", "validated") else None,
                        "validated_at":      val_at if status == "validated" else None,
                        "validated_by":      None,
                        "rejection_reason":  None,
                        "created_at":        datetime.now(timezone.utc).isoformat(),
                    }
                    ts_to_insert.append(doc)

    if ts_to_insert:
        await db.timesheets.insert_many(ts_to_insert)
    print(f"Timesheets créés : {len(ts_to_insert)}")

    # ── Project Dependencies seed ────────────────────────────────────────────
    await db.project_dependencies.delete_many({"tenant_id": TENANT_ID})
    PROJECT_DEPS = [
        # Phoenix dépend de Cloud Azure (infrastructure prête pour déploiement national)
        {"dependency_id": str(uuid.uuid4()), "tenant_id": TENANT_ID,
         "source_project_id": PROJECT_IDS[0], "target_project_id": PROJECT_IDS[5],
         "source_milestone_id": None, "target_milestone_id": None,
         "nature": "technical", "direction": "outbound",
         "description": "Le déploiement national Phoenix (Phase 1) nécessite que la Landing Zone Azure Wave 2 soit opérationnelle",
         "target_date": "2025-08-31", "status": "in_progress", "impact": "critical",
         "created_by": "seed", "created_at": "2025-01-15T10:00:00Z"},
        # SAP dépend de SI Finance (Go-Live SAP après stabilisation SI Finance)
        {"dependency_id": str(uuid.uuid4()), "tenant_id": TENANT_ID,
         "source_project_id": PROJECT_IDS[2], "target_project_id": PROJECT_IDS[1],
         "source_milestone_id": None, "target_milestone_id": None,
         "nature": "data", "direction": "outbound",
         "description": "L'intégration comptable SAP↔SI Finance requiert le Go-Live SI Finance préalable pour la reprise de données FICO",
         "target_date": "2025-07-31", "status": "identified", "impact": "high",
         "created_by": "seed", "created_at": "2025-01-15T10:00:00Z"},
        # CRM dépend de Phoenix (données client unifiées nécessaires pour Sales Cloud)
        {"dependency_id": str(uuid.uuid4()), "tenant_id": TENANT_ID,
         "source_project_id": PROJECT_IDS[4], "target_project_id": PROJECT_IDS[0],
         "source_milestone_id": None, "target_milestone_id": None,
         "nature": "deliverable", "direction": "outbound",
         "description": "Salesforce Sales Cloud requiert les APIs du portail client digital (livrable Phoenix) pour la synchronisation des contacts",
         "target_date": "2025-08-31", "status": "identified", "impact": "high",
         "created_by": "seed", "created_at": "2025-01-15T10:00:00Z"},
        # Portail RH dépend de Digital Workplace (SharePoint déployé pour héberger le portail)
        {"dependency_id": str(uuid.uuid4()), "tenant_id": TENANT_ID,
         "source_project_id": PROJECT_IDS[6], "target_project_id": PROJECT_IDS[3],
         "source_milestone_id": None, "target_milestone_id": None,
         "nature": "technical", "direction": "outbound",
         "description": "Le Portail RH v1 est hébergé sur SharePoint Online — nécessite le déploiement Digital Workplace Phase 1",
         "target_date": "2025-04-30", "status": "resolved", "impact": "medium",
         "created_by": "seed", "created_at": "2025-01-15T10:00:00Z"},
        # DORA NIS2 dépend de Cloud Azure (couverture sécurité du cloud dans le périmètre DORA)
        {"dependency_id": str(uuid.uuid4()), "tenant_id": TENANT_ID,
         "source_project_id": PROJECT_IDS[7], "target_project_id": PROJECT_IDS[5],
         "source_milestone_id": None, "target_milestone_id": None,
         "nature": "regulatory", "direction": "outbound",
         "description": "La GAP Analysis DORA doit inclure l'architecture Cloud Azure dans son périmètre de conformité",
         "target_date": "2025-05-31", "status": "in_progress", "impact": "critical",
         "created_by": "seed", "created_at": "2025-01-15T10:00:00Z"},
        # CRM dépend aussi de SI Finance (données financières client)
        {"dependency_id": str(uuid.uuid4()), "tenant_id": TENANT_ID,
         "source_project_id": PROJECT_IDS[4], "target_project_id": PROJECT_IDS[1],
         "source_milestone_id": None, "target_milestone_id": None,
         "nature": "data", "direction": "outbound",
         "description": "Les données de scoring financier client dans Salesforce proviennent du SI Finance — flux batch hebdomadaire",
         "target_date": "2025-07-31", "status": "identified", "impact": "medium",
         "created_by": "seed", "created_at": "2025-01-15T10:00:00Z"},
    ]
    await db.project_dependencies.insert_many(PROJECT_DEPS)
    print(f"Dépendances inter-projets créées : {len(PROJECT_DEPS)}")

    # ── SAFe — Chantier 3a ──────────────────────────────────────────────────
    await db.trains.delete_many({"tenant_id": TENANT_ID})
    await db.pis.delete_many({"tenant_id": TENANT_ID})
    await db.sprints.delete_many({"tenant_id": TENANT_ID})
    await db.capabilities.delete_many({"tenant_id": TENANT_ID})
    await db.phase_history.delete_many({"tenant_id": TENANT_ID})

    TRAIN = {
        "train_id":    TRAIN_ID,
        "tenant_id":   TENANT_ID,
        "name":        "ART Digital Banking",
        "description": "Release Train principal — Transformation Digitale Groupe",
        "vision":      "Livrer une expérience client digitale unifiée sur tous les canaux Altair d'ici fin 2026",
        "team_ids":    [TEAM_IDS[0], TEAM_IDS[1], TEAM_IDS[2]],
        "created_at":  "2025-10-01T09:00:00Z",
    }
    await db.trains.insert_one(TRAIN)
    TRAIN.pop("_id", None)

    PIS = [
        {
            "pi_id":      PI_IDS[0],
            "tenant_id":  TENANT_ID,
            "train_id":   TRAIN_ID,
            "name":       "PI-1 2026",
            "start_date": "2026-01-05",
            "end_date":   "2026-04-04",
            "objectives": [
                "Livrer Onboarding Client Digitalisé (MVP)",
                "Stabiliser API Gateway Banking v1",
                "Démarrer Score Crédit IA — pipeline données",
            ],
            "status":     "active",
            "created_at": "2025-10-15T09:00:00Z",
        },
        {
            "pi_id":      PI_IDS[1],
            "tenant_id":  TENANT_ID,
            "train_id":   TRAIN_ID,
            "name":       "PI-2 2026",
            "start_date": "2026-04-07",
            "end_date":   "2026-07-03",
            "objectives": [
                "Score Crédit IA — mise en production",
                "Reporting Réglementaire DORA automatisé",
                "Migration Batch Jobs Cloud Azure finalisée",
            ],
            "status":     "planning",
            "created_at": "2025-10-15T09:00:00Z",
        },
    ]
    await db.pis.insert_many(PIS)
    for p in PIS:
        p.pop("_id", None)

    SPRINTS = [
        # PI-1
        {
            "sprint_id":        SPRINT_IDS[0],
            "tenant_id":        TENANT_ID,
            "pi_id":            PI_IDS[0],
            "train_id":         TRAIN_ID,
            "name":             "Sprint 1.1",
            "start_date":       "2026-01-05",
            "end_date":         "2026-01-23",
            "capacity_jh":      120.0,
            "velocity_planned": 42,
            "velocity_actual":  40,
            "status":           "completed",
            "created_at":       "2025-12-15T09:00:00Z",
        },
        {
            "sprint_id":        SPRINT_IDS[1],
            "tenant_id":        TENANT_ID,
            "pi_id":            PI_IDS[0],
            "train_id":         TRAIN_ID,
            "name":             "Sprint 1.2",
            "start_date":       "2026-01-26",
            "end_date":         "2026-02-13",
            "capacity_jh":      115.0,
            "velocity_planned": 40,
            "velocity_actual":  38,
            "status":           "completed",
            "created_at":       "2025-12-15T09:00:00Z",
        },
        # PI-2
        {
            "sprint_id":        SPRINT_IDS[2],
            "tenant_id":        TENANT_ID,
            "pi_id":            PI_IDS[1],
            "train_id":         TRAIN_ID,
            "name":             "Sprint 2.1",
            "start_date":       "2026-04-07",
            "end_date":         "2026-04-24",
            "capacity_jh":      125.0,
            "velocity_planned": 45,
            "velocity_actual":  None,
            "status":           "planning",
            "created_at":       "2026-02-01T09:00:00Z",
        },
        {
            "sprint_id":        SPRINT_IDS[3],
            "tenant_id":        TENANT_ID,
            "pi_id":            PI_IDS[1],
            "train_id":         TRAIN_ID,
            "name":             "Sprint 2.2",
            "start_date":       "2026-04-28",
            "end_date":         "2026-05-15",
            "capacity_jh":      120.0,
            "velocity_planned": 43,
            "velocity_actual":  None,
            "status":           "planning",
            "created_at":       "2026-02-01T09:00:00Z",
        },
    ]
    await db.sprints.insert_many(SPRINTS)
    for s in SPRINTS:
        s.pop("_id", None)

    CAPABILITIES = [
        {
            "capability_id":      CAPABILITY_IDS[0],
            "tenant_id":          TENANT_ID,
            "train_id":           TRAIN_ID,
            "pi_id":              PI_IDS[0],
            "name":               "Onboarding Client Digitalisé",
            "description":        "Parcours d'inscription 100% digital avec vérification d'identité KYC automatisée",
            "status":             "in_progress",
            "wsjf":               13.5,
            "linked_project_ids": [PROJECT_IDS[0]],
            "created_at":         "2025-11-01T09:00:00Z",
        },
        {
            "capability_id":      CAPABILITY_IDS[1],
            "tenant_id":          TENANT_ID,
            "train_id":           TRAIN_ID,
            "pi_id":              PI_IDS[0],
            "name":               "API Gateway Banking v1",
            "description":        "Couche d'API REST sécurisée pour exposition des services bancaires (OAuth2 + MFA)",
            "status":             "done",
            "wsjf":               10.0,
            "linked_project_ids": [PROJECT_IDS[0]],
            "created_at":         "2025-11-01T09:00:00Z",
        },
        {
            "capability_id":      CAPABILITY_IDS[2],
            "tenant_id":          TENANT_ID,
            "train_id":           TRAIN_ID,
            "pi_id":              PI_IDS[0],
            "name":               "Module Score Crédit IA",
            "description":        "Pipeline ML pour scoring crédit temps réel — intégration bureau d'études data",
            "status":             "committed",
            "wsjf":               8.5,
            "linked_project_ids": [PROJECT_IDS[0]],
            "created_at":         "2025-11-15T09:00:00Z",
        },
        {
            "capability_id":      CAPABILITY_IDS[3],
            "tenant_id":          TENANT_ID,
            "train_id":           TRAIN_ID,
            "pi_id":              PI_IDS[1],
            "name":               "Reporting Réglementaire DORA",
            "description":        "Automatisation des rapports de conformité DORA (RTS5, RTS11) vers l'ACPR",
            "status":             "identified",
            "wsjf":               11.0,
            "linked_project_ids": [PROJECT_IDS[7]],
            "created_at":         "2026-01-10T09:00:00Z",
        },
        {
            "capability_id":      CAPABILITY_IDS[4],
            "tenant_id":          TENANT_ID,
            "train_id":           TRAIN_ID,
            "pi_id":              PI_IDS[1],
            "name":               "Migration Batch Jobs Cloud Azure",
            "description":        "Migration des 47 batch jobs on-premise vers Azure Batch + Container Apps",
            "status":             "committed",
            "wsjf":               7.5,
            "linked_project_ids": [PROJECT_IDS[5]],
            "created_at":         "2026-01-10T09:00:00Z",
        },
    ]
    await db.capabilities.insert_many(CAPABILITIES)
    for c in CAPABILITIES:
        c.pop("_id", None)
    print(f"Train SAFe créé : {TRAIN['name']} · 2 PIs · 4 sprints · {len(CAPABILITIES)} capabilities")

    # ── Tâches SAFe pour Phoenix (P0) — hiérarchie feature / user story ──────
    # (Ajout à la collection tasks existante)
    SAFE_TASK_IDS = [str(uuid.uuid4()) for _ in range(5)]
    SAFE_TASKS = [
        # Feature 1
        {
            "task_id":         SAFE_TASK_IDS[0],
            "tenant_id":       TENANT_ID,
            "project_id":      PROJECT_IDS[0],
            "name":            "Parcours Onboarding Web",
            "type":            "feature",
            "status":          "in_progress",
            "task_level":      "feature",
            "parent_id":       None,
            "lifecycle_phase": "implementation",
            "jh_planned":      45.0,
            "jh_consumed":     28.0,
            "budget_planned_k": 33.75,
            "budget_consumed_k": 21.0,
            "date_start_planned": "2026-01-05",
            "date_end_planned":   "2026-02-28",
            "phase_estimates": [
                {"phase": "analyse",        "jh_estimated": 8.0,  "jh_actual": 8.0},
                {"phase": "conception",     "jh_estimated": 10.0, "jh_actual": 9.0},
                {"phase": "implementation", "jh_estimated": 27.0, "jh_actual": None},
            ],
            "created_at": "2026-01-05T09:00:00Z",
        },
        # User Stories de Feature 1
        {
            "task_id":         SAFE_TASK_IDS[1],
            "tenant_id":       TENANT_ID,
            "project_id":      PROJECT_IDS[0],
            "name":            "Écran inscription et validation email",
            "type":            "user_story",
            "status":          "done",
            "task_level":      "user_story",
            "parent_id":       SAFE_TASK_IDS[0],
            "lifecycle_phase": "done",
            "jh_planned":      12.0,
            "jh_consumed":     11.5,
            "budget_planned_k": 9.0,
            "budget_consumed_k": 8.625,
            "date_start_planned": "2026-01-05",
            "date_end_planned":   "2026-01-23",
            "phase_estimates": [],
            "created_at": "2026-01-05T09:00:00Z",
        },
        {
            "task_id":         SAFE_TASK_IDS[2],
            "tenant_id":       TENANT_ID,
            "project_id":      PROJECT_IDS[0],
            "name":            "Intégration OCR document d'identité (KYC)",
            "type":            "user_story",
            "status":          "in_progress",
            "task_level":      "user_story",
            "parent_id":       SAFE_TASK_IDS[0],
            "lifecycle_phase": "implementation",
            "jh_planned":      18.0,
            "jh_consumed":     10.0,
            "budget_planned_k": 13.5,
            "budget_consumed_k": 7.5,
            "date_start_planned": "2026-01-26",
            "date_end_planned":   "2026-02-28",
            "phase_estimates": [],
            "created_at": "2026-01-26T09:00:00Z",
        },
        # Feature 2
        {
            "task_id":         SAFE_TASK_IDS[3],
            "tenant_id":       TENANT_ID,
            "project_id":      PROJECT_IDS[0],
            "name":            "API Gateway Banking — Auth & Sécurité",
            "type":            "feature",
            "status":          "done",
            "task_level":      "feature",
            "parent_id":       None,
            "lifecycle_phase": "done",
            "jh_planned":      30.0,
            "jh_consumed":     32.0,
            "budget_planned_k": 22.5,
            "budget_consumed_k": 24.0,
            "date_start_planned": "2026-01-05",
            "date_end_planned":   "2026-02-13",
            "phase_estimates": [],
            "created_at": "2026-01-05T09:00:00Z",
        },
        # User Story de Feature 2
        {
            "task_id":         SAFE_TASK_IDS[4],
            "tenant_id":       TENANT_ID,
            "project_id":      PROJECT_IDS[0],
            "name":            "Authentification OAuth2 + MFA renforcé",
            "type":            "user_story",
            "status":          "done",
            "task_level":      "user_story",
            "parent_id":       SAFE_TASK_IDS[3],
            "lifecycle_phase": "done",
            "jh_planned":      20.0,
            "jh_consumed":     22.0,
            "budget_planned_k": 15.0,
            "budget_consumed_k": 16.5,
            "date_start_planned": "2026-01-05",
            "date_end_planned":   "2026-02-13",
            "phase_estimates": [],
            "created_at": "2026-01-05T09:00:00Z",
        },
    ]
    await db.tasks.insert_many(SAFE_TASKS)
    for t in SAFE_TASKS:
        t.pop("_id", None)
    print(f"Tâches SAFe créées (Phoenix) : {len(SAFE_TASKS)} (2 features + 3 user stories)")

    print("\n=== Comptes disponibles ===")
    print("  admin@altair.fr    / Admin1234!  (TENANT_ADMIN)  → Sophie Martin (Architecte SI)")
    print("  pmo@altair.fr      / Pmo1234!    (PMO_USER)      → Thomas Dubois (Chef de Projet Senior)")
    print("  viewer@altair.fr   / View1234!   (READ_ONLY)")
    print("\nSeed terminé avec succès.")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
