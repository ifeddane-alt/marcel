"""
Seed Beta Corp — 2ème tenant pour tests multi-tenant.
Usage : python seed_beta_corp.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, date, timedelta
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "projetenne")
pwd_ctx   = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _now():
    return datetime.now(timezone.utc).isoformat()


async def seed():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    TENANT_ID = "betacorp"

    # ─── Tenant ──────────────────────────────────────────────────────────────
    existing = await db.tenants.find_one({"tenant_id": TENANT_ID})
    if existing:
        print("[SKIP] Tenant Beta Corp déjà existant.")
    else:
        await db.tenants.insert_one({
            "tenant_id": TENANT_ID,
            "name": "Beta Corp",
            "slug": "betacorp",
            "plan": "pro",
            "status": "active",
            "created_at": _now(),
            "branding": {
                "primary_color": "#1D4ED8",
                "secondary_color": "#3B82F6",
                "accent_color": "#10B981",
                "company_name": "Beta Corp",
                "font": "Arial",
            },
            "modules": [
                "roadmap", "compliance", "demands", "timesheets",
                "safe", "vendors",
            ],
        })
        print("[OK] Tenant Beta Corp créé.")

    # ─── Profils ─────────────────────────────────────────────────────────────
    admin_profile_id = str(uuid.uuid4())
    pm_profile_id    = str(uuid.uuid4())

    for prof in [
        {
            "profile_id": admin_profile_id,
            "tenant_id": TENANT_ID,
            "name": "Administrateur",
            "permissions": ["*"],
            "is_system": True,
        },
        {
            "profile_id": pm_profile_id,
            "tenant_id": TENANT_ID,
            "name": "Chef de Projet",
            "permissions": [
                "dashboard.view", "portfolio.view", "projects.view", "projects.edit",
                "roadmap.view", "scope.arbitrate", "scope.freeze", "scope.receive",
                "arbitrage.view", "timesheets.submit", "agent.chat", "agent.recommend",
            ],
            "is_system": False,
        },
    ]:
        exists = await db.profiles.find_one(
            {"tenant_id": TENANT_ID, "name": prof["name"]}
        )
        if not exists:
            await db.profiles.insert_one(prof)
    print("[OK] Profils Beta Corp créés.")

    # ─── Utilisateurs ────────────────────────────────────────────────────────
    users = [
        {
            "user_id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "email": "admin@betacorp.fr",
            "name": "Admin Beta Corp",
            "role": "admin",
            "profile_id": admin_profile_id,
            "profile_name": "Administrateur",
            "permissions": ["*"],
            "password_hash": pwd_ctx.hash("Beta2026!"),
            "is_active": True,
            "created_at": _now(),
        },
        {
            "user_id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "email": "pm@betacorp.fr",
            "name": "Marie Dupont",
            "role": "user",
            "profile_id": pm_profile_id,
            "profile_name": "Chef de Projet",
            "permissions": [
                "dashboard.view", "portfolio.view", "projects.view", "projects.edit",
                "roadmap.view", "scope.arbitrate", "scope.freeze", "scope.receive",
                "arbitrage.view", "timesheets.submit", "agent.chat", "agent.recommend",
            ],
            "password_hash": pwd_ctx.hash("PM2026!"),
            "is_active": True,
            "created_at": _now(),
        },
    ]
    for u in users:
        exists = await db.users.find_one({"email": u["email"]})
        if not exists:
            await db.users.insert_one(u)
    print("[OK] Utilisateurs Beta Corp créés.")

    # ─── Projets de démo ─────────────────────────────────────────────────────
    today = date.today()
    projects = [
        {
            "project_id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "name": "Modernisation ERP Beta",
            "status": "actif",
            "status_rag": "orange",
            "methodology": "waterfall",
            "budget_total": 850000,
            "budget_consumed": 310000,
            "budget_forecast": 920000,
            "capex_planned": 650000, "opex_planned": 200000,
            "capex_consumed": 240000, "opex_consumed": 70000,
            "jh_planned": 1200, "jh_consumed": 450,
            "start_date": (today - timedelta(days=180)).isoformat(),
            "end_date_baseline": (today + timedelta(days=180)).isoformat(),
            "end_date_forecast": (today + timedelta(days=220)).isoformat(),
            "owner": "Marie Dupont",
            "phase": "Réalisation",
        },
        {
            "project_id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "name": "Portail Client Beta",
            "status": "actif",
            "status_rag": "green",
            "methodology": "agile",
            "budget_total": 320000,
            "budget_consumed": 95000,
            "budget_forecast": 330000,
            "capex_planned": 250000, "opex_planned": 70000,
            "capex_consumed": 75000, "opex_consumed": 20000,
            "jh_planned": 500, "jh_consumed": 145,
            "start_date": (today - timedelta(days=90)).isoformat(),
            "end_date_baseline": (today + timedelta(days=120)).isoformat(),
            "end_date_forecast": (today + timedelta(days=115)).isoformat(),
            "owner": "Admin Beta Corp",
            "phase": "Développement",
        },
        {
            "project_id": str(uuid.uuid4()),
            "tenant_id": TENANT_ID,
            "name": "Migration Cloud Beta",
            "status": "en_preparation",
            "status_rag": "green",
            "methodology": "hybrid",
            "budget_total": 540000,
            "budget_consumed": 12000,
            "budget_forecast": 540000,
            "capex_planned": 400000, "opex_planned": 140000,
            "capex_consumed": 10000, "opex_consumed": 2000,
            "jh_planned": 750, "jh_consumed": 18,
            "start_date": (today + timedelta(days=30)).isoformat(),
            "end_date_baseline": (today + timedelta(days=365)).isoformat(),
            "end_date_forecast": (today + timedelta(days=365)).isoformat(),
            "owner": "Marie Dupont",
            "phase": "Cadrage",
        },
    ]
    for p in projects:
        exists = await db.projects.find_one(
            {"tenant_id": TENANT_ID, "name": p["name"]}
        )
        if not exists:
            await db.projects.insert_one(p)
    print(f"[OK] {len(projects)} projets Beta Corp créés.")

    # ─── Risques de démo ─────────────────────────────────────────────────────
    beta_projects = await db.projects.find(
        {"tenant_id": TENANT_ID}, {"_id": 0, "project_id": 1, "name": 1}
    ).to_list(None)
    proj_ids = [p["project_id"] for p in beta_projects]

    if proj_ids:
        risk_count = await db.risks.count_documents({"tenant_id": TENANT_ID})
        if risk_count == 0:
            risks = [
                {
                    "risk_id": str(uuid.uuid4()),
                    "tenant_id": TENANT_ID,
                    "project_id": proj_ids[0],
                    "title": "Retard fournisseur ERP",
                    "category": "Fournisseur",
                    "probability": 4, "impact": 4, "criticality": 16,
                    "status": "identifié", "owner": "Admin Beta Corp",
                },
                {
                    "risk_id": str(uuid.uuid4()),
                    "tenant_id": TENANT_ID,
                    "project_id": proj_ids[1] if len(proj_ids) > 1 else proj_ids[0],
                    "title": "Disponibilité ressources Dev",
                    "category": "Ressources",
                    "probability": 3, "impact": 3, "criticality": 9,
                    "status": "en cours", "owner": "Marie Dupont",
                },
            ]
            for r in risks:
                await db.risks.insert_one(r)
            print(f"[OK] {len(risks)} risques Beta Corp créés.")

    client.close()
    print("\n✅ Seed Beta Corp terminé.")
    print("   Connexion : admin@betacorp.fr / Beta2026!")
    print("   PM        : pm@betacorp.fr / PM2026!")


if __name__ == "__main__":
    asyncio.run(seed())
