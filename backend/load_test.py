#!/usr/bin/env python3
"""
Script de charge — génère 200 projets, 50 ressources, 1000 tâches,
500 allocations, 2000 timesheets et mesure les temps de chargement.
Indexes MongoDB automatiquement créés si temps > 2s.
Usage : python load_test.py [--cleanup]
"""
import asyncio
import argparse
import random
import time
import uuid
from datetime import datetime, timezone, date, timedelta

from motor.motor_asyncio import AsyncIOMotorClient
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME", "projetenne")
TENANT_ID = "altair_load_test"

STATUSES    = ["actif", "en_preparation", "cloture"]
RAGS        = ["green", "orange", "red"]
METHODS     = ["agile", "waterfall", "hybrid"]
PHASES      = ["Cadrage", "Conception", "Réalisation", "Recette", "Déploiement"]
FIRST_NAMES = ["Alice", "Bruno", "Clara", "Denis", "Eva", "Félix", "Gaia",
               "Hugo", "Iris", "Jean", "Karima", "Luc", "Marie", "Nathan",
               "Océane", "Paul", "Quentin", "Rose", "Samuel", "Tina"]
LAST_NAMES  = ["Martin", "Durand", "Bernard", "Petit", "Robert", "Richard",
               "Leroy", "Simon", "Moreau", "Laurent", "Lefebvre", "Michel",
               "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier"]
ROLES_RES   = ["Développeur", "Architecte", "Chef de Projet", "UX Designer",
               "Data Engineer", "DevOps", "Analyste", "Testeur"]


def _now():
    return datetime.now(timezone.utc)


def rnd_date(start_offset_days=0, spread=365):
    base = date.today() + timedelta(days=start_offset_days)
    return (base + timedelta(days=random.randint(0, spread))).isoformat()


async def create_indexes(db):
    """Crée les indexes MongoDB pour les performances."""
    print("\n[Indexes] Création des indexes de performance...")
    indexes = [
        ("projects",    [("tenant_id", 1), ("status", 1)]),
        ("projects",    [("tenant_id", 1), ("project_id", 1)]),
        ("tasks",       [("tenant_id", 1), ("project_id", 1)]),
        ("tasks",       [("project_id", 1), ("scope_status", 1)]),
        ("risks",       [("tenant_id", 1), ("project_id", 1)]),
        ("milestones",  [("tenant_id", 1), ("project_id", 1)]),
        ("timesheets",  [("tenant_id", 1), ("resource_id", 1)]),
        ("timesheets",  [("tenant_id", 1), ("project_id", 1)]),
        ("timesheets",  [("tenant_id", 1), ("week_start", -1)]),
        ("allocations", [("tenant_id", 1), ("project_id", 1)]),
        ("allocations", [("project_id", 1), ("resource_id", 1)]),
        ("agent_logs",  [("tenant_id", 1), ("created_at", -1)]),
        ("agent_logs",  [("tenant_id", 1), ("session_id", 1)]),
        ("users",       [("email", 1)]),
        ("users",       [("tenant_id", 1), ("role", 1)]),
    ]
    for collection, keys in indexes:
        try:
            await db[collection].create_index(keys, background=True)
            print(f"  ✓ {collection} {[k[0] for k in keys]}")
        except Exception as e:
            print(f"  ! {collection}: {e}")
    print("[Indexes] Terminé.\n")


async def seed_load_data(db):
    """Génère les données de charge."""
    print(f"[Seed] Génération des données de charge pour tenant='{TENANT_ID}'...")

    # ── 50 Ressources ────────────────────────────────────────────────────────
    resource_ids = [str(uuid.uuid4()) for _ in range(50)]
    resources = []
    for i, rid in enumerate(resource_ids):
        fn = random.choice(FIRST_NAMES)
        ln = random.choice(LAST_NAMES)
        resources.append({
            "resource_id": rid,
            "tenant_id":   TENANT_ID,
            "name":        f"{fn} {ln}",
            "email":       f"{fn.lower()}.{ln.lower()}{i}@load.test",
            "role":        random.choice(ROLES_RES),
            "daily_rate":  random.randint(500, 1200),
            "capacity":    random.choice([0.5, 0.8, 1.0]),
        })
    await db.resources.insert_many(resources, ordered=False)
    print(f"  ✓ {len(resources)} ressources insérées")

    # ── 200 Projets ──────────────────────────────────────────────────────────
    project_ids = [str(uuid.uuid4()) for _ in range(200)]
    projects = []
    for i, pid in enumerate(project_ids):
        budget = random.randint(100_000, 5_000_000)
        consumed_pct = random.uniform(0.05, 0.95)
        start_d = date.today() - timedelta(days=random.randint(0, 365))
        end_bl  = start_d + timedelta(days=random.randint(90, 540))
        end_fc  = end_bl  + timedelta(days=random.randint(-30, 90))
        projects.append({
            "project_id":       pid,
            "tenant_id":        TENANT_ID,
            "name":             f"Projet Load #{i+1:03d} — {random.choice(PHASES)}",
            "status":           random.choice(STATUSES),
            "status_rag":       random.choice(RAGS),
            "methodology":      random.choice(METHODS),
            "budget_total":     budget,
            "budget_consumed":  int(budget * consumed_pct),
            "budget_forecast":  int(budget * random.uniform(0.9, 1.2)),
            "capex_planned":    int(budget * 0.7),
            "opex_planned":     int(budget * 0.3),
            "capex_consumed":   int(budget * consumed_pct * 0.7),
            "opex_consumed":    int(budget * consumed_pct * 0.3),
            "jh_planned":       random.randint(200, 2000),
            "jh_consumed":      random.randint(50, 1000),
            "start_date":       start_d.isoformat(),
            "end_date_baseline":end_bl.isoformat(),
            "end_date_forecast":end_fc.isoformat(),
            "owner":            random.choice(FIRST_NAMES) + " " + random.choice(LAST_NAMES),
            "phase":            random.choice(PHASES),
        })
    await db.projects.insert_many(projects, ordered=False)
    print(f"  ✓ {len(projects)} projets insérés")

    # ── 1000 Tâches ──────────────────────────────────────────────────────────
    tasks = []
    for i in range(1000):
        pid = random.choice(project_ids)
        tasks.append({
            "task_id":      str(uuid.uuid4()),
            "tenant_id":    TENANT_ID,
            "project_id":   pid,
            "name":         f"Feature #{i+1:04d}",
            "scope_status": random.choice(["propose", "arbitrage", "sec", "reject"]),
            "priority":     random.choice(["high", "medium", "low"]),
            "start_date":   rnd_date(-90, 180),
            "end_date":     rnd_date(0, 270),
            "estimate_jh":  round(random.uniform(1, 50), 1),
            "status":       random.choice(["todo", "in_progress", "done"]),
        })
    await db.tasks.insert_many(tasks, ordered=False)
    print(f"  ✓ {len(tasks)} tâches insérées")

    # ── 500 Allocations ──────────────────────────────────────────────────────
    allocations = []
    for i in range(500):
        allocations.append({
            "allocation_id": str(uuid.uuid4()),
            "tenant_id":     TENANT_ID,
            "project_id":    random.choice(project_ids),
            "resource_id":   random.choice(resource_ids),
            "start_date":    rnd_date(-60, 120),
            "end_date":      rnd_date(60, 240),
            "daily_rate":    random.randint(500, 1200),
            "allocation_pct":random.choice([25, 50, 75, 100]),
            "jh_planned":    round(random.uniform(5, 100), 1),
        })
    await db.allocations.insert_many(allocations, ordered=False)
    print(f"  ✓ {len(allocations)} allocations insérées")

    # ── 2000 Timesheets ──────────────────────────────────────────────────────
    timesheets = []
    for i in range(2000):
        monday = date.today() - timedelta(weeks=random.randint(0, 26),
                                          days=date.today().weekday())
        timesheets.append({
            "timesheet_id":    str(uuid.uuid4()),
            "tenant_id":       TENANT_ID,
            "project_id":      random.choice(project_ids),
            "resource_id":     random.choice(resource_ids),
            "week_start":      monday.isoformat(),
            "hours_monday":    round(random.uniform(0, 8), 1),
            "hours_tuesday":   round(random.uniform(0, 8), 1),
            "hours_wednesday": round(random.uniform(0, 8), 1),
            "hours_thursday":  round(random.uniform(0, 8), 1),
            "hours_friday":    round(random.uniform(0, 8), 1),
            "hours_total":     round(random.uniform(20, 40), 1),
            "status":          random.choice(["draft", "submitted", "approved"]),
            "created_at":      _now(),
        })
    await db.timesheets.insert_many(timesheets, ordered=False)
    print(f"  ✓ {len(timesheets)} timesheets insérées")
    print(f"[Seed] Terminé — tenant '{TENANT_ID}'\n")

    return project_ids, resource_ids


async def measure_query_times(db, project_ids):
    """Mesure les temps de réponse des requêtes critiques."""
    print("[Mesure] Temps de chargement des requêtes clés...")
    results = {}

    # Dashboard
    t0 = time.perf_counter()
    await db.projects.count_documents({"tenant_id": TENANT_ID})
    await db.projects.aggregate([
        {"$match": {"tenant_id": TENANT_ID}},
        {"$group": {"_id": "$status_rag", "count": {"$sum": 1}}}
    ]).to_list(None)
    results["Dashboard"] = (time.perf_counter() - t0) * 1000

    # Portfolio list
    t0 = time.perf_counter()
    await db.projects.find({"tenant_id": TENANT_ID}, {"_id": 0}).sort("name", 1).to_list(None)
    results["Portfolio"] = (time.perf_counter() - t0) * 1000

    # Roadmap (projets + jalons)
    t0 = time.perf_counter()
    await db.projects.find({"tenant_id": TENANT_ID, "status": "actif"}, {"_id": 0}).to_list(None)
    await db.milestones.find({"tenant_id": TENANT_ID}, {"_id": 0}).to_list(None)
    results["Roadmap"] = (time.perf_counter() - t0) * 1000

    # Timesheets
    t0 = time.perf_counter()
    await db.timesheets.find({"tenant_id": TENANT_ID}, {"_id": 0}).limit(200).to_list(None)
    results["Timesheets"] = (time.perf_counter() - t0) * 1000

    print(f"\n{'Page':<20} {'Temps (ms)':>12}  {'Statut':>10}")
    print("-" * 46)
    needs_index = []
    for page, ms in results.items():
        status = "✓ OK" if ms < 2000 else "⚠ LENT"
        print(f"  {page:<18} {ms:>10.1f}ms  {status}")
        if ms >= 2000:
            needs_index.append(page)
    print()

    return needs_index


async def cleanup(db):
    """Supprime toutes les données du tenant de charge."""
    print(f"[Cleanup] Suppression du tenant '{TENANT_ID}'...")
    for col in ["projects", "resources", "tasks", "allocations", "timesheets",
                "risks", "milestones"]:
        result = await db[col].delete_many({"tenant_id": TENANT_ID})
        print(f"  ✓ {col}: {result.deleted_count} supprimé(s)")
    print("[Cleanup] Terminé.")


async def main(do_cleanup: bool):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    if do_cleanup:
        await cleanup(db)
        client.close()
        return

    # 1. Créer les indexes AVANT la génération
    await create_indexes(db)

    # 2. Générer les données
    project_ids, resource_ids = await seed_load_data(db)

    # 3. Mesurer les temps
    slow_pages = await measure_query_times(db, project_ids)

    if slow_pages:
        print(f"[Indexes] Pages lentes détectées : {slow_pages}")
        print("[Indexes] Les indexes avancés ont déjà été créés au début.")
        print("[Indexes] Vérifiez explain() sur les requêtes lentes si le problème persiste.")
    else:
        print("[Résultat] Toutes les pages chargent en < 2 secondes ✓")

    print(f"\n[Info] Pour supprimer les données de charge : python load_test.py --cleanup")
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cleanup", action="store_true",
                        help="Supprime les données de charge")
    args = parser.parse_args()
    asyncio.run(main(args.cleanup))
