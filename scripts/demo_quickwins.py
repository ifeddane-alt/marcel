#!/usr/bin/env python3
"""Quick wins DÉMO MARCEL (tenant Altair) — 2 corrections ciblées, idempotentes.

QW1 : profil « Direction SI » (CIO) → accès LECTURE capacité (ajout resources.view).
      resources.view est une permission de consultation (aucune écriture).
QW2 : scénario de démonstration Budget Participatif (/pb) réaliste et hétérogène.

Idempotent : PB tagué created_by='demo_curation' (purge + ré-insertion) ; profil en $addToSet.
NE MODIFIE NI le code, NI le socle sécurité, NI les autres personas/anomalies volontaires.
À exécuter DANS le conteneur backend.
"""
import asyncio
import os
import uuid
from datetime import datetime, timezone, timedelta

from motor.motor_asyncio import AsyncIOMotorClient

T = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
TAG = "demo_curation"
NOW = datetime.now(timezone.utc).isoformat()


def iid(key: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, "marcel-pb-" + key))


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]

    # ── QW1 : Direction SI → lecture capacité ─────────────────────────────
    prof = await db.profiles.find_one({"tenant_id": T, "name": "Direction SI"}, {"_id": 0, "profile_id": 1, "permissions": 1})
    before = "resources.view" in (prof.get("permissions") or [])
    await db.profiles.update_one(
        {"tenant_id": T, "name": "Direction SI"},
        {"$addToSet": {"permissions": "resources.view"}})
    # invalider les tokens en cours des utilisateurs de ce profil (re-login recharge les perms)
    r = await db.users.update_many(
        {"tenant_id": T, "profile_id": prof["profile_id"]},
        {"$inc": {"perm_version": 1}})
    print(f"QW1 Direction SI resources.view: {'déjà présent' if before else 'AJOUTÉ'} | pv bump users={r.modified_count}")

    # ── QW2 : Budget Participatif — scénario démo ─────────────────────────
    # purge idempotente des sessions démo précédentes
    old = await db.pb_sessions.find({"tenant_id": T, "created_by": TAG}, {"_id": 0, "session_id": 1}).to_list(None)
    old_ids = [s["session_id"] for s in old]
    if old_ids:
        await db.pb_votes.delete_many({"session_id": {"$in": old_ids}})
        await db.pb_sessions.delete_many({"session_id": {"$in": old_ids}})

    # voteurs réels
    emails = ["dsi@altair.fr", "manager@altair.fr", "cp@altair.fr", "user@altair.fr", "achats@altair.fr", "viewer@altair.fr", "pmo@altair.fr"]
    users = {}
    for e in emails:
        u = await db.users.find_one({"email": e, "tenant_id": T}, {"_id": 0, "user_id": 1, "name": 1, "profile_id": 1})
        if u:
            p = await db.profiles.find_one({"profile_id": u.get("profile_id")}, {"_id": 0, "code": 1})
            u["profile_code"] = (p or {}).get("code")
            users[e] = u

    def vote_docs(session_id, mapping):
        docs = []
        for email, alloc in mapping.items():
            u = users.get(email)
            if not u:
                continue
            docs.append({
                "vote_id": iid(session_id + email), "session_id": session_id, "tenant_id": T,
                "user_id": u["user_id"], "user_name": u["name"], "profile_code": u.get("profile_code"),
                "allocations": {iid(k): float(v) for k, v in alloc.items()}, "submitted_at": NOW,
            })
        return docs

    # Session A — ouverte, enveloppe 500k, 6 candidats (coûts 700k > enveloppe → arbitrage réel)
    sa_id = iid("sessionA-innovation-2026")
    A_items = [
        ("A-copilot", "Copilot IA pour les conseillers", 180000, "P01-INNOV1"),
        ("A-selfcare", "Portail self-care client v2", 140000, "P07-INNOV2"),
        ("A-finops", "Observabilité & FinOps cloud", 90000, "P11-INNOV3"),
        ("A-greenit", "Green IT — sobriété datacenter", 70000, "P05-INNOV4"),
        ("A-marketplace", "Marketplace API partenaires", 160000, "P11-INNOV5"),
        ("A-qa", "Outillage QA / tests automatisés", 60000, "P08-INNOV6"),
    ]
    session_a = {
        "session_id": sa_id, "tenant_id": T, "name": "Enveloppe Innovation SI 2026",
        "envelope": 500000.0, "deadline": (datetime.now(timezone.utc) + timedelta(days=21)).date().isoformat(),
        "status": "open",
        "items": [{"item_id": iid(k), "label": lbl, "cost": float(c), "ref": ref} for k, lbl, c, ref in A_items],
        "weighted": False, "direction_weight": 2.0,
        "created_by": TAG, "created_by_name": "Curation démo", "created_at": NOW,
    }
    A_votes = {
        "dsi@altair.fr":     {"A-copilot":180000, "A-selfcare":140000, "A-finops":90000,  "A-greenit":0,     "A-marketplace":60000,  "A-qa":30000},
        "manager@altair.fr": {"A-copilot":150000, "A-selfcare":120000, "A-finops":90000,  "A-greenit":70000, "A-marketplace":40000,  "A-qa":30000},
        "cp@altair.fr":      {"A-copilot":180000, "A-selfcare":100000, "A-finops":60000,  "A-greenit":60000, "A-marketplace":60000,  "A-qa":40000},
        "user@altair.fr":    {"A-copilot":120000, "A-selfcare":140000, "A-finops":80000,  "A-greenit":40000, "A-marketplace":80000,  "A-qa":40000},
        "achats@altair.fr":  {"A-copilot":200000, "A-selfcare":80000,  "A-finops":50000,  "A-greenit":0,     "A-marketplace":120000, "A-qa":50000},
        "viewer@altair.fr":  {"A-copilot":160000, "A-selfcare":150000, "A-finops":100000, "A-greenit":30000, "A-marketplace":20000,  "A-qa":40000},
    }

    # Session B — clôturée, enveloppe 200k, 4 candidats
    sb_id = iid("sessionB-run-2026")
    B_items = [
        ("B-dette", "Réduction dette technique paiements", 90000, "RUN-01"),
        ("B-cicd", "Automatisation MEP (CI/CD)", 70000, "RUN-02"),
        ("B-monito", "Monitoring proactif incidents", 60000, "RUN-03"),
        ("B-runbook", "Documentation & runbooks", 30000, "RUN-04"),
    ]
    session_b = {
        "session_id": sb_id, "tenant_id": T, "name": "Fonds Amélioration Run 2026",
        "envelope": 200000.0, "deadline": (datetime.now(timezone.utc) - timedelta(days=5)).date().isoformat(),
        "status": "closed",
        "items": [{"item_id": iid(k), "label": lbl, "cost": float(c), "ref": ref} for k, lbl, c, ref in B_items],
        "weighted": False, "direction_weight": 2.0,
        "created_by": TAG, "created_by_name": "Curation démo", "created_at": NOW,
    }
    B_votes = {
        "dsi@altair.fr":     {"B-dette":90000, "B-cicd":70000, "B-monito":40000, "B-runbook":0},
        "manager@altair.fr": {"B-dette":80000, "B-cicd":60000, "B-monito":60000, "B-runbook":0},
        "cp@altair.fr":      {"B-dette":70000, "B-cicd":70000, "B-monito":30000, "B-runbook":30000},
        "pmo@altair.fr":     {"B-dette":90000, "B-cicd":50000, "B-monito":40000, "B-runbook":20000},
    }

    await db.pb_sessions.insert_many([session_a, session_b])
    va = vote_docs(sa_id, A_votes)
    vb = vote_docs(sb_id, B_votes)
    if va:
        await db.pb_votes.insert_many(va)
    if vb:
        await db.pb_votes.insert_many(vb)
    print(f"QW2 PB: 2 sessions ('{session_a['name']}' open {len(va)} votes, '{session_b['name']}' closed {len(vb)} votes)")


asyncio.run(main())
