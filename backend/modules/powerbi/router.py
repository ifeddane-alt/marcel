"""Power BI Connector — Router.

Auth : Bearer JWT avec permission export.powerbi
      OU header X-API-Key avec clé générée dans /admin/config.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional

from core.auth import TokenPayload, get_current_user, permission_required
from core.database import db
from . import service

router = APIRouter(tags=["powerbi"])

_perm = permission_required("export.powerbi")


# ─── Auth hybride JWT / API Key ───────────────────────────────────────────────

async def get_powerbi_user(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
) -> TokenPayload:
    """
    Accepte :
    1. Header Authorization: Bearer <JWT>  (avec permission export.powerbi)
    2. Header X-API-Key: <clé générée>
    """
    # --- Cas 1 : JWT standard
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ")
        from core.auth import JWT_SECRET, JWT_ALGORITHM
        from jose import jwt, JWTError
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user = TokenPayload(**payload)
        except (JWTError, Exception):
            raise HTTPException(status_code=401, detail="Token invalide ou expiré")
        # Vérifier permission
        perms = user.permissions or []
        if "*" not in perms and "export.powerbi" not in perms:
            raise HTTPException(status_code=403, detail="Permission export.powerbi requise")
        return user

    # --- Cas 2 : API Key
    if x_api_key:
        tenant_id = await service.verify_api_key(x_api_key)
        if not tenant_id:
            raise HTTPException(status_code=401, detail="Clé API Power BI invalide")
        # Construire un TokenPayload minimal
        return TokenPayload(
            tenant_id=tenant_id,
            user_id="powerbi-connector",
            email="powerbi@system",
            role="POWERBI",
            name="Power BI Connector",
            permissions=["export.powerbi"],
        )

    raise HTTPException(
        status_code=401,
        detail="Authentification requise : Bearer JWT ou X-API-Key",
    )


# ─── Endpoints données (flat JSON arrays) ────────────────────────────────────

@router.get("/powerbi/projects")
async def powerbi_projects(user: TokenPayload = Depends(get_powerbi_user)):
    """Projets — format plat pour Power BI."""
    return await service.get_projects(user.tenant_id)


@router.get("/powerbi/resources")
async def powerbi_resources(user: TokenPayload = Depends(get_powerbi_user)):
    """Ressources — format plat."""
    return await service.get_resources(user.tenant_id)


@router.get("/powerbi/timesheets")
async def powerbi_timesheets(user: TokenPayload = Depends(get_powerbi_user)):
    """Timesheets — lignes dépliées (une ligne = une entrée/jour)."""
    return await service.get_timesheets(user.tenant_id)


@router.get("/powerbi/budget")
async def powerbi_budget(user: TokenPayload = Depends(get_powerbi_user)):
    """Budget — prévu vs consommé vs EAC par projet."""
    return await service.get_budget(user.tenant_id)


@router.get("/powerbi/risks")
async def powerbi_risks(user: TokenPayload = Depends(get_powerbi_user)):
    """Risques — format plat."""
    return await service.get_risks(user.tenant_id)


@router.get("/powerbi/milestones")
async def powerbi_milestones(user: TokenPayload = Depends(get_powerbi_user)):
    """Jalons — format plat avec days_remaining calculé."""
    return await service.get_milestones(user.tenant_id)


# ─── Gestion clé API (réservé admin.config) ──────────────────────────────────

@router.get("/admin/powerbi/key")
async def get_key(user: TokenPayload = Depends(permission_required("admin.config"))):
    return await service.get_api_key(user)


@router.post("/admin/powerbi/generate-key", status_code=201)
async def generate_key(user: TokenPayload = Depends(permission_required("admin.config"))):
    return await service.generate_api_key(user)


@router.delete("/admin/powerbi/revoke-key")
async def revoke_key(user: TokenPayload = Depends(permission_required("admin.config"))):
    return await service.revoke_api_key(user)
