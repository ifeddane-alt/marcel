"""Catalogue d'indicateurs PPM — référentiel, sélections par contexte, calcul."""
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException
from core.database import db
from core.auth import TokenPayload, require_write, has_perm, require_perm

from . import computations

XLSX_PATH = Path(__file__).resolve().parents[2] / "data_catalogue.xlsx"

EXTERNAL_RX = re.compile(
    r"ERP|SIRH|SI Finance|compta|immobilisation|télémétrie|enquêt|Jira|Git|CI/CD|Sonar|"
    r"MS Project|P6|outil qualité|Scaled Agile|assessment|feuille de présence|monitoring|ITSM",
    re.IGNORECASE,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _scopes_for_level(level: str) -> list:
    lv = (level or "").lower()
    scopes = []
    if any(k in lv for k in ("projet", "équipe", "produit")):
        scopes.append("project")
    if "programme" in lv:
        scopes.append("program")
    if "portefeuille" in lv or "art" in lv:
        scopes += ["portfolio", "dashboard"]
    return scopes


async def seed_catalog() -> int:
    import openpyxl
    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb["Catalogue"]
    count = 0
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r[0]:
            continue
        ind_id = str(r[0]).strip()
        if ind_id in computations.AUTO_IDS:
            computability = "auto"
        elif EXTERNAL_RX.search(str(r[8] or "")):
            computability = "external"
        else:
            computability = "manual"
        doc = {
            "indicator_id": ind_id,
            "domain": r[1], "subdomain": r[2], "name": r[3],
            "method": r[4], "level": r[5],
            "scopes": _scopes_for_level(r[5]),
            "definition": r[6], "formula": r[7], "sources": r[8],
            "frequency": r[9], "reading": r[10], "pitfall": r[11],
            "priority": r[12],
            "computability": computability,
        }
        await db.indicator_catalog.update_one(
            {"indicator_id": ind_id}, {"$set": doc}, upsert=True)
        count += 1
    return count


async def _ensure_seeded():
    if await db.indicator_catalog.count_documents({}) == 0:
        await seed_catalog()


async def list_catalog(scope: str | None, user: TokenPayload) -> list:
    await _ensure_seeded()
    q = {}
    if scope:
        q["scopes"] = scope
    return await db.indicator_catalog.find(q, {"_id": 0}).sort("indicator_id", 1).to_list(None)


def _sel_query(user: TokenPayload, scope: str) -> dict:
    q = {"tenant_id": user.tenant_id, "scope": scope}
    q["user_id"] = user.user_id if scope == "dashboard" else None
    return q


async def get_selection(scope: str, user: TokenPayload) -> dict:
    await _ensure_seeded()
    sel = await db.indicator_selections.find_one(_sel_query(user, scope), {"_id": 0})
    return sel or {**_sel_query(user, scope), "indicator_ids": []}


async def set_selection(scope: str, indicator_ids: list, user: TokenPayload) -> dict:
    if scope != "dashboard":
        require_perm(user, "indicators.manage")
    valid = await db.indicator_catalog.distinct("indicator_id", {"scopes": scope})
    ids = [i for i in (indicator_ids or []) if i in valid]
    await db.indicator_selections.update_one(
        _sel_query(user, scope),
        {"$set": {"indicator_ids": ids, "updated_at": _now()}}, upsert=True)
    return await get_selection(scope, user)


async def preset_p1(scope: str, user: TokenPayload) -> dict:
    await _ensure_seeded()
    ids = await db.indicator_catalog.distinct(
        "indicator_id", {"scopes": scope, "priority": "P1", "computability": "auto"})
    return await set_selection(scope, ids, user)


def _fmt_val(v: float, unit: str) -> str:
    s = f"{v:,.1f}".rstrip("0").rstrip(".").replace(",", " ")
    return f"{s} {unit}".strip() if unit else s


def _manual_rag(v: float, direction: str, green, orange):
    if green is None or orange is None:
        return None
    if direction == "lower":
        return "green" if v <= green else ("orange" if v <= orange else "red")
    return "green" if v >= green else ("orange" if v >= orange else "red")


async def set_manual_value(scope: str, indicator_id: str, data: dict, user: TokenPayload) -> dict:
    if scope not in ("project", "program", "portfolio", "dashboard"):
        raise HTTPException(400, "Scope invalide")
    if scope != "dashboard" and not has_perm(user, "projects.edit"):
        raise HTTPException(403, "Permission projects.edit requise pour la saisie sur ce périmètre")
    cat = await db.indicator_catalog.find_one({"indicator_id": indicator_id}, {"_id": 0, "indicator_id": 1})
    if not cat:
        raise HTTPException(404, "Indicateur introuvable")
    context_id = data.get("context_id") or None
    q = {"tenant_id": user.tenant_id, "scope": scope, "context_id": context_id, "indicator_id": indicator_id}
    if data.get("value") is None:
        await db.indicator_manual_values.delete_one(q)
        return {"deleted": True}
    try:
        value = float(data["value"])
        green = float(data["green"]) if data.get("green") is not None else None
        orange = float(data["orange"]) if data.get("orange") is not None else None
    except (TypeError, ValueError):
        raise HTTPException(400, "Valeur ou seuils non numériques")
    doc = {**q, "value": value, "unit": str(data.get("unit") or "").strip()[:20],
           "direction": data.get("direction") if data.get("direction") in ("higher", "lower") else "higher",
           "green": green, "orange": orange,
           "updated_by": user.name, "updated_at": _now()}
    await db.indicator_manual_values.update_one(q, {"$set": doc}, upsert=True)
    return doc


async def compute_values(scope: str, context_id: str | None, user: TokenPayload) -> dict:
    if scope not in ("project", "program", "portfolio", "dashboard"):
        raise HTTPException(400, "Scope invalide")
    if scope in ("project", "program") and not context_id:
        raise HTTPException(400, "context_id requis pour ce scope")
    sel = await get_selection(scope, user)
    ids = sel["indicator_ids"]
    cats = await db.indicator_catalog.find(
        {"indicator_id": {"$in": ids}}, {"_id": 0}).to_list(None)
    cat_map = {c["indicator_id"]: c for c in cats}
    manual_docs = await db.indicator_manual_values.find(
        {"tenant_id": user.tenant_id, "scope": scope, "context_id": context_id or None,
         "indicator_id": {"$in": ids}}, {"_id": 0}).to_list(None)
    manual_map = {m["indicator_id"]: m for m in manual_docs}
    ctx = await computations.load_context(scope, context_id, user)
    items = []
    for ind_id in ids:
        cat = cat_map.get(ind_id)
        if not cat:
            continue
        item = {**{k: cat.get(k) for k in (
            "indicator_id", "domain", "subdomain", "name", "priority", "method",
            "definition", "formula", "reading", "pitfall", "computability")}}
        fn = computations.REGISTRY.get(scope, {}).get(ind_id)
        item["editable"] = fn is None
        if fn:
            try:
                item.update(fn(ctx))
                item["status"] = "computed"
            except Exception:
                item.update({"display": "—", "status": "error"})
        else:
            mv = manual_map.get(ind_id)
            if mv:
                item.update({
                    "display": _fmt_val(mv["value"], mv.get("unit") or ""),
                    "status": "manual",
                    "rag": _manual_rag(mv["value"], mv.get("direction", "higher"), mv.get("green"), mv.get("orange")),
                    "detail": f"Saisi le {str(mv.get('updated_at'))[:10]} par {mv.get('updated_by') or '—'}",
                    "manual": {k: mv.get(k) for k in ("value", "unit", "direction", "green", "orange")},
                })
            else:
                item.update({"display": "—", "status": cat.get("computability", "manual")})
        items.append(item)
    return {"scope": scope, "context_id": context_id, "items": items}
