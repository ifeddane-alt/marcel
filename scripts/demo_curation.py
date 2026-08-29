#!/usr/bin/env python3
"""Curation DÉMO MARCEL (tenant Altair) — corrections d'anomalies ACCIDENTELLES uniquement.

1. Capacité : crée une surcharge hétérogène (critique/haute/modérée) sur 3 équipes,
   sur Aoû→Nov 2026, pour rendre démontrable la surcharge capacitaire.
   (le seed plafonnait chaque ressource à 20 JH/mois → aucune surcharge possible)
2. Personas : assigne les profils métier aux comptes démo + crée le compte DSI,
   avec mots de passe connus, pour des habilitations cohérentes.

Idempotent : les allocations de curation sont taguées created_by='demo_curation'
et purgées avant ré-insertion. À exécuter DANS le conteneur backend (motor+bcrypt+env).
NE MODIFIE PAS les règles métier ni le socle sécurité.
"""
import asyncio
import os
import uuid

import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

T = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
TAG = "demo_curation"
MONTHS = ["2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"]
# équipe -> taux de charge cible (surcharge hétérogène)
TARGETS = {
    "Équipe Risques SI": 1.40,   # critique
    "Cellule PMO": 1.22,         # haute
    "Squad Crédit Immo": 1.10,   # modérée
}
DEMO_ACCOUNTS = [
    # email, name, role, profile_name, password
    ("dsi@altair.fr", "Claire Fontaine", "PMO_USER", "Direction SI", "Dsi2026!"),
    ("manager@altair.fr", "Isabelle Bernard", "PMO_USER", "PMO Portefeuille", "Altair2026!"),
    ("cp@altair.fr", "Nicolas Petit", "PMO_USER", "Chef de Projet", "CdP2026!"),
]


def pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    # ── 1) Capacité : surcharge hétérogène ────────────────────────────────
    await db.allocations.delete_many({"created_by": TAG})
    active = await db.projects.find_one({"tenant_id": T, "status": "actif"}, {"_id": 0, "project_id": 1})
    pid = active["project_id"]
    new_allocs, report = [], []
    for team, rate in TARGETS.items():
        res = await db.resources.find({"tenant_id": T, "team": team}, {"_id": 0}).to_list(None)
        rids = [r["resource_id"] for r in res]
        cap = sum((r.get("capacity_jh_month") or 20) * ((r.get("availability_rate") or 100) / 100) for r in res)
        for m in MONTHS:
            cur = await db.allocations.find({"resource_id": {"$in": rids}, "period_month": m},
                                            {"_id": 0, "jh_allocated": 1}).to_list(None)
            load = sum(a.get("jh_allocated", 0) for a in cur)
            delta = round(rate * cap - load)
            if delta <= 0:
                report.append(f"{team} {m}: déjà {round(load/cap*100)}% (pas d'ajout)")
                continue
            # répartir le delta sur quelques ressources, chunks ~20 JH
            i = 0
            remaining = delta
            while remaining > 0:
                chunk = min(20, remaining)
                rid = rids[i % len(rids)]
                new_allocs.append({
                    "allocation_id": str(uuid.uuid4()), "project_id": pid, "resource_id": rid,
                    "period_month": m, "jh_allocated": chunk, "jh_consumed": 0,
                    "allocation_rate": 100, "created_by": TAG,
                })
                remaining -= chunk
                i += 1
            report.append(f"{team} {m}: {round(load/cap*100)}% -> {round((load+delta)/cap*100)}% (+{delta} JH)")
    if new_allocs:
        await db.allocations.insert_many(new_allocs)
    print("── Capacité ──")
    for r in report:
        print("  " + r)
    print(f"  allocations de curation insérées: {len(new_allocs)}")

    # ── 2) Personas : profils + comptes + mots de passe ───────────────────
    print("── Personas ──")
    for email, name, role, profile_name, password in DEMO_ACCOUNTS:
        prof = await db.profiles.find_one({"tenant_id": T, "name": profile_name}, {"_id": 0, "profile_id": 1})
        if not prof:
            print(f"  ⚠ profil introuvable: {profile_name} (compte {email} inchangé)")
            continue
        existing = await db.users.find_one({"email": email}, {"_id": 0, "perm_version": 1})
        pvv = (existing.get("perm_version", 1) + 1) if existing else 1
        doc = {
            "tenant_id": T, "email": email, "name": name, "role": role,
            "profile_id": prof["profile_id"], "password_hash": pw(password),
            "is_active": True, "perm_version": pvv,
        }
        if existing:
            await db.users.update_one({"email": email}, {"$set": doc})
            action = f"maj (pv={pvv})"
        else:
            doc["user_id"] = str(uuid.uuid4())
            await db.users.insert_one(doc)
            action = "créé"
        print(f"  {email:22s} -> profil «{profile_name}» | {action}")

    # ── 3) Vérification personas (permissions effectives) ─────────────────
    print("── Vérification ──")
    for email, _, _, profile_name, _ in DEMO_ACCOUNTS:
        u = await db.users.find_one({"email": email}, {"_id": 0, "profile_id": 1})
        p = await db.profiles.find_one({"profile_id": u["profile_id"], "tenant_id": T},
                                       {"_id": 0, "name": 1, "permissions": 1})
        perms = p.get("permissions", [])
        own = "projects.view_own" in perms
        print(f"  {email:22s} profil={p['name']:18s} nperm={len(perms):3d} scoping_own={own}")
    # combien de projets possède cp@ (scoping)
    cp = await db.users.find_one({"email": "cp@altair.fr"}, {"_id": 0, "user_id": 1})
    n = await db.projects.count_documents({"tenant_id": T, "owner_id": cp["user_id"]})
    print(f"  projets possédés par cp@ (vue scoping): {n}")


asyncio.run(main())
