"""Power BI Connector — Service layer.

Retourne des tableaux plats (list of dicts) compatibles Power BI Desktop
Web Connector (JSON Array of Objects, pas de nested).
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional

from core.auth import TokenPayload
from core.database import db


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _safe(v, default=None):
    """Retourne la valeur ou default si None/vide."""
    return v if v is not None else default


def _date(v) -> Optional[str]:
    """Convertit datetime ou str ISO en date YYYY-MM-DD."""
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, str):
        return v[:10]
    return str(v)


def _days_remaining(date_str: Optional[str]) -> Optional[int]:
    if not date_str:
        return None
    try:
        d = datetime.fromisoformat(str(date_str)[:10])
        return (d.date() - datetime.now(timezone.utc).date()).days
    except Exception:
        return None


# ─── Vérification API Key ─────────────────────────────────────────────────────

async def verify_api_key(api_key: str) -> Optional[str]:
    """Retourne le tenant_id si la clé est valide, sinon None."""
    cfg = await db["tenant_config"].find_one(
        {"powerbi_api_key": api_key},
        {"_id": 0, "tenant_id": 1},
    )
    return cfg["tenant_id"] if cfg else None


# ─── Gestion clé API ─────────────────────────────────────────────────────────

async def get_api_key(user: TokenPayload) -> dict:
    cfg = await db["tenant_config"].find_one(
        {"tenant_id": user.tenant_id},
        {"_id": 0, "powerbi_api_key": 1},
    )
    key = cfg.get("powerbi_api_key") if cfg else None
    masked = f"pbi-...{key[-6:]}" if key else None
    return {"has_key": bool(key), "masked_key": masked}


async def generate_api_key(user: TokenPayload) -> dict:
    key = "pbi-" + secrets.token_urlsafe(32)
    await db["tenant_config"].update_one(
        {"tenant_id": user.tenant_id},
        {"$set": {"powerbi_api_key": key}},
        upsert=True,
    )
    return {"api_key": key}


async def revoke_api_key(user: TokenPayload) -> dict:
    await db["tenant_config"].update_one(
        {"tenant_id": user.tenant_id},
        {"$unset": {"powerbi_api_key": ""}},
    )
    return {"revoked": True}


# ─── Endpoints données ────────────────────────────────────────────────────────

async def get_projects(tenant_id: str) -> list[dict]:
    cursor = db["projects"].find(
        {"tenant_id": tenant_id},
        {"_id": 0},
    )
    rows = []
    async for p in cursor:
        prog = await db["programs"].find_one(
            {"program_id": p.get("program_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if p.get("program_id") else None
        rows.append({
            "id":             p.get("project_id", ""),
            "name":           _safe(p.get("name"), ""),
            "program":        prog["name"] if prog else _safe(p.get("program_id"), ""),
            "methodology":    _safe(p.get("methodology"), ""),
            "status":         _safe(p.get("status"), ""),
            "rag":            _safe(p.get("status_rag"), ""),
            "capex_budget":   _safe(p.get("capex_planned"), 0),
            "opex_budget":    _safe(p.get("opex_planned"), 0),
            "capex_consumed": _safe(p.get("capex_consumed"), 0),
            "opex_consumed":  _safe(p.get("opex_consumed"), 0),
            "eac":            _safe(p.get("eac"), 0),
            "raf":            _safe(p.get("raf"), 0),
            "start_date":     _date(p.get("start_date")),
            "end_date":       _date(p.get("end_date")),
            "owner":          _safe(p.get("owner"), ""),
        })
    return rows


async def get_resources(tenant_id: str) -> list[dict]:
    cursor = db["resources"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for r in cursor:
        rows.append({
            "id":                r.get("resource_id", ""),
            "name":              _safe(r.get("name"), ""),
            "role":              _safe(r.get("role"), ""),
            "team":              _safe(r.get("team"), ""),
            "type":              _safe(r.get("type"), ""),
            "vendor":            _safe(r.get("vendor"), ""),
            "tjm":               _safe(r.get("tjm"), 0),
            "availability_rate": _safe(r.get("availability_rate"), 1.0),
            "capacity_jh":       _safe(r.get("capacity_jh"), 0),
        })
    return rows


async def get_timesheets(tenant_id: str) -> list[dict]:
    cursor = db["timesheets"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for ts in cursor:
        resource_name = ts.get("resource_name") or ""
        if not resource_name and ts.get("resource_id"):
            res = await db["resources"].find_one(
                {"resource_id": ts["resource_id"], "tenant_id": tenant_id},
                {"_id": 0, "name": 1},
            )
            resource_name = res["name"] if res else ts["resource_id"]

        project_name = ts.get("project_name") or ""
        if not project_name and ts.get("project_id"):
            proj = await db["projects"].find_one(
                {"project_id": ts["project_id"], "tenant_id": tenant_id},
                {"_id": 0, "name": 1},
            )
            project_name = proj["name"] if proj else ts["project_id"]

        for entry in (ts.get("entries") or []):
            rows.append({
                "resource_name": resource_name,
                "project_name":  project_name,
                "date":          _date(entry.get("date")),
                "jh":            _safe(entry.get("jh"), 0),
                "status":        _safe(ts.get("status"), ""),
            })
    return rows


async def get_budget(tenant_id: str) -> list[dict]:
    cursor = db["projects"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for p in cursor:
        prog = await db["programs"].find_one(
            {"program_id": p.get("program_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if p.get("program_id") else None

        capex_prev = _safe(p.get("capex_planned"), 0)
        opex_prev  = _safe(p.get("opex_planned"), 0)
        eac        = _safe(p.get("eac"), 0)
        total_prev = capex_prev + opex_prev
        ecart_pct  = round(((eac - total_prev) / total_prev * 100), 2) if total_prev else 0

        rows.append({
            "project_name": _safe(p.get("name"), ""),
            "program":      prog["name"] if prog else "",
            "capex_prev":   capex_prev,
            "capex_cons":   _safe(p.get("capex_consumed"), 0),
            "opex_prev":    opex_prev,
            "opex_cons":    _safe(p.get("opex_consumed"), 0),
            "eac":          eac,
            "raf":          _safe(p.get("raf"), 0),
            "ecart_pct":    ecart_pct,
        })
    return rows


async def get_risks(tenant_id: str) -> list[dict]:
    cursor = db["risks"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for r in cursor:
        proj = await db["projects"].find_one(
            {"project_id": r.get("project_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if r.get("project_id") else None
        rows.append({
            "project_name": proj["name"] if proj else _safe(r.get("project_id"), ""),
            "name":         _safe(r.get("name"), ""),
            "probability":  _safe(r.get("probability"), 0),
            "impact":       _safe(r.get("impact"), 0),
            "criticality":  _safe(r.get("criticality"), 0),
            "category":     _safe(r.get("category"), ""),
            "status":       _safe(r.get("status"), ""),
        })
    return rows


async def get_milestones(tenant_id: str) -> list[dict]:
    cursor = db["milestones"].find({"tenant_id": tenant_id}, {"_id": 0})
    rows = []
    async for m in cursor:
        proj = await db["projects"].find_one(
            {"project_id": m.get("project_id"), "tenant_id": tenant_id},
            {"_id": 0, "name": 1},
        ) if m.get("project_id") else None
        date_str = _date(m.get("date"))
        rows.append({
            "project_name":    proj["name"] if proj else _safe(m.get("project_id"), ""),
            "name":            _safe(m.get("name"), ""),
            "family":          _safe(m.get("family"), ""),
            "type":            _safe(m.get("type"), ""),
            "date":            date_str,
            "days_remaining":  _days_remaining(date_str),
            "attribute":       _safe(m.get("attribute"), ""),
            "status":          _safe(m.get("status"), ""),
        })
    return rows
