#!/usr/bin/env python3
"""Rotation ENCRYPTION_KEY — ré-chiffre les credentials connecteurs (toutes bases/tenants).

Usage (sur le VPS, la NOUVELLE clé étant déjà dans ENCRYPTION_KEY du .env) :
  docker compose exec -e OLD_ENCRYPTION_KEY='<ancienne_cle>' -T backend \
    python /app/scripts/rotate_encryption_key.py

Le script déchiffre chaque connector_configs.auth_credentials_enc avec l'ANCIENNE clé
et le ré-chiffre avec la clé courante (ENCRYPTION_KEY). Idempotent : les documents déjà
lisibles avec la clé courante sont ignorés.
"""
import asyncio
import json
import os
import sys

from cryptography.fernet import Fernet
from motor.motor_asyncio import AsyncIOMotorClient

OLD_KEY = os.environ.get("OLD_ENCRYPTION_KEY", "")
NEW_KEY = os.environ.get("ENCRYPTION_KEY", "")
if not OLD_KEY or not NEW_KEY:
    print("ERREUR: OLD_ENCRYPTION_KEY et ENCRYPTION_KEY sont requis dans l'environnement")
    sys.exit(1)
if OLD_KEY == NEW_KEY:
    print("ERREUR: l'ancienne et la nouvelle clé sont identiques")
    sys.exit(1)

f_old, f_new = Fernet(OLD_KEY.encode()), Fernet(NEW_KEY.encode())


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    rotated = skipped = failed = 0
    async for doc in db.connector_configs.find(
            {"auth_credentials_enc": {"$exists": True, "$ne": ""}},
            {"_id": 1, "auth_credentials_enc": 1, "connector_type": 1, "tenant_id": 1}):
        enc = doc["auth_credentials_enc"]
        try:
            f_new.decrypt(enc.encode())
            skipped += 1
            continue
        except Exception:
            pass
        try:
            plain = f_old.decrypt(enc.encode())
            json.loads(plain)
            new_enc = f_new.encrypt(plain).decode()
            await db.connector_configs.update_one(
                {"_id": doc["_id"]}, {"$set": {"auth_credentials_enc": new_enc}})
            rotated += 1
        except Exception as e:
            failed += 1
            print(f"ECHEC {doc.get('connector_type')} tenant={doc.get('tenant_id')}: {type(e).__name__}")
    print(f"Rotation terminée: {rotated} ré-chiffré(s), {skipped} déjà à jour, {failed} échec(s)")
    sys.exit(1 if failed else 0)


asyncio.run(main())
