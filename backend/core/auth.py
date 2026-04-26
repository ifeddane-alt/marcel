from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from jose import jwt, JWTError
from datetime import datetime, timezone, timedelta
import os

JWT_SECRET    = os.environ.get("JWT_SECRET", "projetenne-secret-key-2025")
JWT_ALGORITHM = "HS256"

security = HTTPBearer()


class TokenPayload(BaseModel):
    tenant_id:   str
    user_id:     str
    email:       str
    role:        str
    name:        str
    resource_id: Optional[str]       = None
    profile_id:  Optional[str]       = None
    permissions: Optional[List[str]] = None   # Chargées au login depuis le profil


def create_token(payload: dict) -> str:
    data = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(data, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> TokenPayload:
    """Décode un JWT sans passer par le mécanisme HTTPBearer (utile pour WebSocket)."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**payload)
    except (JWTError, Exception):
        raise ValueError("Token invalide ou expiré")


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
) -> TokenPayload:
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return TokenPayload(**payload)
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")


# ─── Helpers backward-compat ─────────────────────────────────────────────────

def require_write(user: TokenPayload) -> None:
    """Backward compat : vérifie droit d'écriture générique."""
    _enforce_permission(user, "_write")   # perm virtuelle, voir _role_fallback


def require_admin(user: TokenPayload) -> None:
    """Backward compat : vérifie droit admin."""
    _enforce_permission(user, "admin.config")


# ─── permission_required — middleware principal ───────────────────────────────

def permission_required(permission: str):
    """
    FastAPI Depends factory.
    Lit UNIQUEMENT permissions[] du token. JAMAIS le code du profil.

    Exemple :
        @router.post("/projects")
        async def create_project(
            user: TokenPayload = Depends(permission_required("projects.create"))
        ):
    """
    async def dep(
        current_user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        _enforce_permission(current_user, permission)
        return current_user

    return dep


def has_perm(user: TokenPayload, permission: str) -> bool:
    """
    Vérifie si un utilisateur possède une permission.
    Le wildcard '*' donne accès à tout.
    Usage : has_perm(current_user, 'projects.view_own')
    """
    perms = user.permissions or []
    if "*" in perms:
        return True
    return permission in perms


def is_ownership_restricted(user: TokenPayload, restriction_perm: str) -> bool:
    """
    Vérifie si l'utilisateur est restreint à ses propres entités.
    Renvoie True UNIQUEMENT si la permission de restriction est explicitement présente
    ET que l'utilisateur n'a PAS de wildcard (accès complet).

    Logique :
    - ["*"]                         → False (accès complet, aucun filtre)
    - ["projects.view_own", ...]    → True  (filtré par owner)
    - ["portfolio.view", ...]       → False (accès complet sans restriction)
    """
    perms = user.permissions or []
    if "*" in perms:
        return False  # Wildcard = accès complet
    return restriction_perm in perms


# ─── Logique de vérification ─────────────────────────────────────────────────

def _enforce_permission(user: TokenPayload, permission: str) -> None:
    """Lève 403 si la permission est refusée."""
    perms = user.permissions or []

    if perms:
        # Token avec permissions → vérification stricte
        if "*" in perms or permission in perms:
            return
        # Permission virtuelle _write : tout sauf les .view uniquement
        if permission == "_write":
            has_write = any(
                p for p in perms
                if not p.endswith(".view")
                   and not p.endswith(".view_own")
                   and not p.endswith(".view_all")
                   and p != "*"
            )
            if has_write:
                return
        raise HTTPException(
            status_code=403,
            detail=f"Permission '{permission}' refusée pour ce profil",
        )

    # ─── Fallback : token sans permissions (anciens tokens) ──────────────────
    _role_fallback(user, permission)


def _role_fallback(user: TokenPayload, permission: str) -> None:
    """Fallback role-based pour tokens sans champ permissions."""
    role = user.role

    if role == "TENANT_ADMIN":
        return

    if role == "PMO_USER":
        # PORTFOLIO : tout sauf admin.*
        if not permission.startswith("admin."):
            return
        raise HTTPException(status_code=403, detail="Droits administrateur requis")

    # READ_ONLY : uniquement lecture + saisie basique
    _READ_ONLY_PERMS = {
        "dashboard.view", "portfolio.view", "roadmap.view", "teams.view",
        "risks.view", "decisions.view", "governance.view", "compliance.view",
        "demands.view_own", "budget.view", "raf.view", "trains.view",
        "timesheets.submit", "leaves.submit",
    }
    if permission in _READ_ONLY_PERMS:
        return

    raise HTTPException(status_code=403, detail="Droits insuffisants")
