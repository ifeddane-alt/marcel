from fastapi import HTTPException
from typing import Optional
from core.database import db
from core.auth import TokenPayload


async def list_allocations(project_id: Optional[str], current_user: TokenPayload) -> list:
    if project_id:
        proj = await db.projects.find_one(
            {"project_id": project_id, "tenant_id": current_user.tenant_id}
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Projet introuvable")
        return await db.allocations.find({"project_id": project_id}, {"_id": 0}).to_list(None)
    else:
        projects = await db.projects.find(
            {"tenant_id": current_user.tenant_id}, {"project_id": 1, "_id": 0}
        ).to_list(None)
        pids = [p["project_id"] for p in projects]
        return await db.allocations.find({"project_id": {"$in": pids}}, {"_id": 0}).to_list(None)
