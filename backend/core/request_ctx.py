"""Contexte requête : extraction fiable de l'IP client derrière un reverse proxy.

X-Forwarded-For n'est CONSIDÉRÉ que si TRUSTED_PROXY est activé (on est bien derrière
nginx/Traefik). Sinon on retombe sur l'IP du pair TCP direct. On ne fait jamais
confiance aveuglément à un XFF fourni directement par Internet.
"""
import os


def _trusted_proxy() -> bool:
    return os.environ.get("TRUSTED_PROXY", "").lower() in ("1", "true", "yes")


def client_ip(request) -> str:
    if request is None:
        return "?"
    if _trusted_proxy():
        xff = request.headers.get("x-forwarded-for")
        if xff:
            # 1er hop = client d'origine (le proxy de confiance ajoute sa valeur en tête)
            return xff.split(",")[0].strip()
        real = request.headers.get("x-real-ip")
        if real:
            return real.strip()
    return request.client.host if getattr(request, "client", None) else "?"
