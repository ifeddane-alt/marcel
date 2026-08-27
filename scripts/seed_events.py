"""Génère l'agenda 2026 des instances (events) — à lancer après seed-defaults des event_types."""
import os, sys, uuid, asyncio, random
from datetime import datetime, timezone, date

sys.path.insert(0, "/app/backend")
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass
from motor.motor_asyncio import AsyncIOMotorClient

random.seed(7)
NOW = datetime.now(timezone.utc).isoformat()
TODAY = date.today()
uid = lambda: str(uuid.uuid4())


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    admin = await db.users.find_one({"email": "admin@altair.fr"}, {"tenant_id": 1})
    t = admin["tenant_id"]
    etypes = [e async for e in db.event_types.find({"tenant_id": t}, {"event_type_id": 1, "name": 1, "level": 1})]
    if not etypes:
        print("Aucun event_type — lancer d'abord POST /api/events/types/seed-defaults")
        return
    await db.events.delete_many({"tenant_id": t})
    events = []
    for m in range(1, 13):
        for et in etypes:
            n_ev = 1 if et["level"] != "projet" else random.randint(2, 5)
            for _ in range(n_ev):
                d = date(2026, m, random.randint(2, 27))
                events.append({"event_id": uid(), "tenant_id": t, "event_type_id": et["event_type_id"],
                               "title": et["name"], "level": et["level"], "date": d.strftime("%Y-%m-%d"),
                               "status": "tenu" if d < TODAY else "planifie", "notes": "", "created_at": NOW})
    await db.events.insert_many(events)
    print(f"OK — {len(events)} événements générés sur {len(etypes)} types d'instance.")


asyncio.run(main())
