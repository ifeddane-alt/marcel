"""Recherche globale — projets, jalons, risques, décisions (groupés par type)."""
import re

from fastapi import APIRouter, Depends
from core.database import db
from core.auth import TokenPayload, get_current_user, is_ownership_restricted

router = APIRouter(tags=["search"])

LIMIT_PER_TYPE = 5


@router.get("/search/global")
async def global_search(q: str = "", current_user: TokenPayload = Depends(get_current_user)):
    q = (q or "").strip()
    empty = {"projects": [], "milestones": [], "risks": [], "decisions": []}
    if len(q) < 2:
        return empty
    rx = {"$regex": re.escape(q), "$options": "i"}

    pq: dict = {"tenant_id": current_user.tenant_id}
    if is_ownership_restricted(current_user, "projects.view_own"):
        pq["owner_id"] = current_user.user_id
    allowed = await db.projects.find(
        pq, {"_id": 0, "project_id": 1, "name": 1, "code": 1, "status_rag": 1}
    ).to_list(None)
    pmap = {p["project_id"]: p for p in allowed}
    pids = list(pmap.keys())

    ql = q.lower()

    def _score(p):
        code = (p.get("code") or "").lower()
        name = (p.get("name") or "").lower()
        if code == ql:
            return 100
        if code.startswith(ql):
            return 80
        if code.find(ql) >= 0:
            return 60
        if name.startswith(ql):
            return 40
        if name.find(ql) >= 0:
            return 20
        return -1

    proj_hits = sorted(
        [(p, _score(p)) for p in allowed if _score(p) >= 0],
        key=lambda x: -x[1],
    )[:LIMIT_PER_TYPE]

    def _proj_fields(pid):
        p = pmap.get(pid, {})
        return {
            "project_id": pid,
            "project_name": p.get("name", "—"),
            "project_code": p.get("code") or "",
        }

    ms = await db.milestones.find(
        {"project_id": {"$in": pids}, "name": rx}, {"_id": 0}
    ).to_list(LIMIT_PER_TYPE)
    risks = await db.risks.find(
        {"tenant_id": current_user.tenant_id, "project_id": {"$in": pids}, "title": rx},
        {"_id": 0},
    ).sort("criticality", -1).to_list(LIMIT_PER_TYPE)
    decisions = await db.decisions.find(
        {"tenant_id": current_user.tenant_id, "project_id": {"$in": pids}, "title": rx},
        {"_id": 0},
    ).to_list(LIMIT_PER_TYPE)

    return {
        "projects": [
            {
                "project_id": p["project_id"],
                "name": p.get("name"),
                "code": p.get("code") or "",
                "status_rag": p.get("status_rag"),
            }
            for p, _ in proj_hits
        ],
        "milestones": [
            {
                "milestone_id": m["milestone_id"],
                "name": m.get("name"),
                "date": (m.get("date_forecast") or m.get("date_baseline") or "")[:10],
                "status": m.get("status"),
                **_proj_fields(m.get("project_id")),
            }
            for m in ms
        ],
        "risks": [
            {
                "risk_id": r.get("risk_id"),
                "title": r.get("title"),
                "criticality": r.get("criticality", 0),
                "status": r.get("status"),
                **_proj_fields(r.get("project_id")),
            }
            for r in risks
        ],
        "decisions": [
            {
                "decision_id": d.get("decision_id"),
                "title": d.get("title"),
                "status": d.get("status"),
                **_proj_fields(d.get("project_id")),
            }
            for d in decisions
        ],
    }
