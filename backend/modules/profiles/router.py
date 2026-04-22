from fastapi import APIRouter, Depends
from core.auth import TokenPayload, get_current_user
from . import service
from .schemas import ProfileCreate, ProfileUpdate, ProfileDuplicate
from pydantic import BaseModel
from typing import Optional

router = APIRouter(tags=["profiles"])


# ─── Profils ─────────────────────────────────────────────────────────────────

@router.get("/profiles")
async def list_profiles(current_user: TokenPayload = Depends(get_current_user)):
    return await service.list_profiles(current_user)


@router.get("/profiles/permissions")
async def get_all_permissions(current_user: TokenPayload = Depends(get_current_user)):
    return await service.get_all_permissions()


@router.post("/profiles")
async def create_profile(
    data: ProfileCreate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.create_profile(data, current_user)


@router.get("/profiles/{profile_id}")
async def get_profile(
    profile_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.get_profile(profile_id, current_user)


@router.put("/profiles/{profile_id}")
async def update_profile(
    profile_id: str,
    data: ProfileUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_profile(profile_id, data, current_user)


@router.delete("/profiles/{profile_id}")
async def delete_profile(
    profile_id: str,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.delete_profile(profile_id, current_user)


@router.post("/profiles/{profile_id}/duplicate")
async def duplicate_profile(
    profile_id: str,
    data: ProfileDuplicate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.duplicate_profile(profile_id, data, current_user)


@router.post("/profiles/seed")
async def seed_profiles(current_user: TokenPayload = Depends(get_current_user)):
    return await service.seed_default_profiles(current_user.tenant_id)


@router.post("/profiles/seed-full")
async def seed_full(current_user: TokenPayload = Depends(get_current_user)):
    """Seed complet : profils + réaffectation users + nouveaux users."""
    return await service.seed_full_profiles_and_users(current_user.tenant_id)


# ─── Admin : gestion utilisateurs ────────────────────────────────────────────

class UserProfileUpdate(BaseModel):
    profile_id: Optional[str] = None


@router.get("/admin/users")
async def list_users(
    profile_id: Optional[str] = None,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.list_users(current_user, profile_id=profile_id)


@router.patch("/admin/users/{user_id}")
async def update_user_profile(
    user_id: str,
    data: UserProfileUpdate,
    current_user: TokenPayload = Depends(get_current_user),
):
    return await service.update_user_profile(user_id, data.profile_id, current_user)

