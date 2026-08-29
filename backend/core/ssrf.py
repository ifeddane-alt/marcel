"""Garde SSRF : valide les URL sortantes fournies par configuration (connecteurs, webhooks).

Bloque les cibles internes (loopback, RFC1918, link-local, metadata cloud) et les schémas
non http(s). La résolution DNS est vérifiée pour empêcher le rebinding vers une IP privée.
"""
import asyncio
import ipaddress
import os
import socket
from urllib.parse import urlparse

import httpx

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


class _GuardedAsyncTransport(httpx.AsyncHTTPTransport):
    """Transport httpx durci : à CHAQUE connexion, re-résout l'hôte, refuse toute IP
    interne (anti-SSRF) et ÉPINGLE la connexion sur l'IP validée (anti-rebinding DNS :
    élimine la fenêtre TOCTOU entre validation et connexion). SNI/vérif TLS conservés
    sur le hostname d'origine. Les redirections ne sont pas suivies (réglé au client)."""

    async def handle_async_request(self, request):
        host = request.url.host
        scheme = request.url.scheme
        port = request.url.port or (443 if scheme == "https" else 80)
        loop = asyncio.get_event_loop()
        try:
            infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
        except socket.gaierror as e:
            raise httpx.ConnectError(f"Résolution DNS impossible pour {host} : {e}")
        pinned = None
        for info in infos:
            ip = info[4][0]
            if _ip_is_blocked(ip):
                raise httpx.ConnectError(f"Cible interne interdite ({host} → {ip})")
            if pinned is None:
                pinned = ip
        if pinned is None:
            raise httpx.ConnectError(f"Aucune IP résolue pour {host}")
        request.extensions = dict(request.extensions or {})
        request.extensions.setdefault("sni_hostname", host)
        original_url = request.url
        request.url = request.url.copy_with(host=pinned)
        try:
            return await super().handle_async_request(request)
        finally:
            request.url = original_url


def hardened_async_client(*, verify: bool = True, **kwargs) -> httpx.AsyncClient:
    """Client httpx durci anti-SSRF : valide + épingle l'IP à chaque connexion et ne
    suit jamais les redirections. À utiliser pour tout appel sortant vers une URL issue
    de configuration (connecteurs, webhooks, SSO/OIDC)."""
    kwargs.setdefault("follow_redirects", False)
    transport = _GuardedAsyncTransport(verify=verify)
    return httpx.AsyncClient(transport=transport, **kwargs)
