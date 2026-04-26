"""Seed 3 conversations de démo dans agent_logs pour Altair."""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


async def seed():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    admin = await db.users.find_one(
        {"tenant_id": "altair", "role": "admin"}, {"_id": 0, "user_id": 1}
    )
    cp = await db.users.find_one(
        {"tenant_id": "altair", "email": {"$regex": "cp@"}}, {"_id": 0, "user_id": 1}
    )

    admin_id = admin["user_id"] if admin else "demo-admin"
    cp_id = cp["user_id"] if cp else "demo-cp"
    now = datetime.now(timezone.utc)

    demos = [
        {
            "log_id": str(uuid.uuid4()),
            "session_id": str(uuid.uuid4()),
            "tenant_id": "altair",
            "user_id": admin_id,
            "question": "Quels sont les projets en retard avec un budget dépassé ?",
            "response": (
                "Sur le portefeuille Altair, 2 projets présentent simultanément un retard "
                "calendaire et un dépassement budgétaire : **ERP Finance 2025** (EAC +12 %, "
                "fin repoussée de 6 semaines) et **Refonte Portail RH** (EAC +8 %, retard "
                "de 3 semaines). Je recommande de déclencher une revue de pilotage urgente "
                "pour ces 2 projets."
            ),
            "sources": ["projects", "risks"],
            "tokens_used": 312,
            "duration_ms": 1840,
            "verified": True,
            "is_simulation": False,
            "created_at": now - timedelta(days=5),
        },
        {
            "log_id": str(uuid.uuid4()),
            "session_id": str(uuid.uuid4()),
            "tenant_id": "altair",
            "user_id": cp_id,
            "question": "Donne-moi un résumé des risques critiques sur le portefeuille.",
            "response": (
                "Le portefeuille Altair compte actuellement **4 risques critiques** "
                "(criticité ≥ 12) : défaillance fournisseur cloud (P=4, I=4), départ "
                "expert clé (P=3, I=4), retard livraison hardware (P=4, I=3), et pénurie "
                "ressources DevOps (P=3, I=3). Tous sont dans un statut « identifié » sans "
                "plan de mitigation actif — action recommandée."
            ),
            "sources": ["risks", "projects"],
            "tokens_used": 289,
            "duration_ms": 1520,
            "verified": True,
            "is_simulation": False,
            "created_at": now - timedelta(days=3),
        },
        {
            "log_id": str(uuid.uuid4()),
            "session_id": str(uuid.uuid4()),
            "tenant_id": "altair",
            "user_id": admin_id,
            "question": "Simule une réduction de 10 % du budget sur tous les projets actifs.",
            "response": (
                "Simulation effectuée : une réduction de 10 % de l'enveloppe CAPEX sur "
                "les 8 projets actifs libère **1,73 M€** mais génère 3 projets en "
                "sous-financement critique (ERP Finance, Migration Cloud, Modernisation SI). "
                "5 projets restent viables. Je recommande de concentrer la réduction sur "
                "les 3 projets en phase de cadrage (économie potentielle : 680 K€) sans "
                "impact sur les projets en cours de réalisation."
            ),
            "sources": ["projects", "envelopes"],
            "tokens_used": 425,
            "duration_ms": 2350,
            "verified": False,
            "is_simulation": True,
            "created_at": now - timedelta(days=1),
        },
    ]

    inserted = 0
    for demo in demos:
        exists = await db.agent_logs.find_one(
            {"tenant_id": "altair", "question": demo["question"]}
        )
        if not exists:
            await db.agent_logs.insert_one(demo)
            inserted += 1

    total = await db.agent_logs.count_documents({"tenant_id": "altair"})
    print(f"Inséré : {inserted} log(s). Total agent_logs Altair : {total}")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
