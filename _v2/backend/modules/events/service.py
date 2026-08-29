"""Référentiel des instances & calendrier annuel."""
import uuid
from datetime import date, datetime, timezone, timedelta

from core.database import db

LEVELS = ["strategique", "portefeuille", "projet", "safe", "run"]
FREQUENCIES = ["hebdomadaire", "bimensuel", "mensuel", "trimestriel", "semestriel", "annuel", "ponctuel"]

DEFAULT_TYPES = [
    # Stratégique
    {"name": "Comité stratégique SI", "level": "strategique", "frequency": "semestriel",
     "description": "Valide le schéma directeur, les grandes orientations et les enveloppes par programme / thème stratégique.",
     "participants": "DG, DSI, DAF, Directions métiers", "output": "Décisions structurantes, enveloppes validées"},
    {"name": "Cadrage budgétaire N+1", "level": "strategique", "frequency": "annuel", "anchor_month": 10,
     "description": "Construction du budget build + run de l'année suivante, arbitrage CAPEX/OPEX.",
     "participants": "DSI, DAF, PMO", "output": "Budget N+1 voté"},
    {"name": "Revue de trajectoire SI", "level": "strategique", "frequency": "annuel", "anchor_month": 3,
     "description": "Trajectoire applicative as-is → cible, plan de réduction de dette.",
     "participants": "DSI, Architectes, Urbanistes", "output": "Trajectoire SI mise à jour"},
    # Portefeuille
    {"name": "Revue de portefeuille", "level": "portefeuille", "frequency": "mensuel",
     "description": "Priorisation, kill/go, santé globale du portefeuille.",
     "participants": "DSI, PMO, Directeurs de programme", "output": "Portefeuille ajusté"},
    {"name": "COPIL portefeuille", "level": "portefeuille", "frequency": "mensuel",
     "description": "Santé RAG, alertes, arbitrages courants.",
     "participants": "DSI, PMO, Sponsors", "output": "Export COPIL"},
    {"name": "Comité d'investissement", "level": "portefeuille", "frequency": "mensuel", "linked_module": "governance",
     "description": "Business cases, gates de cadrage, dérogations. Porté par le module Gouvernance.",
     "participants": "DSI, DAF, PMO, Sponsors", "output": "Dossiers de gate, décisions Go/No-Go"},
    {"name": "Comité des demandes", "level": "portefeuille", "frequency": "bimensuel",
     "description": "Qualification et priorisation des nouvelles demandes.",
     "participants": "PMO, Métiers, Architectes", "output": "Demandes qualifiées"},
    {"name": "Reforecast budgétaire", "level": "portefeuille", "frequency": "trimestriel",
     "description": "Reforecast = scope du trimestre valorisé en euros. Écarts budget / forecast / consommé, transferts.",
     "participants": "DSI, DAF, PMO, CDP", "output": "Reforecast validé, transferts actés"},
    {"name": "Revue du portefeuille applicatif (APM)", "level": "portefeuille", "frequency": "semestriel",
     "description": "Obsolescence, rationalisation, dispositions TIME.",
     "participants": "Architectes, DSI, PMO", "output": "Plan de rationalisation"},
    # Projet
    {"name": "COPIL projet", "level": "projet", "frequency": "mensuel",
     "description": "Avancement, budget, risques, décisions par projet/programme.",
     "participants": "Sponsor, CDP, PMO", "output": "Export COPIL projet"},
    {"name": "Comité de gate", "level": "projet", "frequency": "ponctuel", "linked_module": "lifecycle",
     "description": "Passage de phase : livrables, avis architecture/sécurité, Go/No-Go.",
     "participants": "CDP, Architecte, RSSI, PMO", "output": "Décision de gate"},
    {"name": "COPROJ / point d'avancement", "level": "projet", "frequency": "hebdomadaire",
     "description": "Point opérationnel équipe.", "participants": "CDP, Équipe projet", "output": "Flash report"},
    {"name": "Revue des risques", "level": "projet", "frequency": "mensuel",
     "description": "Top risques, plans d'action.", "participants": "CDP, PMO, Risk owner", "output": "Registre des risques à jour"},
    # SAFe
    {"name": "PI Planning", "level": "safe", "frequency": "trimestriel", "linked_module": "safe",
     "description": "Engagement des objectifs du PI par ART.", "participants": "ART complet, Business Owners", "output": "Objectifs de PI engagés"},
    {"name": "System Demo", "level": "safe", "frequency": "bimensuel",
     "description": "Démonstration des incréments.", "participants": "ART, Parties prenantes", "output": "Feedback intégré"},
    {"name": "Inspect & Adapt", "level": "safe", "frequency": "trimestriel",
     "description": "Rétrospective de PI, predictability.", "participants": "ART complet", "output": "Rapport de PI"},
    {"name": "Portfolio Sync", "level": "safe", "frequency": "mensuel",
     "description": "Synchronisation value streams / epics entre les ARTs.", "participants": "LPM, RTE, Epic Owners", "output": "Kanban portefeuille à jour"},
    {"name": "Participatory Budgeting", "level": "safe", "frequency": "semestriel", "linked_module": "pb",
     "description": "Allocation collaborative des enveloppes value streams.", "participants": "LPM, Business Owners, ART", "output": "Enveloppes value streams"},
    # Run
    {"name": "CAB / Comité de MEP", "level": "run", "frequency": "hebdomadaire", "linked_module": "run",
     "description": "Validation des mises en production.", "participants": "Ops, CDP, Sécurité", "output": "MEP validées"},
    {"name": "Revue sécurité", "level": "run", "frequency": "mensuel", "linked_module": "security",
     "description": "Vulnérabilités, plan de remédiation.", "participants": "RSSI, Ops, DSI", "output": "Rapport sécurité"},
    {"name": "Revue fournisseurs", "level": "run", "frequency": "trimestriel", "linked_module": "vendors",
     "description": "Échéances contrats, performance, renouvellements.", "participants": "Achats, DSI, PMO", "output": "Plan contrats"},
    {"name": "Revue de capacité", "level": "run", "frequency": "mensuel",
     "description": "Charge vs capacité des équipes à 3/6 mois.", "participants": "PMO, Managers d'équipe", "output": "Console capacitaire"},
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    d = date(year, month, 1)
    offset = (weekday - d.weekday()) % 7
    return d + timedelta(days=offset + 7 * (n - 1))


def _dates_for_frequency(freq: str, year: int, anchor_month: int = 1) -> list:
    dates = []
    if freq == "hebdomadaire":
        d = date(year, 1, 1)
        d += timedelta(days=(0 - d.weekday()) % 7)
        while d.year == year:
            dates.append(d)
            d += timedelta(days=7)
    elif freq == "bimensuel":
        for m in range(1, 13):
            dates.append(_nth_weekday(year, m, 0, 1))
            dates.append(_nth_weekday(year, m, 0, 3))
    elif freq == "mensuel":
        dates = [_nth_weekday(year, m, 1, 1) for m in range(1, 13)]
    elif freq == "trimestriel":
        dates = [_nth_weekday(year, m, 1, 2) for m in (1, 4, 7, 10)]
    elif freq == "semestriel":
        dates = [_nth_weekday(year, m, 1, 2) for m in (1, 6)]
    elif freq == "annuel":
        dates = [_nth_weekday(year, anchor_month, 1, 2)]
    return dates


async def seed_defaults(tenant_id: str) -> dict:
    created = 0
    for t in DEFAULT_TYPES:
        existing = await db.event_types.find_one({"tenant_id": tenant_id, "name": t["name"]})
        if existing:
            continue
        await db.event_types.insert_one({
            "event_type_id": str(uuid.uuid4()), "tenant_id": tenant_id, "builtin": True,
            "anchor_month": t.get("anchor_month", 1), "linked_module": t.get("linked_module"),
            "created_at": _now(), **{k: t[k] for k in ("name", "level", "frequency", "description", "participants", "output")},
        })
        created += 1
    return {"created": created}


async def list_types(tenant_id: str) -> list:
    return await db.event_types.find({"tenant_id": tenant_id}, {"_id": 0}).sort([("level", 1), ("name", 1)]).to_list(None)


async def create_type(data: dict, tenant_id: str) -> dict:
    doc = {
        "event_type_id": str(uuid.uuid4()), "tenant_id": tenant_id, "builtin": False,
        "name": data["name"], "level": data.get("level", "portefeuille"),
        "frequency": data.get("frequency", "mensuel"), "anchor_month": data.get("anchor_month", 1),
        "description": data.get("description", ""), "participants": data.get("participants", ""),
        "output": data.get("output", ""), "linked_module": data.get("linked_module"), "created_at": _now(),
    }
    await db.event_types.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_type(type_id: str, data: dict, tenant_id: str) -> dict:
    updates = {k: v for k, v in data.items()
               if k in ("name", "level", "frequency", "anchor_month", "description", "participants", "output") and v is not None}
    await db.event_types.update_one({"event_type_id": type_id, "tenant_id": tenant_id}, {"$set": updates})
    return await db.event_types.find_one({"event_type_id": type_id, "tenant_id": tenant_id}, {"_id": 0})


async def delete_type(type_id: str, tenant_id: str) -> dict:
    await db.event_types.delete_one({"event_type_id": type_id, "tenant_id": tenant_id})
    await db.events.delete_many({"event_type_id": type_id, "tenant_id": tenant_id, "status": "planifie"})
    return {"deleted": True}


async def generate_plan(year: int, tenant_id: str) -> dict:
    types = await db.event_types.find({"tenant_id": tenant_id, "frequency": {"$ne": "ponctuel"}}, {"_id": 0}).to_list(None)
    created = 0
    for t in types:
        for d in _dates_for_frequency(t["frequency"], year, t.get("anchor_month", 1)):
            iso = d.isoformat()
            existing = await db.events.find_one(
                {"tenant_id": tenant_id, "event_type_id": t["event_type_id"], "date": iso})
            if existing:
                continue
            await db.events.insert_one({
                "event_id": str(uuid.uuid4()), "tenant_id": tenant_id,
                "event_type_id": t["event_type_id"], "title": t["name"],
                "level": t["level"], "date": iso, "status": "planifie",
                "notes": "", "created_at": _now(),
            })
            created += 1
    return {"created": created, "year": year}


async def list_events(tenant_id: str, year: int = None, month: int = None, level: str = None,
                      upcoming: bool = False) -> list:
    q: dict = {"tenant_id": tenant_id}
    if upcoming:
        q["date"] = {"$gte": date.today().isoformat()}
        q["status"] = "planifie"
    elif year and month:
        q["date"] = {"$gte": f"{year}-{month:02d}-01", "$lte": f"{year}-{month:02d}-31"}
    elif year:
        q["date"] = {"$gte": f"{year}-01-01", "$lte": f"{year}-12-31"}
    if level:
        q["level"] = level
    cur = db.events.find(q, {"_id": 0}).sort("date", 1)
    return await (cur.limit(15).to_list(None) if upcoming else cur.to_list(None))


async def create_event(data: dict, tenant_id: str) -> dict:
    doc = {
        "event_id": str(uuid.uuid4()), "tenant_id": tenant_id,
        "event_type_id": data.get("event_type_id"), "title": data["title"],
        "level": data.get("level", "portefeuille"), "date": data["date"],
        "status": "planifie", "notes": data.get("notes", ""),
        "project_id": data.get("project_id"), "governance_id": data.get("governance_id"),
        "created_at": _now(),
    }
    await db.events.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_event(event_id: str, data: dict, tenant_id: str) -> dict:
    updates = {k: v for k, v in data.items() if k in ("title", "date", "status", "notes", "level") and v is not None}
    await db.events.update_one({"event_id": event_id, "tenant_id": tenant_id}, {"$set": updates})
    return await db.events.find_one({"event_id": event_id, "tenant_id": tenant_id}, {"_id": 0})


async def delete_event(event_id: str, tenant_id: str) -> dict:
    await db.events.delete_one({"event_id": event_id, "tenant_id": tenant_id})
    return {"deleted": True}
