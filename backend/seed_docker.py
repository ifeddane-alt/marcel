"""
Seed initial pour déploiement Docker — MARCEL.

Crée le tenant et l'utilisateur administrateur au premier démarrage.
Si un tenant existe déjà, ce script ne fait rien (idempotent).

Variables d'environnement utilisées :
  TENANT_NAME      Nom du tenant (ex: "Agrica")
  ADMIN_EMAIL      Email de l'administrateur
  ADMIN_PASSWORD   Mot de passe de l'administrateur
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def seed():
    # Idempotent : on ne fait rien si un tenant existe déjà
    existing = await db.tenants.find_one({})
    if existing:
        print(f"[seed_docker] Tenant '{existing.get('name')}' déjà présent — aucune action.")
        return

    tenant_name = os.environ.get("TENANT_NAME", "MonEntreprise")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "ChangeMe2025!")
    now = datetime.now(timezone.utc).isoformat()
    tenant_id = str(uuid.uuid4())

    # Création du tenant
    await db.tenants.insert_one({
        "tenant_id": tenant_id,
        "name": tenant_name,
        "plan": "enterprise",
        "settings": {
            "currency": "EUR",
            "locale": "fr-FR",
            "task_rag": {
                "budget_threshold_pct": 115,
                "delay_threshold_days": 5,
                "reference_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            },
        },
        "created_at": now,
    })
    print(f"[seed_docker] Tenant '{tenant_name}' créé (ID: {tenant_id})")

    # Création de l'administrateur
    await db.users.insert_one({
        "user_id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "email": admin_email,
        "name": "Administrateur",
        "role": "TENANT_ADMIN",
        "password_hash": _hash_password(admin_password),
        "created_at": now,
    })
    print(f"[seed_docker] Admin '{admin_email}' créé avec le rôle TENANT_ADMIN")

    print("\n" + "=" * 56)
    print("  MARCEL — Initialisation terminée avec succès")
    print(f"  Tenant       : {tenant_name}")
    print(f"  Administrateur : {admin_email}")
    print(f"  Mot de passe : {admin_password}")
    print("=" * 56 + "\n")


if __name__ == "__main__":
    asyncio.run(seed())
