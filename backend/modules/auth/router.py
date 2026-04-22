from fastapi import APIRouter, HTTPException, Depends
import bcrypt
from core.auth import TokenPayload, get_current_user, create_token
from core.database import db
from .schemas import LoginRequest

router = APIRouter(tags=["auth"])


@router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    if not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    # Charger les permissions depuis le profil
    permissions = await _load_permissions(user)

    token = create_token({
        "tenant_id":   user["tenant_id"],
        "user_id":     user["user_id"],
        "email":       user["email"],
        "role":        user["role"],
        "name":        user["name"],
        "resource_id": user.get("resource_id"),
        "profile_id":  user.get("profile_id"),
        "permissions": permissions,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            k: user.get(k)
            for k in ("user_id", "email", "name", "role", "tenant_id", "resource_id", "profile_id")
        },
        "permissions": permissions,
    }


async def _load_permissions(user: dict) -> list[str]:
    """Charge les permissions depuis le profil de l'utilisateur."""
    profile_id = user.get("profile_id")
    if profile_id:
        profile = await db.profiles.find_one(
            {"profile_id": profile_id, "tenant_id": user["tenant_id"]},
            {"_id": 0, "permissions": 1}
        )
        if profile:
            return profile.get("permissions", [])

    # Fallback : charger le profil par code depuis le role
    from modules.profiles.service import DEFAULT_PROFILES, _role_to_permissions
    return _role_to_permissions(user.get("role", "READ_ONLY"))


@router.get("/auth/me")
async def get_me(current_user: TokenPayload = Depends(get_current_user)):
    return current_user.model_dump()
