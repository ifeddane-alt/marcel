from fastapi import APIRouter, HTTPException, Depends, Request
import bcrypt
import time
import logging
from datetime import datetime, timezone
from collections import defaultdict
from threading import Lock
from pydantic import BaseModel
from core.auth import TokenPayload, get_current_user, create_token
from core.database import db
from core.request_ctx import client_ip
from core.audit import log_auth_event
from .schemas import LoginRequest

router = APIRouter(tags=["auth"])
logger = logging.getLogger(__name__)

# ── Rate limiter in-memory (10 tentatives / email / 60s) ─────────────────────
_rl_lock = Lock()
_rl_store: dict = defaultdict(list)  # email → [timestamp, ...]
_RL_MAX = 10
_RL_WINDOW = 60  # secondes


def _check_rate_limit(email: str) -> None:
    """Lève HTTPException 429 si l'email dépasse 10 tentatives/minute."""
    now = time.time()
    key = email.lower().strip()
    with _rl_lock:
        timestamps = [t for t in _rl_store[key] if now - t < _RL_WINDOW]
        _rl_store[key] = timestamps
        if len(timestamps) >= _RL_MAX:
            retry_after = int(_RL_WINDOW - (now - timestamps[0]))
            logger.warning("[auth] Rate limit atteint pour %s (%d tentatives)", key, len(timestamps))
            raise HTTPException(
                status_code=429,
                detail=f"Trop de tentatives. Réessayez dans {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )
        _rl_store[key].append(now)


@router.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    # ── Rate limiting par email ──
    ip = client_ip(request)
    try:
        _check_rate_limit(req.email)
    except HTTPException:
        await log_auth_event("auth.login_blocked", result="blocked", email=req.email, source_ip=ip, detail="rate_limit")
        raise

    user = await db.users.find_one({"email": req.email}, {"_id": 0})
    if not user:
        logger.warning("[auth] Tentative échouée (email inconnu): %s depuis %s", req.email, ip)
        await log_auth_event("auth.login_failed", result="failure", email=req.email, source_ip=ip, detail="unknown_email")
        raise HTTPException(status_code=401, detail="Identifiants invalides")
    if user.get("is_active") is False:
        logger.warning("[auth] Tentative sur compte désactivé: %s depuis %s", req.email, ip)
        await log_auth_event("auth.login_failed", result="failure", email=req.email,
                             tenant_id=user.get("tenant_id", ""), user_id=user.get("user_id", ""),
                             source_ip=ip, detail="account_disabled")
        raise HTTPException(status_code=403, detail="Compte désactivé — contactez votre administrateur")
    if not user.get("password_hash"):
        # Compte SSO sans mot de passe local
        logger.warning("[auth] Tentative mdp sur compte SSO: %s depuis %s", req.email, ip)
        await log_auth_event("auth.login_failed", result="failure", email=req.email,
                             tenant_id=user.get("tenant_id", ""), user_id=user.get("user_id", ""),
                             source_ip=ip, detail="sso_account")
        raise HTTPException(status_code=401, detail="Ce compte utilise le SSO — utilisez la connexion SSO")
    if not bcrypt.checkpw(req.password.encode(), user["password_hash"].encode()):
        logger.warning("[auth] Tentative échouée (mauvais mdp): %s depuis %s", req.email, ip)
        await log_auth_event("auth.login_failed", result="failure", email=req.email,
                             tenant_id=user.get("tenant_id", ""), user_id=user.get("user_id", ""),
                             source_ip=ip, detail="bad_password")
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    if user.get("mfa_enabled"):
        ticket = create_token({
            "tenant_id": user["tenant_id"], "user_id": user["user_id"],
            "email": user["email"], "type": "mfa",
        })
        await log_auth_event("auth.mfa_challenge", result="success", email=user["email"],
                             tenant_id=user["tenant_id"], user_id=user["user_id"], source_ip=ip)
        return {"mfa_required": True, "mfa_ticket": ticket}

    # Charger les permissions et le nom du profil
    permissions, profile_name = await _load_profile_data(user)

    token = create_token({
        "tenant_id":    user["tenant_id"],
        "user_id":      user["user_id"],
        "email":        user["email"],
        "role":         user["role"],
        "name":         user["name"],
        "resource_id":  user.get("resource_id"),
        "profile_id":   user.get("profile_id"),
        "permissions":  permissions,
        "pv":           user.get("perm_version", 1),
    })

    user_data = {
        k: user.get(k)
        for k in ("user_id", "email", "name", "role", "tenant_id", "resource_id", "profile_id")
    }
    user_data["profile_name"] = profile_name
    await log_auth_event("auth.login_success", result="success", email=user["email"],
                         tenant_id=user["tenant_id"], user_id=user["user_id"], source_ip=ip)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_data,
        "permissions": permissions,
    }


async def _load_profile_data(user: dict) -> tuple[list[str], str]:
    """Charge les permissions et le nom du profil depuis le profil de l'utilisateur."""
    profile_id = user.get("profile_id")
    if profile_id:
        profile = await db.profiles.find_one(
            {"profile_id": profile_id, "tenant_id": user["tenant_id"]},
            {"_id": 0, "permissions": 1, "name": 1},
        )
        if profile:
            return profile.get("permissions", []), profile.get("name", "")

    # Fallback legacy : permissions par rôle
    from modules.profiles.service import _role_to_permissions
    perms = _role_to_permissions(user.get("role", "READ_ONLY"))
    _name_fallback = {
        "TENANT_ADMIN": "Administrateur",
        "PMO_USER":     "PMO Portefeuille",
        "READ_ONLY":    "Lecture seule",
    }
    return perms, _name_fallback.get(user.get("role", ""), "")


@router.get("/auth/me")
async def get_me(current_user: TokenPayload = Depends(get_current_user)):
    return current_user.model_dump()


@router.post("/auth/logout")
async def logout(request: Request, current_user: TokenPayload = Depends(get_current_user)):
    """Logout côté client (JWT stateless). Journalisé pour l'audit trail.
    La révocation serveur immédiate reste assurée par perm_version (bump des droits)."""
    await log_auth_event("auth.logout", result="success", email=current_user.email,
                         tenant_id=current_user.tenant_id, user_id=current_user.user_id,
                         source_ip=client_ip(request))
    return {"logged_out": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/auth/account")
async def get_account(current_user: TokenPayload = Depends(get_current_user)):
    user = await db.users.find_one(
        {"user_id": current_user.user_id, "tenant_id": current_user.tenant_id}, {"_id": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    has_password = bool(user.pop("password_hash", None))
    tenant = await db.tenants.find_one({"tenant_id": current_user.tenant_id}, {"_id": 0, "name": 1})
    _, profile_name = await _load_profile_data(user)
    user["has_password"] = has_password
    user["tenant_name"] = (tenant or {}).get("name", "")
    user["profile_name"] = profile_name
    user["permissions_count"] = len(current_user.permissions or [])
    return user


@router.post("/auth/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: TokenPayload = Depends(get_current_user),
):
    user = await db.users.find_one(
        {"user_id": current_user.user_id, "tenant_id": current_user.tenant_id}
    )
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if not user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Compte SSO — le mot de passe est géré par votre fournisseur d'identité")
    if not bcrypt.checkpw(req.current_password.encode(), user["password_hash"].encode()):
        logger.warning("[auth] Changement mdp refusé (mdp actuel incorrect): %s", current_user.email)
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    if len(req.new_password) < 8:
        raise HTTPException(status_code=422, detail="Le nouveau mot de passe doit contenir au moins 8 caractères")
    if req.new_password == req.current_password:
        raise HTTPException(status_code=422, detail="Le nouveau mot de passe doit être différent de l'actuel")
    await db.users.update_one(
        {"user_id": current_user.user_id, "tenant_id": current_user.tenant_id},
        {"$set": {
            "password_hash": bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode(),
            "password_changed_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    from core.audit import log_audit
    await log_audit(current_user, "user.password_changed", "user", current_user.user_id, current_user.email)
    return {"changed": True}
