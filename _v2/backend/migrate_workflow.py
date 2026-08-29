"""
Migration Workflow Timesheets — Chantier 3 Enhancement
- Ajoute validator_resource_id sur les ressources
- Ajoute owner_resource_id sur les projets
- Avance quelques timesheets soumis vers cp_reviewed pour la démo
Usage: python migrate_workflow.py
"""
import asyncio, os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


async def migrate():
    print("=== Migration Workflow Timesheets (C3-Enhancement) ===\n")

    # ── 1. Charger les ressources par nom ─────────────────────────────────────
    all_res = await db.resources.find({}, {"_id": 0}).to_list(None)
    res_by_name = {r["name"]: r["resource_id"] for r in all_res}

    sophie    = res_by_name["Sophie Martin"]
    thomas    = res_by_name["Thomas Dubois"]
    alexandre = res_by_name["Alexandre Moreau"]
    marie     = res_by_name["Marie Fontaine"]
    isabelle  = res_by_name["Isabelle Bernard"]
    julien    = res_by_name["Julien Girard"]
    camille   = res_by_name["Camille Rousseau"]
    lucie     = res_by_name["Lucie Dumont"]

    # ── 2. Assigner validator_resource_id ────────────────────────────────────
    # Règle: par défaut = manager équipe, mais overrides manuels ici
    validator_map = {
        sophie:    thomas,    # Sophie Martin    → Thomas Dubois valide
        thomas:    sophie,    # Thomas Dubois    → Sophie Martin valide
        alexandre: sophie,    # Alexandre Moreau → Sophie Martin valide (pas de manager N+1 = admin)
        marie:     isabelle,  # Marie Fontaine   → Isabelle Bernard (manager Dev B)
        camille:   isabelle,  # Camille Rousseau → Isabelle Bernard (manager Dev B)
        lucie:     julien,    # Lucie Dumont     → Julien Girard (manager QA)
        # Nicolas, Isabelle, Julien, Marc : managers d'équipe → pas de validator_resource_id
        # (leurs timesheets seront validés directement par le PMO via bypass)
    }

    count = 0
    for rid, vid in validator_map.items():
        await db.resources.update_one(
            {"resource_id": rid},
            {"$set": {"validator_resource_id": vid}},
        )
        count += 1
    print(f"✓ validator_resource_id mis à jour pour {count} ressources")

    # ── 3. Assigner owner_resource_id sur les projets ────────────────────────
    all_proj = await db.projects.find({}, {"_id": 0, "project_id": 1, "name": 1}).to_list(None)
    proj_by_prefix = {p["name"][:20]: p["project_id"] for p in all_proj}

    project_owners = {
        "Projet Phoenix":       thomas,   # CP Senior pilote Phoenix
        "Modernisation SI Fin": sophie,   # Sophie en charge Finance
        "Déploiement ERP SAP":  sophie,   # Architecte SI → SAP
        "Digital Workplace 20": thomas,   # Thomas pilote DW
        "Programme CRM Sales":  thomas,   # Thomas pilote CRM
        "Migration Infrastruc":  sophie,  # Sophie → Azure / Infra
        "Refonte Portail RH &": thomas,   # Thomas pilote RH
        "Programme Conformité": sophie,   # Sophie → DORA/NIS2
    }

    proj_count = 0
    for prefix, owner_id in project_owners.items():
        for proj_name, proj_id in proj_by_prefix.items():
            if proj_name.startswith(prefix[:15]):
                await db.projects.update_one(
                    {"project_id": proj_id},
                    {"$set": {"owner_resource_id": owner_id}},
                )
                proj_count += 1
                break
    print(f"✓ owner_resource_id mis à jour pour {proj_count} projets")

    # ── 4. Avancer timesheets Alexandre & Marie → cp_reviewed ────────────────
    now = datetime.now(timezone.utc).isoformat()
    # Simuler un timestamp il y a 2 jours ouvrés (pour que le timeout ne soit pas déclenché)
    cp_reviewed_at = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    result = await db.timesheets.update_many(
        {
            "resource_id": {"$in": [alexandre, marie]},
            "status": "submitted",
        },
        {
            "$set": {
                "status": "cp_reviewed",
                "cp_reviewed_at": cp_reviewed_at,
                "modified_by": sophie,
                "modified_at": now,
                "modification_reason": "Migration demo — validé par le N+1",
            }
        },
    )
    print(f"✓ {result.modified_count} timesheets passés en cp_reviewed")

    # ── 5. Ajouter les champs manquants sur tous les timesheets ──────────────
    await db.timesheets.update_many(
        {"cp_reviewed_at": {"$exists": False}},
        {"$set": {"cp_reviewed_at": None, "modified_by": None,
                  "modified_at": None, "modification_reason": None}},
    )
    print("✓ Champs cp_reviewed_at / modified_by ajoutés aux timesheets existants")

    # ── 6. Vérification ──────────────────────────────────────────────────────
    print("\n── Vérification ──")
    statuses = {}
    for s in await db.timesheets.distinct("status"):
        c = await db.timesheets.count_documents({"status": s})
        statuses[s] = c
    print(f"  Statuts timesheets : {statuses}")

    resources_with_validator = await db.resources.count_documents(
        {"validator_resource_id": {"$exists": True, "$ne": None}}
    )
    print(f"  Ressources avec validator_resource_id : {resources_with_validator}")

    projects_with_owner = await db.projects.count_documents(
        {"owner_resource_id": {"$exists": True, "$ne": None}}
    )
    print(f"  Projets avec owner_resource_id : {projects_with_owner}")

    print("\n=== Migration terminée avec succès ! ===")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
