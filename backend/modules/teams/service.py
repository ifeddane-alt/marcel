from fastapi import HTTPException
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
import uuid
from core.database import db
from core.auth import TokenPayload, require_write, require_admin
from .schemas import TeamCreate, TeamUpdate


async def list_teams(current_user: TokenPayload) -> list:
    teams = await db.teams.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
    # Enrichir avec le nom du manager
    resource_ids = [t["manager_resource_id"] for t in teams if t.get("manager_resource_id")]
    if resource_ids:
        resources = await db.resources.find(
            {"resource_id": {"$in": resource_ids}}, {"_id": 0, "resource_id": 1, "name": 1}
        ).to_list(None)
        res_map = {r["resource_id"]: r["name"] for r in resources}
        for t in teams:
            t["manager_name"] = res_map.get(t.get("manager_resource_id", ""), None)
    else:
        for t in teams:
            t["manager_name"] = None
    return teams


async def get_capacity_heatmap(months: int, current_user: TokenPayload) -> list:
    """S1-09 — Heatmap capacité × période par équipe."""
    today = date.today()
    # Plage : mois précédent → months-1 mois futurs
    start_month = (today.replace(day=1) - relativedelta(months=1))
    periods = [
        (start_month + relativedelta(months=i)).strftime("%Y-%m-%d")
        for i in range(months + 1)
    ]

    # Équipes du tenant
    teams = await db.teams.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "team_id": 1, "name": 1}
    ).to_list(None)
    # Ressource sans équipe = équipe virtuelle
    teams_list = list(teams)

    # Ressources du tenant
    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0, "resource_id": 1, "team_id": 1, "capacity_jh_month": 1, "availability_rate": 1},
    ).to_list(None)
    res_by_id = {r["resource_id"]: r for r in resources}

    # Capacité effective par équipe
    team_capacity: dict = {}  # team_id → capacity_jh_effective
    for r in resources:
        tid = r.get("team_id") or "__unassigned__"
        capa_month = r.get("capacity_jh_month", 0) or 0
        avail = (r.get("availability_rate") or 100) / 100
        effective = capa_month * avail
        team_capacity[tid] = team_capacity.get(tid, 0) + effective

    # Allocations du tenant dans la plage (via project_ids du tenant)
    tenant_projects = await db.projects.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "project_id": 1}
    ).to_list(None)
    tenant_project_ids = [p["project_id"] for p in tenant_projects]

    allocations = await db.allocations.find(
        {"project_id": {"$in": tenant_project_ids},
         "period_month": {"$gte": periods[0], "$lte": periods[-1]}},
        {"_id": 0, "resource_id": 1, "period_month": 1, "jh_allocated": 1},
    ).to_list(None)

    # Allocations par (team_id, period_month)
    alloc_matrix: dict = {}  # (team_id, period) → jh_allocated
    for a in allocations:
        res = res_by_id.get(a.get("resource_id", ""), {})
        tid = res.get("team_id") or "__unassigned__"
        period = a.get("period_month", "")[:7]  # YYYY-MM
        key = (tid, period)
        alloc_matrix[key] = alloc_matrix.get(key, 0) + (a.get("jh_allocated") or 0)

    # Construire la matrice de résultat
    result = []
    display_teams = list(teams_list)
    # Ajouter équipe virtuelle si des ressources non affectées ont des allocs
    unassigned_resources = [r for r in resources if not r.get("team_id")]
    if unassigned_resources:
        display_teams.append({"team_id": "__unassigned__", "name": "Non affectées"})

    period_labels = [
        (start_month + relativedelta(months=i)).strftime("%Y-%m")
        for i in range(months + 1)
    ]

    for team in display_teams:
        tid = team["team_id"]
        capa = team_capacity.get(tid, 0)
        row = {
            "team_id": tid if tid != "__unassigned__" else None,
            "team_name": team["name"],
            "capacity_jh_month": round(capa, 1),
            "periods": [],
        }
        for period in period_labels:
            allocated = alloc_matrix.get((tid, period), 0)
            utilization_pct = round((allocated / capa * 100), 1) if capa > 0 else 0
            row["periods"].append({
                "period": period,
                "capacity_jh": round(capa, 1),
                "allocated_jh": round(allocated, 1),
                "utilization_pct": utilization_pct,
            })
        result.append(row)

    return result


async def get_capacity_alerts(current_user: TokenPayload) -> list:
    """Alertes capacité : équipes > 70% d'utilisation sur mois courant + mois suivant."""
    today = date.today()
    current_m = today.replace(day=1)
    months_to_check = [
        current_m.strftime("%Y-%m-%d"),
        (current_m + relativedelta(months=1)).strftime("%Y-%m-%d"),
    ]

    # Équipes et ressources
    teams = await db.teams.find({"tenant_id": current_user.tenant_id}, {"_id": 0}).to_list(None)
    resources = await db.resources.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0, "resource_id": 1, "name": 1, "role": 1, "team_id": 1,
         "capacity_jh_month": 1, "availability_rate": 1},
    ).to_list(None)
    res_by_id = {r["resource_id"]: r for r in resources}
    team_map = {t["team_id"]: t["name"] for t in teams}

    # Capacité effective par équipe (JH/mois)
    team_capacity: dict = {}
    for r in resources:
        tid = r.get("team_id") or "__unassigned__"
        capa = (r.get("capacity_jh_month") or 0) * ((r.get("availability_rate") or 100) / 100)
        team_capacity[tid] = team_capacity.get(tid, 0) + capa

    # Allocations via project_ids du tenant
    tenant_projects = await db.projects.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "project_id": 1}
    ).to_list(None)
    tenant_project_ids = [p["project_id"] for p in tenant_projects]

    allocations = await db.allocations.find(
        {"project_id": {"$in": tenant_project_ids},
         "period_month": {"$in": months_to_check}},
        {"_id": 0, "resource_id": 1, "period_month": 1, "jh_allocated": 1},
    ).to_list(None)

    # Agréger par (team_id, period)
    agg: dict = {}  # (tid, period) → {total_jh, resources: {rid: jh}}
    for a in allocations:
        rid = a.get("resource_id", "")
        period = a.get("period_month", "")[:7]
        jh = a.get("jh_allocated") or 0
        res = res_by_id.get(rid, {})
        tid = res.get("team_id") or "__unassigned__"
        key = (tid, period)
        if key not in agg:
            agg[key] = {"total_jh": 0, "resources": {}}
        agg[key]["total_jh"] += jh
        agg[key]["resources"][rid] = agg[key]["resources"].get(rid, 0) + jh

    # Construire les alertes
    alerts = []
    for (tid, period), data in agg.items():
        capa = team_capacity.get(tid, 0)
        if capa == 0:
            continue
        utilization_pct = round(data["total_jh"] / capa * 100, 1)
        if utilization_pct < 70:
            continue
        level = "critique" if utilization_pct > 100 else ("rouge" if utilization_pct > 85 else "orange")
        # Ressources surchargées dans cette équipe
        overloaded = []
        for rid, jh in data["resources"].items():
            res = res_by_id.get(rid, {})
            res_capa = (res.get("capacity_jh_month") or 0) * ((res.get("availability_rate") or 100) / 100)
            if res_capa > 0:
                res_util = round(jh / res_capa * 100, 1)
                if res_util >= 70:
                    overloaded.append({
                        "resource_id": rid,
                        "name": res.get("name", rid),
                        "role": res.get("role", ""),
                        "jh_allocated": round(jh, 1),
                        "capacity_jh": round(res_capa, 1),
                        "utilization_pct": res_util,
                    })

        alerts.append({
            "team_id": tid if tid != "__unassigned__" else None,
            "team_name": team_map.get(tid, "Non affectées"),
            "period": period,
            "capacity_jh": round(capa, 1),
            "allocated_jh": round(data["total_jh"], 1),
            "utilization_pct": utilization_pct,
            "level": level,
            "overloaded_resources": sorted(overloaded, key=lambda x: -x["utilization_pct"]),
        })

    level_order = {"critique": 0, "rouge": 1, "orange": 2}
    alerts.sort(key=lambda x: (level_order.get(x["level"], 3), -x["utilization_pct"]))
    return alerts
    require_write(current_user)
    doc = {
        "team_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        **data.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.teams.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_team(team_id: str, data: TeamUpdate, current_user: TokenPayload) -> dict:
    require_write(current_user)
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=422, detail="Aucune donnée à mettre à jour")
    result = await db.teams.update_one(
        {"team_id": team_id, "tenant_id": current_user.tenant_id},
        {"$set": update_data},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Équipe introuvable")
    updated = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    return updated


async def delete_team(team_id: str, current_user: TokenPayload) -> None:
    require_admin(current_user)
    result = await db.teams.delete_one(
        {"team_id": team_id, "tenant_id": current_user.tenant_id}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Équipe introuvable")
