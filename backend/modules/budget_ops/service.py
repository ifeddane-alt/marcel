"""Transferts budgétaires + enveloppes stratégiques (programme / thème)."""
import uuid
from datetime import datetime, timezone

from core.database import db
from core.audit import log_audit


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Transferts ────────────────────────────────────────────────────────────────

async def create_transfer(data: dict, user) -> dict:
    amount = float(data.get("amount") or 0)
    from_id, to_id = data.get("from_project_id"), data.get("to_project_id")
    if amount <= 0:
        return {"error": "Montant invalide"}
    if not from_id or not to_id or from_id == to_id:
        return {"error": "Projets source et cible invalides"}
    src = await db.projects.find_one({"project_id": from_id, "tenant_id": user.tenant_id},
                                     {"_id": 0, "name": 1, "budget_total": 1})
    dst = await db.projects.find_one({"project_id": to_id, "tenant_id": user.tenant_id},
                                     {"_id": 0, "name": 1})
    if not src or not dst:
        return {"error": "Projet introuvable"}
    if (src.get("budget_total") or 0) < amount:
        return {"error": f"Budget insuffisant sur {src.get('name')} ({src.get('budget_total') or 0:,.0f} €)"}
    await db.projects.update_one({"project_id": from_id, "tenant_id": user.tenant_id},
                                 {"$inc": {"budget_total": -amount}})
    await db.projects.update_one({"project_id": to_id, "tenant_id": user.tenant_id},
                                 {"$inc": {"budget_total": amount}})
    doc = {
        "transfer_id": str(uuid.uuid4()), "tenant_id": user.tenant_id,
        "from_project_id": from_id, "from_project_name": src.get("name"),
        "to_project_id": to_id, "to_project_name": dst.get("name"),
        "amount": amount, "reason": data.get("reason", ""),
        "created_by": user.email, "created_at": _now(),
    }
    await db.budget_transfers.insert_one(doc)
    doc.pop("_id", None)
    await log_audit(user, "budget_transfer", "project", from_id, src.get("name", ""),
                    [{"field": "transfert", "new": f"-{amount:,.0f} € vers {dst.get('name')}"}])
    return doc


async def list_transfers(tenant_id: str) -> list:
    return await db.budget_transfers.find({"tenant_id": tenant_id}, {"_id": 0}).sort("created_at", -1).to_list(100)


# ─── Thèmes stratégiques ───────────────────────────────────────────────────────

async def list_themes(tenant_id: str) -> list:
    return await db.strategic_themes.find({"tenant_id": tenant_id}, {"_id": 0}).sort("name", 1).to_list(None)


async def create_theme(data: dict, tenant_id: str) -> dict:
    doc = {"theme_id": str(uuid.uuid4()), "tenant_id": tenant_id,
           "name": data["name"], "color": data.get("color", "#2e5fe8"), "created_at": _now()}
    await db.strategic_themes.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def delete_theme(theme_id: str, tenant_id: str) -> dict:
    await db.strategic_themes.delete_one({"theme_id": theme_id, "tenant_id": tenant_id})
    await db.strategic_envelopes.delete_many({"tenant_id": tenant_id, "axis": "theme", "ref_id": theme_id})
    return {"deleted": True}


# ─── Enveloppes stratégiques ───────────────────────────────────────────────────

async def list_envelopes(tenant_id: str, year: int) -> dict:
    envelopes = await db.strategic_envelopes.find(
        {"tenant_id": tenant_id, "year": year}, {"_id": 0}).to_list(None)
    programs = await db.programs.find({"tenant_id": tenant_id}, {"_id": 0, "program_id": 1, "name": 1}).to_list(None)
    themes = await list_themes(tenant_id)
    pnames = {p["program_id"]: p["name"] for p in programs}
    tnames = {t["theme_id"]: t["name"] for t in themes}
    tcolors = {t["theme_id"]: t.get("color") for t in themes}

    projects = await db.projects.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "program_id": 1, "strategic_theme_id": 1, "budget_total": 1, "budget_consumed": 1}).to_list(None)
    by_program: dict = {}
    by_theme: dict = {}
    for p in projects:
        if p.get("program_id"):
            b = by_program.setdefault(p["program_id"], {"budget": 0, "consumed": 0})
            b["budget"] += p.get("budget_total") or 0
            b["consumed"] += p.get("budget_consumed") or 0
        if p.get("strategic_theme_id"):
            b = by_theme.setdefault(p["strategic_theme_id"], {"budget": 0, "consumed": 0})
            b["budget"] += p.get("budget_total") or 0
            b["consumed"] += p.get("budget_consumed") or 0

    out = []
    for e in envelopes:
        src = by_program if e["axis"] == "programme" else by_theme
        cons = src.get(e["ref_id"], {"budget": 0, "consumed": 0})
        out.append({
            **e,
            "ref_name": (pnames if e["axis"] == "programme" else tnames).get(e["ref_id"], "?"),
            "color": tcolors.get(e["ref_id"]) if e["axis"] == "theme" else None,
            "engaged": round(cons["budget"]), "consumed": round(cons["consumed"]),
            "rate": round(cons["budget"] / e["amount"] * 100) if e.get("amount") else 0,
        })
    return {"year": year, "envelopes": out, "programs": programs, "themes": themes}


async def upsert_envelope(data: dict, tenant_id: str) -> dict:
    q = {"tenant_id": tenant_id, "year": int(data["year"]), "axis": data["axis"], "ref_id": data["ref_id"]}
    await db.strategic_envelopes.update_one(
        q, {"$set": {"amount": float(data["amount"]), "updated_at": _now()},
            "$setOnInsert": {"envelope_id": str(uuid.uuid4()), **q, "created_at": _now()}},
        upsert=True)
    return await db.strategic_envelopes.find_one(q, {"_id": 0})


async def delete_envelope(envelope_id: str, tenant_id: str) -> dict:
    await db.strategic_envelopes.delete_one({"envelope_id": envelope_id, "tenant_id": tenant_id})
    return {"deleted": True}
