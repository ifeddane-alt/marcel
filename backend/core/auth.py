from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
from jose import jwt, JWTError
from datetime import datetime, timezone, timedelta
import os
import logging

logger = logging.getLogger("auth")

JWT_ALGORITHM = "HS256"
_MIN_SECRET_LEN = 32
_KNOWN_WEAK_SECRETS = {
    "projetenne-secret-key-2025",
    "projetenne-secret-key-2025-altair",
    "changeme", "secret", "your-secret-key", "dev-secret",
}


def _load_jwt_secret() -> str:
    """Charge le secret JWT depuis l'environnement. Aucune valeur par défaut.
    L'application REFUSE DE DÉMARRER si le secret est manquant, trop court
    ou correspond à une valeur par défaut connue comme compromise."""
    secret = (os.environ.get("JWT_SECRET") or "").strip()
    if not secret:
        raise RuntimeError(
            "JWT_SECRET manquant. Configurez un secret aléatoire d'au moins "
            f"{_MIN_SECRET_LEN} caractères dans backend/.env "
            "(ex. python -c \"import secrets; print(secrets.token_hex(32))\"). "
            "L'application refuse de démarrer sans secret valide."
        )
    if len(secret) < _MIN_SECRET_LEN:
        raise RuntimeError(
            f"JWT_SECRET trop court ({len(secret)} caractères). "
            f"Au moins {_MIN_SECRET_LEN} caractères requis."
        )
    if secret in _KNOWN_WEAK_SECRETS:
        raise RuntimeError(
            "JWT_SECRET correspond à une valeur par défaut compromise. "
            "Générez un nouveau secret aléatoire et effectuez une rotation."
        )
    return secret


# Chargé à l'import : si invalide, l'import échoue et l'app ne démarre pas.
JWT_SECRET = _load_jwt_secret()

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
    pv:          Optional[int]       = None   # Permission version (révocation)


# Durée de vie courte : borne la fenêtre de droits périmés (révocation via perm_version).
ACCESS_TOKEN_HOURS = 8


def create_token(payload: dict) -> str:
    data = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_HOURS)}
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
        tp = TokenPayload(**payload)
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

    # Révocation & propagation des changements de droits (compte désactivé,
    # rôle/profil/permissions modifiés) : le token porte pv ; on le compare à
    # la version courante de l'utilisateur. Fail-open uniquement en cas d'erreur DB.
    from core.database import db
    try:
        u = await db.users.find_one(
            {"user_id": tp.user_id, "tenant_id": tp.tenant_id},
            {"_id": 0, "user_id": 1, "perm_version": 1, "is_active": 1},
        )
    except Exception as e:            # pragma: no cover - incident infra
        logger.warning("perm_version check indisponible: %s", e)
        return tp
    if u is None:
        raise HTTPException(status_code=401, detail="Session invalide")
    if u.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Compte désactivé")
    if (tp.pv or 0) != u.get("perm_version", 1):
        raise HTTPException(status_code=401, detail="Droits modifiés — reconnectez-vous")
    return tp


async def ensure_project_scope(
    user: "TokenPayload", project_id: str,
    edit_perm: str = "projects.edit", own_perm: str = "projects.view_own",
) -> None:
    """Autorisation au niveau objet : une permission d'édition large autorise tout ;
    une permission « own » n'autorise que les projets dont l'utilisateur est owner.
    Lève 403 sinon. La permission de module doit déjà avoir été vérifiée en amont."""
    perms = user.permissions or []
    if "*" in perms or edit_perm in perms:
        return
    if own_perm in perms:
        from core.database import db
        proj = await db.projects.find_one(
            {"project_id": project_id, "tenant_id": user.tenant_id},
            {"_id": 0, "owner_id": 1},
        )
        if proj and proj.get("owner_id") == user.user_id:
            return
        raise HTTPException(status_code=403, detail="Accès limité à vos propres projets")
    # Aucune restriction d'ownership déclarée : la permission de module suffit.
    return


# ─── Helpers backward-compat ─────────────────────────────────────────────────

def require_write(user: TokenPayload) -> None:
    """OBSOLÈTE — l'ancienne permission virtuelle laxiste '_write' est supprimée.
    Fail-closed : tout appel résiduel exige la permission inexistante '_write'
    (donc refus, sauf wildcard admin). Utiliser _enforce_permission(user, '<mod>.<action>')."""
    _enforce_permission(user, "_write")


def require_admin(user: TokenPayload) -> None:
    """Backward compat : vérifie droit admin."""
    _enforce_permission(user, "admin.config")


def require_perm(user: TokenPayload, permission: str) -> None:
    """Exige une permission explicite (deny by default). Remplace require_write."""
    _enforce_permission(user, permission)


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


def permission_required_any(*permissions: str):
    """Autorise si l'utilisateur possède AU MOINS UNE des permissions listées.
    Le scope objet (ownership) est ensuite vérifié dans le service via ensure_project_scope."""
    async def dep(
        current_user: TokenPayload = Depends(get_current_user),
    ) -> TokenPayload:
        perms = current_user.permissions or []
        if "*" in perms or any(p in perms for p in permissions):
            return current_user
        raise HTTPException(
            status_code=403,
            detail=f"Permission requise (une parmi) : {', '.join(permissions)}",
        )

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
        # Token avec permissions → vérification stricte (deny by default)
        if "*" in perms or permission in perms:
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

    # READ_ONLY : lecture STRICTE (aucune écriture, y compris timesheets/congés)
    _READ_ONLY_PERMS = {
        "dashboard.view", "portfolio.view", "roadmap.view", "teams.view",
        "risks.view", "decisions.view", "governance.view", "compliance.view",
        "demands.view_own", "budget.view", "raf.view", "trains.view",
    }
    if permission in _READ_ONLY_PERMS:
        return

    raise HTTPException(status_code=403, detail="Droits insuffisants")
