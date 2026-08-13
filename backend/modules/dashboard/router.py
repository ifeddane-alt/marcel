from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel
from datetime import datetime
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["dashboard"])


class CxoPreferences(BaseModel):
    widgets: list[str]


class DashboardPreferences(BaseModel):
    widgets: list[str]
    layouts: dict | None = None


@router.get("/dashboard/extras")
async def dashboard_extras(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_extras(current_user)


@router.get("/dashboard/preferences")
async def get_dashboard_preferences(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_dashboard_preferences(current_user)


@router.put("/dashboard/preferences")
async def update_dashboard_preferences(data: DashboardPreferences, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_dashboard_preferences(data.widgets, data.layouts, current_user)


@router.get("/dashboard/cxo")
async def dashboard_cxo(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_cxo(current_user)


@router.get("/dashboard/cxo/preferences")
async def get_cxo_preferences(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_cxo_preferences(current_user)


@router.put("/dashboard/cxo/preferences")
async def update_cxo_preferences(data: CxoPreferences, current_user: TokenPayload = Depends(get_current_user)):
    return await service.update_cxo_preferences(data.widgets, current_user)


@router.get("/dashboard/summary")
async def dashboard_summary(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_summary(current_user)


@router.get("/dashboard/top-risks")
async def dashboard_top_risks(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_top_risks(current_user)


@router.get("/dashboard/heatmap-risks")
async def dashboard_heatmap_risks(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_heatmap_risks(current_user)


@router.get("/dashboard/export/pdf")
async def dashboard_export_pdf(current_user: TokenPayload = Depends(get_current_user)):
    from .pdf_export import export_dashboard_pdf
    data = await export_dashboard_pdf(current_user)
    filename = f"MARCEL_Rapport_COMEX_{datetime.now().strftime('%Y-%m-%d')}.pdf"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Vues sauvegardées (filtres par utilisateur) ─────────────────────────────
import uuid as _uuid
from datetime import timezone as _tz
from core.database import db as _db


@router.get("/views")
async def list_saved_views(page: str, current_user: TokenPayload = Depends(get_current_user)):
    return await _db.saved_views.find(
        {"tenant_id": current_user.tenant_id, "user_id": current_user.user_id, "page": page},
        {"_id": 0},
    ).sort("name", 1).to_list(50)


@router.post("/views", status_code=201)
async def save_view(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    from fastapi import HTTPException
    name = (data.get("name") or "").strip()
    if not name or not data.get("page"):
        raise HTTPException(422, "Nom et page requis")
    doc = {
        "view_id": str(_uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        "user_id": current_user.user_id,
        "page": data["page"],
        "name": name,
        "filters": data.get("filters") or {},
        "created_at": datetime.now(_tz.utc).isoformat(),
    }
    await _db.saved_views.insert_one({**doc})
    doc.pop("_id", None)
    return doc


@router.delete("/views/{view_id}", status_code=204)
async def delete_view(view_id: str, current_user: TokenPayload = Depends(get_current_user)):
    await _db.saved_views.delete_one(
        {"view_id": view_id, "tenant_id": current_user.tenant_id, "user_id": current_user.user_id}
    )


# ─── Projets favoris ──────────────────────────────────────────────────────────

@router.get("/favorites")
async def get_favorites(current_user: TokenPayload = Depends(get_current_user)):
    prefs = await _db.user_preferences.find_one(
        {"tenant_id": current_user.tenant_id, "user_id": current_user.user_id},
        {"_id": 0, "favorite_projects": 1},
    )
    return {"favorites": (prefs or {}).get("favorite_projects") or []}


@router.post("/favorites/toggle")
async def toggle_favorite(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    pid = data.get("project_id")
    if not pid:
        from fastapi import HTTPException
        raise HTTPException(422, "project_id requis")
    q = {"tenant_id": current_user.tenant_id, "user_id": current_user.user_id}
    prefs = await _db.user_preferences.find_one(q, {"_id": 0, "favorite_projects": 1})
    favs = (prefs or {}).get("favorite_projects") or []
    if pid in favs:
        await _db.user_preferences.update_one(q, {"$pull": {"favorite_projects": pid}}, upsert=True)
        return {"favorite": False}
    await _db.user_preferences.update_one(q, {"$addToSet": {"favorite_projects": pid}}, upsert=True)
    return {"favorite": True}
