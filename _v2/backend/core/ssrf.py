"""Garde SSRF : valide les URL sortantes fournies par configuration (connecteurs, webhooks).

Bloque les cibles internes (loopback, RFC1918, link-local, metadata cloud) et les schémas
non http(s). La résolution DNS est vérifiée pour empêcher le rebinding vers une IP privée.
"""
import ipaddress
import os
import socket
from urllib.parse import urlparse

# Autorise la désactivation en dev/preview (ex. Jira demo) sans exposer la prod.
_BLOCKED_HOSTNAMES = {"localhost", "metadata", "metadata.google.internal"}


def _ip_is_blocked(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
        # Plage metadata cloud (AWS/GCP/Azure/Scaleway)
        or addr in ipaddress.ip_network("169.254.0.0/16")
    )


def validate_public_url(url: str, *, allow_http: bool = False) -> None:
    """Lève ValueError si l'URL cible une ressource interne ou un schéma interdit."""
    if not url:
        raise ValueError("URL vide")
    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    allowed_schemes = {"https"} | ({"http"} if allow_http else set())
    if scheme not in allowed_schemes:
        raise ValueError(f"Schéma non autorisé : {scheme or 'aucun'} (attendu {sorted(allowed_schemes)})")
    host = parsed.hostname
    if not host:
        raise ValueError("Hôte manquant dans l'URL")
    if host.lower() in _BLOCKED_HOSTNAMES:
        raise ValueError("Hôte interne interdit")
    # Résolution DNS → toutes les IP doivent être publiques
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if scheme == "https" else 80),
                                   proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise ValueError(f"Résolution DNS impossible pour {host} : {e}")
    for info in infos:
        ip = info[4][0]
        if _ip_is_blocked(ip):
            raise ValueError(f"Cible interne interdite ({host} → {ip})")


def connector_tls_verify(config: dict | None = None) -> bool:
    """Politique TLS des connecteurs sortants.

    Vérification activée par défaut. Un opt-out par connecteur (config verify_tls=false)
    n'est honoré QUE hors production (MARCEL_ENV != production). En prod, jamais de bypass.
    """
    prod = os.environ.get("MARCEL_ENV", "").lower() == "production"
    if not prod and config and config.get("verify_tls") is False:
        return False
    return True
