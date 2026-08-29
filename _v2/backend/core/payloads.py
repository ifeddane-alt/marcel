"""Garde mass-assignment : empêche l'injection de champs privilégiés/internes
dans les payloads d'écriture reçus sous forme de dict brut.
"""
from fastapi import HTTPException

# Champs qu'un client ne doit JAMAIS pouvoir positionner via un payload d'écriture.
PROTECTED_FIELDS = {
    "tenant_id", "company_id",
    "user_id", "owner_id", "created_by", "updated_by",
    "role", "roles", "permissions", "perm_version", "is_admin", "is_superuser",
    "password", "password_hash", "hashed_password",
    "_id", "created_at", "updated_at",
}


def strip_protected(data: dict) -> dict:
    """Retourne une copie du dict sans les champs protégés (silencieux, non bloquant)."""
    if not isinstance(data, dict):
        return data
    return {k: v for k, v in data.items() if k not in PROTECTED_FIELDS}


def reject_protected(data: dict) -> None:
    """Lève 400 si le payload contient un champ protégé (mode strict)."""
    if not isinstance(data, dict):
        return
    bad = sorted(set(data) & PROTECTED_FIELDS)
    if bad:
        raise HTTPException(status_code=400, detail=f"Champs non autorisés dans le payload : {', '.join(bad)}")
