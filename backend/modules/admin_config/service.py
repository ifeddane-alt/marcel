"""
Service admin_config — Lecture/écriture de la configuration tenant.
Gère les 6 sections : modules, workflows, enums, holidays, thresholds, ppt_branding.
"""
from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload
from .schemas import (
    ModulesUpdate, WorkflowsUpdate, EnumsUpdate,
    HolidaysUpdate, ThresholdsUpdate, PPTBrandingUpdate,
)

# ─── Lire la configuration complète ──────────────────────────────────────────

async def get_config(current_user: TokenPayload) -> dict:
    tenant = await db.tenants.find_one(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "settings": 1}
    )
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant introuvable")
    return tenant.get("settings") or {}


# ─── Mise à jour partielle d'une section ─────────────────────────────────────

async def _update_section(tenant_id: str, section: str, data: dict) -> dict:
    await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {f"settings.{section}": data}},
        upsert=True,
    )
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
    return (tenant or {}).get("settings") or {}


async def update_modules(data: ModulesUpdate, current_user: TokenPayload) -> dict:
    return await _update_section(
        current_user.tenant_id, "modules_enabled", data.modules_enabled
    )


async def update_workflows(data: WorkflowsUpdate, current_user: TokenPayload) -> dict:
    return await _update_section(
        current_user.tenant_id, "workflows", data.workflows.model_dump()
    )


async def update_enums(data: EnumsUpdate, current_user: TokenPayload) -> dict:
    return await _update_section(
        current_user.tenant_id, "enums", data.enums.model_dump()
    )


async def update_holidays(data: HolidaysUpdate, current_user: TokenPayload) -> dict:
    items = [h.model_dump() for h in data.holidays]
    return await _update_section(current_user.tenant_id, "holidays", items)


async def update_thresholds(data: ThresholdsUpdate, current_user: TokenPayload) -> dict:
    return await _update_section(
        current_user.tenant_id, "thresholds", data.thresholds.model_dump()
    )


async def update_ppt_branding(data: PPTBrandingUpdate, current_user: TokenPayload) -> dict:
    return await _update_section(
        current_user.tenant_id, "ppt_branding", data.ppt_branding.model_dump()
    )


# ─── Seed Altair ──────────────────────────────────────────────────────────────

SEED_ENUMS = {
    "milestone_types": {
        "epic_lifecycle": {
            "label": "Epic Lifecycle",
            "types": [
                {"value": "kick_off",        "label": "Kick-off",            "is_system": True, "order": 0},
                {"value": "review",          "label": "Review / PI Planning","is_system": True, "order": 1},
                {"value": "epic_analysis",   "label": "Epic Analysis",       "is_system": True, "order": 2},
                {"value": "general_design",  "label": "General Design",      "is_system": True, "order": 3},
                {"value": "detailed_design", "label": "Detailed Design",     "is_system": True, "order": 4},
                {"value": "development",     "label": "Development",         "is_system": True, "order": 5},
                {"value": "sit",             "label": "SIT",                 "is_system": True, "order": 6},
                {"value": "uat",             "label": "UAT",                 "is_system": True, "order": 7},
                {"value": "cut_over",        "label": "Cut-over",            "is_system": True, "order": 8},
                {"value": "hypercare",       "label": "Hypercare",           "is_system": True, "order": 9},
                {"value": "change_management","label":"Change Management",   "is_system": True, "order": 10},
            ],
        },
        "epic_milestone": {
            "label": "Epic Milestone",
            "types": [
                {"value": "go_no_go",       "label": "GO / NO-GO",   "is_system": True, "order": 0},
                {"value": "contractual",    "label": "Contractuel",  "is_system": True, "order": 1},
                {"value": "roll_out",       "label": "Roll-out",     "is_system": True, "order": 2},
                {"value": "key_deliverable","label": "Livrable clé", "is_system": True, "order": 3},
                {"value": "go_live",        "label": "Go-Live",      "is_system": True, "order": 4},
            ],
        },
        "transversal": {
            "label": "Transversal",
            "types": [
                {"value": "dependency", "label": "Dépendance inter-épics", "is_system": True, "order": 0},
                {"value": "regulatory", "label": "Réglementaire",          "is_system": True, "order": 1},
                {"value": "decomm",     "label": "Décommissionnement",     "is_system": True, "order": 2},
            ],
        },
    },
    "risk_categories": [
        {"value": "technique",  "label": "Technique",  "is_system": True, "order": 0},
        {"value": "budget",     "label": "Budget",     "is_system": True, "order": 1},
        {"value": "planning",   "label": "Planning",   "is_system": True, "order": 2},
        {"value": "ressource",  "label": "Ressource",  "is_system": True, "order": 3},
        {"value": "externe",    "label": "Externe",    "is_system": True, "order": 4},
        {"value": "conformité", "label": "Conformité", "is_system": True, "order": 5},
    ],
    "dependency_natures": [
        {"value": "deliverable", "label": "Livrable",       "is_system": True, "order": 0},
        {"value": "resource",    "label": "Ressource",      "is_system": True, "order": 1},
        {"value": "technical",   "label": "Technique",      "is_system": True, "order": 2},
        {"value": "regulatory",  "label": "Réglementaire",  "is_system": True, "order": 3},
        {"value": "budget",      "label": "Budget",         "is_system": True, "order": 4},
        {"value": "data",        "label": "Data",           "is_system": True, "order": 5},
    ],
    "project_statuses": [
        {"value": "en_preparation", "label": "En préparation", "is_system": True, "order": 0},
        {"value": "actif",          "label": "Actif",          "is_system": True, "order": 1},
        {"value": "en_pause",       "label": "En pause",       "is_system": True, "order": 2},
        {"value": "terminé",        "label": "Terminé",        "is_system": True, "order": 3},
    ],
    "demand_urgencies": [
        {"value": "critical", "label": "Critique",   "is_system": True, "order": 0},
        {"value": "high",     "label": "Haute",      "is_system": True, "order": 1},
        {"value": "medium",   "label": "Moyenne",    "is_system": True, "order": 2},
        {"value": "low",      "label": "Basse",      "is_system": True, "order": 3},
    ],
}

SEED_HOLIDAYS_FR_2026 = [
    {"date": "2026-01-01", "name": "Jour de l'An",       "country": "FR"},
    {"date": "2026-04-06", "name": "Lundi de Pâques",    "country": "FR"},
    {"date": "2026-05-01", "name": "Fête du Travail",    "country": "FR"},
    {"date": "2026-05-08", "name": "Victoire 1945",      "country": "FR"},
    {"date": "2026-05-14", "name": "Ascension",          "country": "FR"},
    {"date": "2026-05-25", "name": "Lundi de Pentecôte", "country": "FR"},
    {"date": "2026-07-14", "name": "Fête Nationale",     "country": "FR"},
    {"date": "2026-08-15", "name": "Assomption",         "country": "FR"},
    {"date": "2026-11-01", "name": "Toussaint",          "country": "FR"},
    {"date": "2026-11-11", "name": "Armistice 1918",     "country": "FR"},
    {"date": "2026-12-25", "name": "Noël",               "country": "FR"},
]

SEED_HOLIDAYS_MA_2026 = [
    {"date": "2026-01-01", "name": "Nouvel An",                       "country": "MA"},
    {"date": "2026-01-11", "name": "Manifeste de l'Indépendance",     "country": "MA"},
    {"date": "2026-03-20", "name": "Aïd Al-Fitr (J1)",               "country": "MA"},
    {"date": "2026-03-21", "name": "Aïd Al-Fitr (J2)",               "country": "MA"},
    {"date": "2026-05-01", "name": "Fête du Travail",                 "country": "MA"},
    {"date": "2026-05-27", "name": "Aïd Al-Adha (J1)",               "country": "MA"},
    {"date": "2026-05-28", "name": "Aïd Al-Adha (J2)",               "country": "MA"},
    {"date": "2026-06-16", "name": "1er Moharram 1448",               "country": "MA"},
    {"date": "2026-07-30", "name": "Fête du Trône",                   "country": "MA"},
    {"date": "2026-08-14", "name": "Allégeance Oued Eddahab",         "country": "MA"},
    {"date": "2026-08-20", "name": "Révolution du Roi et du Peuple",  "country": "MA"},
    {"date": "2026-08-21", "name": "Fête de la Jeunesse",             "country": "MA"},
    {"date": "2026-08-24", "name": "Mawlid An-Nabawi",               "country": "MA"},
    {"date": "2026-11-06", "name": "Marche Verte",                    "country": "MA"},
    {"date": "2026-11-18", "name": "Fête de l'Indépendance",          "country": "MA"},
]


async def seed_tenant_config(tenant_id: str) -> dict:
    """Seed complet de la configuration tenant Altair avec les valeurs par défaut."""
    default_settings = {
        "modules_enabled": ["safe", "demands", "timesheets", "leaves", "vendors", "compliance", "roadmap"],
        "workflows": {
            "timesheet": {
                "validation_steps": 2,
                "cp_timeout_days": 3,
                "auto_validate_on_timeout": True,
            },
            "demands": {
                "active_statuses": ["qualifiee", "priorisee", "acceptee", "refusee", "convertie"],
            },
        },
        "enums": SEED_ENUMS,
        "holidays": SEED_HOLIDAYS_FR_2026 + SEED_HOLIDAYS_MA_2026,
        "thresholds": {
            "capacity_orange_pct": 70,
            "capacity_red_pct": 85,
            "forfait_orange_pct": 80,
            "forfait_red_pct": 95,
            "tjm_variance_pct": 10,
            "regulatory_days": 90,
            "eac_ratio": 1.10,
        },
        "ppt_branding": {
            "primary_color": "#0B2545",
            "secondary_color": "#134074",
            "accent_color": "#10B981",
            "company_name": "Groupe Altair Industries",
            "font": "Arial",
            "logo_base64": None,
        },
        "arbitrage_weights": {
            "w1": 0.20,
            "w2": 0.25,
            "w3": 0.15,
            "w4": 0.15,
            "w5": 0.15,
            "w6": 0.10,
        },
    }
    await db.tenants.update_one(
        {"tenant_id": tenant_id},
        {"$set": {"settings": default_settings}},
        upsert=True,
    )
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
    return (tenant or {}).get("settings") or {}
