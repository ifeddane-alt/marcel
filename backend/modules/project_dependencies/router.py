from fastapi import APIRouter, Depends, HTTPException
from core.auth import TokenPayload, get_current_user
from . import service

router = APIRouter(tags=["project_dependencies"])


@router.get("/project-dependencies")
async def list_dependencies(
    project_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_dependencies(project_id, current_user)


@router.get("/project-dependencies/all")
async def list_all_dependencies(
    current_user: TokenPayload = Depends(get_current_user),
):
    """Toutes les dépendances du tenant (pour la roadmap)."""
    return await service.list_all_dependencies(current_user.tenant_id)


@router.post("/project-dependencies")
async def create_dependency(
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.create_dependency(data, current_user)


@router.put("/project-dependencies/{dep_id}")
async def update_dependency(
    dep_id: str,
    data: dict,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.update_dependency(dep_id, data, current_user)


@router.delete("/project-dependencies/{dep_id}")
async def delete_dependency(
    dep_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    if current_user.role not in ("TENANT_ADMIN", "PMO_USER"):
        raise HTTPException(status_code=403, detail="Permission refusée")
    return await service.delete_dependency(dep_id, current_user)
