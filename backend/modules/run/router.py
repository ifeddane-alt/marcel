from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["run"])


@router.get("/run/summary")
async def get_summary(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_summary(current_user)


@router.get("/run/activities")
async def list_activities(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_activities(current_user)


@router.post("/run/activities", status_code=201)
async def create_activity(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_activity(data, current_user)


@router.put("/run/activities/{activity_id}")
async def update_activity(activity_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_activity(activity_id, data, current_user)


@router.delete("/run/activities/{activity_id}", status_code=204)
async def delete_activity(activity_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_activity(activity_id, current_user)


@router.get("/run/activities/{activity_id}/allocations")
async def get_activity_allocations(activity_id: str, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_activity_allocations(activity_id, current_user)


@router.put("/run/activities/{activity_id}/allocations")
async def set_activity_allocations(activity_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.set_activity_allocations(activity_id, data.get("allocations") or [], current_user)


@router.get("/run/load")
async def get_load(months: int = 6, current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_consolidated_load(min(max(months, 1), 12), current_user)


@router.get("/run/incidents")
async def list_incidents(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_incidents(current_user)


@router.post("/run/incidents", status_code=201)
async def create_incident(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_incident(data, current_user)


@router.put("/run/incidents/{incident_id}")
async def update_incident(incident_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_incident(incident_id, data, current_user)


@router.delete("/run/incidents/{incident_id}", status_code=204)
async def delete_incident(incident_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_incident(incident_id, current_user)


@router.get("/run/releases")
async def list_releases(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_releases(current_user)


@router.post("/run/releases", status_code=201)
async def create_release(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.create_release(data, current_user)


@router.put("/run/releases/{release_id}")
async def update_release(release_id: str, data: dict, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_release(release_id, data, current_user)


@router.delete("/run/releases/{release_id}", status_code=204)
async def delete_release(release_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await service.delete_release(release_id, current_user)
