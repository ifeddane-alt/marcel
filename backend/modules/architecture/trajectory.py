"""Trajectoire du SI (TIME) — dispositions applicatives + jalons."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from core.auth import TokenPayload, permission_required
from core.database import db

router = APIRouter(tags=["architecture-trajectory"])

DISPOSITIONS = ["conserver", "moderniser", "remplacer", "decommissionner"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.get("/architecture/trajectory")
async def get_trajectory(current_user: TokenPayload = Depends(permission_required("portfolio.view"))):
    apps = await db.applications.find(
        {"tenant_id": current_user.tenant_id},
        {"_id": 0, "application_id": 1, "name": 1, "criticality": 1, "status": 1,
         "disposition": 1, "trajectory_target_date": 1, "trajectory_note": 1}).to_list(None)
    milestones = await db.trajectory_milestones.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}).sort("date", 1).to_list(None)
    return {"applications": apps, "milestones": milestones, "dispositions": DISPOSITIONS}


@router.put("/architecture/trajectory/{application_id}")
async def set_disposition(application_id: str, data: dict,
                          current_user: TokenPayload = Depends(permission_required("portfolio.view"))):
    updates = {}
    if data.get("disposition") in DISPOSITIONS:
        updates["disposition"] = data["disposition"]
    for k in ("trajectory_target_date", "trajectory_note"):
        if k in data:
            updates[k] = data[k]
    await db.applications.update_one(
        {"application_id": application_id, "tenant_id": current_user.tenant_id}, {"$set": updates})
    return await db.applications.find_one(
        {"application_id": application_id, "tenant_id": current_user.tenant_id},
        {"_id": 0, "application_id": 1, "name": 1, "disposition": 1,
         "trajectory_target_date": 1, "trajectory_note": 1})


@router.post("/architecture/trajectory/milestones")
async def create_milestone(data: dict, current_user: TokenPayload = Depends(permission_required("portfolio.view"))):
    doc = {
        "milestone_id": str(uuid.uuid4()), "tenant_id": current_user.tenant_id,
        "application_id": data.get("application_id"), "title": data["title"],
        "date": data["date"], "status": data.get("status", "a_venir"), "created_at": _now(),
    }
    await db.trajectory_milestones.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/architecture/trajectory/milestones/{milestone_id}")
async def update_milestone(milestone_id: str, data: dict,
                           current_user: TokenPayload = Depends(permission_required("portfolio.view"))):
    updates = {k: v for k, v in data.items() if k in ("title", "date", "status", "application_id")}
    await db.trajectory_milestones.update_one(
        {"milestone_id": milestone_id, "tenant_id": current_user.tenant_id}, {"$set": updates})
    return await db.trajectory_milestones.find_one(
        {"milestone_id": milestone_id, "tenant_id": current_user.tenant_id}, {"_id": 0})


@router.delete("/architecture/trajectory/milestones/{milestone_id}")
async def delete_milestone(milestone_id: str,
                           current_user: TokenPayload = Depends(permission_required("portfolio.view"))):
    await db.trajectory_milestones.delete_one(
        {"milestone_id": milestone_id, "tenant_id": current_user.tenant_id})
    return {"deleted": True}
