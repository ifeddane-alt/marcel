"""Console de pilotage capacitaire 3/6 mois."""
from datetime import date

from core.database import db


def _months_from_now(n: int) -> list:
    today = date.today().replace(day=1)
    months = []
    y, m = today.year, today.month
    for _ in range(n):
        months.append(f"{y}-{m:02d}-01")
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return months


async def console(tenant_id: str, horizon: int = 3, axis: str = "team") -> dict:
    months = _months_from_now(horizon)
    resources = await db.resources.find(
        {"tenant_id": tenant_id},
        {"_id": 0, "resource_id": 1, "name": 1, "team_id": 1,
         "capacity_jh_month": 1, "availability_rate": 1, "skills": 1}).to_list(None)
    teams = await db.teams.find({"tenant_id": tenant_id}, {"_id": 0, "team_id": 1, "name": 1}).to_list(None)
    team_names = {t["team_id"]: t["name"] for t in teams}
    rids = [r["resource_id"] for r in resources]
    allocs = await db.allocations.find(
        {"resource_id": {"$in": rids}, "period_month": {"$in": months}},
        {"_id": 0, "resource_id": 1, "period_month": 1, "jh_allocated": 1}).to_list(None)

    load: dict = {}
    for a in allocs:
        key = (a["resource_id"], a["period_month"])
        load[key] = load.get(key, 0) + (a.get("jh_allocated") or 0)

    def res_capacity(r) -> float:
        return (r.get("capacity_jh_month") or 20) * ((r.get("availability_rate") or 100) / 100)

    groups: dict = {}
    for r in resources:
        if axis == "team":
            keys = [(r.get("team_id") or "_none", team_names.get(r.get("team_id"), "Sans équipe"))]
        elif axis == "resource":
            keys = [(r["resource_id"], r.get("name", ""))]
        else:
            skills = [s.get("name") for s in (r.get("skills") or []) if s.get("name")]
            keys = [(s, s) for s in skills] or [("_none", "Sans compétence")]
        for key, label in keys:
            g = groups.setdefault(key, {"key": key, "label": label, "resources": 0,
                                        "months": {m: {"capacity": 0.0, "load": 0.0} for m in months}})
            g["resources"] += 1
            for m in months:
                g["months"][m]["capacity"] += res_capacity(r)
                g["months"][m]["load"] += load.get((r["resource_id"], m), 0)

    rows = []
    for g in groups.values():
        cells = []
        tot_cap = tot_load = 0.0
        for m in months:
            c = g["months"][m]
            rate = round(c["load"] / c["capacity"] * 100) if c["capacity"] else 0
            cells.append({"month": m, "capacity": round(c["capacity"], 1),
                          "load": round(c["load"], 1), "rate": rate})
            tot_cap += c["capacity"]
            tot_load += c["load"]
        rows.append({
            "key": g["key"], "label": g["label"], "resources": g["resources"], "cells": cells,
            "total_capacity": round(tot_cap, 1), "total_load": round(tot_load, 1),
            "rate": round(tot_load / tot_cap * 100) if tot_cap else 0,
        })
    rows.sort(key=lambda r: -r["rate"])
    totals = {
        "capacity": round(sum(r["total_capacity"] for r in rows), 1) if axis != "skill" else None,
        "load": round(sum(r["total_load"] for r in rows), 1) if axis != "skill" else None,
    }
    return {"horizon": horizon, "axis": axis, "months": months, "rows": rows, "totals": totals}
