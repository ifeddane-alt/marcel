"""Gestion des tokens d'API publique (admin tenant, permission admin.config).

Le token complet n'est renvoyé QU'AU MOMENT de sa création ou de sa rotation.
"""
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth import TokenPayload, permission_required
from core.database import db
from core.public_api import (
    SCOPES, generate_raw_token, hash_token, store_prefix, _now,
)

router = APIRouter(tags=["public-api-admin"])
_admin = permission_required("admin.config")


class TokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    scopes: list[str]
    expires_in_days: int | None = Field(default=None, ge=1, le=730)
    rate_limit_per_min: int | None = Field(default=None, ge=1, le=10000)


def _validate_scopes(scopes: list[str]) -> list[str]:
    invalid = [s for s in scopes if s not in SCOPES]
    if invalid:
        raise HTTPException(400, f"Scopes invalides : {invalid}. Scopes disponibles : {SCOPES}")
    if not scopes:
        raise HTTPException(400, "Au moins un scope est requis")
    return sorted(set(scopes))


def _public_view(doc: dict) -> dict:
    return {
        "token_id": doc["token_id"],
        "name": doc.get("name"),
        "prefix": doc.get("token_prefix"),
        "scopes": doc.get("scopes", []),
        "rate_limit_per_min": doc.get("rate_limit_per_min"),
        "created_at": doc.get("created_at"),
        "created_by": doc.get("created_by_name"),
        "last_used_at": doc.get("last_used_at"),
        "expires_at": doc.get("expires_at"),
        "revoked_at": doc.get("revoked_at"),
        "status": "revoked" if doc.get("revoked_at") else "active",
    }


@router.get("/admin/api-tokens")
async def list_tokens(current_user: TokenPayload = Depends(_admin)):
    docs = await db.api_tokens.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0, "token_hash": 0}
    ).sort("created_at", -1).to_list(None)
    return [_public_view(d) for d in docs]


@router.get("/admin/api-tokens/scopes")
async def available_scopes(current_user: TokenPayload = Depends(_admin)):
    return {"scopes": SCOPES}


@router.post("/admin/api-tokens", status_code=201)
async def create_token(data: TokenCreate, current_user: TokenPayload = Depends(_admin)):
    scopes = _validate_scopes(data.scopes)
    raw = generate_raw_token()
    now = _now()
    doc = {
        "token_id": str(uuid.uuid4()),
        "tenant_id": current_user.tenant_id,
        "name": data.name.strip(),
        "token_prefix": store_prefix(raw),
        "token_hash": hash_token(raw),
        "scopes": scopes,
        "rate_limit_per_min": data.rate_limit_per_min,
        "created_at": now.isoformat(),
        "created_by": current_user.user_id,
        "created_by_name": current_user.name,
        "last_used_at": None,
        "expires_at": (now + timedelta(days=data.expires_in_days)).isoformat() if data.expires_in_days else None,
        "revoked_at": None,
    }
    await db.api_tokens.insert_one(dict(doc))
    view = _public_view(doc)
    view["token"] = raw  # UNIQUEMENT à la création
    view["warning"] = "Copiez ce token maintenant : il ne sera plus jamais affiché."
    return view


@router.post("/admin/api-tokens/{token_id}/rotate")
async def rotate_token(token_id: str, current_user: TokenPayload = Depends(_admin)):
    tok = await db.api_tokens.find_one({"token_id": token_id, "tenant_id": current_user.tenant_id})
    if not tok:
        raise HTTPException(404, "Token introuvable")
    if tok.get("revoked_at"):
        raise HTTPException(400, "Token révoqué : créez-en un nouveau")
    raw = generate_raw_token()
    await db.api_tokens.update_one(
        {"token_id": token_id, "tenant_id": current_user.tenant_id},
        {"$set": {"token_prefix": store_prefix(raw), "token_hash": hash_token(raw),
                  "rotated_at": _now().isoformat(), "last_used_at": None}})
    doc = await db.api_tokens.find_one({"token_id": token_id}, {"_id": 0, "token_hash": 0})
    view = _public_view(doc)
    view["token"] = raw
    view["warning"] = "Nouveau secret : l'ancien ne fonctionne plus. Copiez-le maintenant."
    return view


@router.delete("/admin/api-tokens/{token_id}", status_code=200)
async def revoke_token(token_id: str, current_user: TokenPayload = Depends(_admin)):
    res = await db.api_tokens.update_one(
        {"token_id": token_id, "tenant_id": current_user.tenant_id, "revoked_at": None},
        {"$set": {"revoked_at": _now().isoformat()}})
    if res.matched_count == 0:
        raise HTTPException(404, "Token introuvable ou déjà révoqué")
    return {"revoked": True, "token_id": token_id}
