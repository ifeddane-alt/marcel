"""Garde uploads : limite de taille (anti-DoS) + allowlist d'extensions.

Les endpoints d'import lisent le fichier en mémoire ; sans borne, un gros fichier
sature la RAM du conteneur. read_upload_limited lit par blocs et coupe au-delà de la limite.
"""
from fastapi import HTTPException, UploadFile

DEFAULT_MAX_MB = 15
_CHUNK = 1024 * 1024  # 1 Mo


def _ext(filename: str) -> str:
    name = (filename or "").lower()
    return name[name.rfind("."):] if "." in name else ""


def validate_extension(file: UploadFile, allowed: set[str]) -> None:
    ext = _ext(file.filename or "")
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Type de fichier non autorisé ({ext or 'inconnu'}). Attendu : {', '.join(sorted(allowed))}",
        )


async def read_upload_limited(file: UploadFile, allowed: set[str], max_mb: int = DEFAULT_MAX_MB) -> bytes:
    """Valide l'extension puis lit le contenu en bornant la taille (413 si dépassé)."""
    validate_extension(file, allowed)
    max_bytes = max_mb * 1024 * 1024
    buf = bytearray()
    while True:
        chunk = await file.read(_CHUNK)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise HTTPException(status_code=413, detail=f"Fichier trop volumineux (max {max_mb} Mo)")
    return bytes(buf)
