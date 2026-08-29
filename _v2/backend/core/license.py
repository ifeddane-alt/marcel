"""
MARCEL PPM — Système de licence on-premise.
Chaque client reçoit une clé de licence générée par vous.
La clé encode : customer, domain, expiry, max_users, signé HMAC-SHA256.
"""
import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone

# Clé maître MARCEL — ne jamais exposer ni changer
# Vous seul pouvez générer des clés valides
_MASTER_KEY = b"MARCEL-PPM-LICENSE-MASTER-KEY-2025-ALTAIR-INDUSTRIES"


def _sign(payload_b64: str) -> str:
    sig = hmac.new(_MASTER_KEY, payload_b64.encode(), hashlib.sha256).hexdigest()
    return sig[:32]  # 32 hex chars


def generate_license(customer: str, domain: str, expiry: str, max_users: int = 999) -> str:
    """
    Génère une clé de licence pour un client.
    Usage (chez vous) :
        python -c "from core.license import generate_license; print(generate_license('Société X', 'marcel.societex.com', '2027-12-31', 50))"
    """
    payload = {
        "customer": customer,
        "domain": domain,
        "expiry": expiry,
        "max_users": max_users,
        "issued": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig = _sign(payload_b64)
    return f"MARCEL-{payload_b64}.{sig}"


def validate_license(key: str) -> dict:
    """
    Valide une clé de licence.
    Retourne le payload si valide, lève une exception sinon.
    """
    if not key or not key.startswith("MARCEL-"):
        raise ValueError("Format de licence invalide")

    try:
        parts = key[7:].rsplit(".", 1)
        if len(parts) != 2:
            raise ValueError("Format de licence invalide")
        payload_b64, sig = parts
    except Exception:
        raise ValueError("Format de licence invalide")

    # Vérifier la signature
    expected_sig = _sign(payload_b64)
    if not hmac.compare_digest(sig, expected_sig):
        raise ValueError("Clé de licence invalide (signature incorrecte)")

    # Décoder le payload
    try:
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "==").decode())
    except Exception:
        raise ValueError("Clé de licence corrompue")

    # Vérifier l'expiration
    try:
        expiry = datetime.strptime(payload["expiry"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if expiry < datetime.now(timezone.utc):
            raise ValueError(
                f"Licence expirée le {payload['expiry']}. "
                "Contactez support@marcel-ppm.com pour renouveler."
            )
    except ValueError as e:
        if "expirée" in str(e) or "Licence" in str(e):
            raise
        raise ValueError("Date d'expiration invalide")

    return payload


def check_license_on_startup() -> dict:
    """
    Appelé au démarrage du serveur.
    Lit MARCEL_LICENSE_KEY depuis l'environnement.
    Si invalide/absente, lève une exception qui bloque le démarrage.
    """
    key = os.environ.get("MARCEL_LICENSE_KEY", "")

    # Mode développement (preview Emergent) — pas de licence requise
    if os.environ.get("SKIP_LICENSE_CHECK") == "true":
        return {"customer": "Development", "domain": "*", "expiry": "2099-12-31", "max_users": 9999}

    if not key:
        raise EnvironmentError(
            "MARCEL_LICENSE_KEY manquante dans le fichier .env. "
            "Contactez support@marcel-ppm.com pour obtenir votre clé de licence."
        )

    return validate_license(key)
