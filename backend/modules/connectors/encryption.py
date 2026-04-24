"""
Chiffrement AES (Fernet / AES-128-CBC + HMAC-SHA256) pour les credentials connecteurs.
La clé doit être une variable d'environnement ENCRYPTION_KEY (base64 URL-safe 32 octets).
En dev, une clé déterministe est utilisée en fallback.
"""
import os
import base64
import hashlib
import json
from cryptography.fernet import Fernet

ENCRYPTION_KEY = os.environ.get("ENCRYPTION_KEY", "")

_SENSITIVE_KEYS = {"api_token", "password", "client_secret", "token", "access_token", "pat"}


def _get_fernet() -> Fernet:
    key = ENCRYPTION_KEY
    if key:
        try:
            return Fernet(key.encode() if isinstance(key, str) else key)
        except Exception:
            pass
    # Fallback déterministe pour dev
    raw = hashlib.sha256(b"projetenne-connectors-dev-key-v1").digest()
    return Fernet(base64.urlsafe_b64encode(raw))


def encrypt_credentials(creds: dict) -> str:
    """Chiffre un dict de credentials → ciphertext base64."""
    f = _get_fernet()
    return f.encrypt(json.dumps(creds).encode()).decode()


def decrypt_credentials(ciphertext: str) -> dict:
    """Déchiffre un ciphertext → dict de credentials."""
    if not ciphertext:
        return {}
    try:
        f = _get_fernet()
        return json.loads(f.decrypt(ciphertext.encode()))
    except Exception:
        return {}


def mask_credentials(creds: dict) -> dict:
    """Remplace les valeurs sensibles par '••••••••'."""
    return {
        k: "••••••••" if (k in _SENSITIVE_KEYS and v) else v
        for k, v in creds.items()
    }
