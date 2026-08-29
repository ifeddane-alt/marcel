import io
import base64
import hashlib
import secrets
from datetime import datetime, timezone
import pyotp
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from jose import jwt, JWTError
from core.database import db
from core.auth import TokenPayload, get_current_user, create_token, JWT_SECRET, JWT_ALGORITHM
from core.limiter import limiter

router = APIRouter(tags=["mfa"])


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().lower().encode()).hexdigest()


def _qr_data_url(uri: str) -> str:
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify((code or "").strip().replace(" ", ""), valid_window=1)


async def _consume_backup_code(user: dict, code: str) -> bool:
    hashed = _hash_code(code)
    codes = user.get("mfa_backup_codes") or []
    if hashed not in codes:
        return False
    await db.users.update_one(
        {"user_id": user["user_id"]}, {"$pull": {"mfa_backup_codes": hashed}}
    )
    return True


@router.get("/auth/mfa/status")
async def mfa_status(current_user: TokenPayload = Depends(get_current_user)):
    u = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "mfa_enabled": 1, "mfa_backup_codes": 1, "password_hash": 1})
    return {
        "enabled": bool((u or {}).get("mfa_enabled")),
        "backup_codes_left": len((u or {}).get("mfa_backup_codes") or []),
        "available": bool((u or {}).get("password_hash")),
    }


@router.post("/auth/mfa/setup")
async def mfa_setup(current_user: TokenPayload = Depends(get_current_user)):
    u = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not u or not u.get("password_hash"):
        raise HTTPException(400, "Le MFA n'est pas disponible pour les comptes SSO")
    secret = pyotp.random_base32()
    await db.users.update_one(
        {"user_id": current_user.user_id}, {"$set": {"mfa_pending_secret": secret}}
    )
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=current_user.email, issuer_name="MARCEL")
    return {"secret": secret, "otpauth_uri": uri, "qr": _qr_data_url(uri)}


@router.post("/auth/mfa/enable")
async def mfa_enable(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    u = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    secret = (u or {}).get("mfa_pending_secret")
    if not secret:
        raise HTTPException(400, "Aucune configuration MFA en attente — relancez l'activation")
    if not _verify_totp(secret, data.get("code")):
        raise HTTPException(401, "Code invalide — vérifiez votre application d'authentification")
    backup_codes = [secrets.token_urlsafe(16) for _ in range(8)]
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {
            "mfa_enabled": True,
            "mfa_secret": secret,
            "mfa_backup_codes": [_hash_code(c) for c in backup_codes],
            "mfa_enabled_at": datetime.now(timezone.utc).isoformat(),
        }, "$unset": {"mfa_pending_secret": ""}},
    )
    from core.audit import log_audit
    await log_audit(current_user, "mfa_enabled", "user", current_user.user_id, current_user.name)
    return {"enabled": True, "backup_codes": backup_codes}


@router.post("/auth/mfa/disable")
async def mfa_disable(data: dict, current_user: TokenPayload = Depends(get_current_user)):
    u = await db.users.find_one({"user_id": current_user.user_id}, {"_id": 0})
    if not (u or {}).get("mfa_enabled"):
        raise HTTPException(400, "Le MFA n'est pas activé")
    code = data.get("code") or ""
    if not (_verify_totp(u.get("mfa_secret", ""), code) or await _consume_backup_code(u, code)):
        raise HTTPException(401, "Code invalide")
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"mfa_enabled": False}, "$unset": {"mfa_secret": "", "mfa_backup_codes": ""}},
    )
    from core.audit import log_audit
    await log_audit(current_user, "mfa_disabled", "user", current_user.user_id, current_user.name)
    return {"enabled": False}


@router.post("/auth/mfa/verify")
@limiter.limit("10/minute")
async def mfa_verify(request: Request, data: dict):
    ticket = data.get("ticket") or ""
    try:
        payload = jwt.decode(ticket, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Ticket MFA invalide ou expiré")
    if payload.get("type") != "mfa" or not payload.get("jti"):
        raise HTTPException(401, "Ticket MFA invalide")
    challenge = await db.mfa_challenges.find_one({"_id": payload["jti"], "user_id": payload.get("user_id")})
    if not challenge:
        raise HTTPException(401, "Ticket MFA invalide, expiré ou déjà utilisé")
    if int(challenge.get("attempts", 0)) >= 5:
        await db.mfa_challenges.delete_one({"_id": payload["jti"]})
        raise HTTPException(429, "Trop de tentatives MFA")
    user = await db.users.find_one({"user_id": payload.get("user_id"), "tenant_id": payload.get("tenant_id")}, {"_id": 0})
    if not user or not user.get("mfa_enabled"):
        raise HTTPException(401, "Ticket MFA invalide")
    code = data.get("code") or ""
    if not (_verify_totp(user.get("mfa_secret", ""), code) or await _consume_backup_code(user, code)):
        res = await db.mfa_challenges.find_one_and_update(
            {"_id": payload["jti"]}, {"$inc": {"attempts": 1}}, return_document=True
        )
        if res and int(res.get("attempts", 0)) >= 5:
            await db.mfa_challenges.delete_one({"_id": payload["jti"]})
            raise HTTPException(429, "Trop de tentatives MFA")
        raise HTTPException(401, "Code invalide")
    deleted = await db.mfa_challenges.delete_one({"_id": payload["jti"]})
    if deleted.deleted_count != 1:
        raise HTTPException(401, "Ticket MFA déjà utilisé")
    from modules.auth.router import _load_profile_data
    permissions, profile_name = await _load_profile_data(user)
    token = create_token({
        "tenant_id": user["tenant_id"], "user_id": user["user_id"], "email": user["email"],
        "role": user["role"], "name": user["name"], "resource_id": user.get("resource_id"),
        "profile_id": user.get("profile_id"), "permissions": permissions,
        "pv": user.get("perm_version", 1),
    })
    user_data = {k: user.get(k) for k in ("user_id", "email", "name", "role", "tenant_id", "resource_id", "profile_id")}
    user_data["profile_name"] = profile_name
    return {"access_token": token, "token_type": "bearer", "user": user_data, "permissions": permissions}
