"""SSO — OIDC (Google, Microsoft Entra ID) + SAML 2.0 SP-initiated, config par tenant."""
import base64
import json
import logging
import os
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException, Request

from core.database import db
from core.auth import create_token
from jose import jwt as jose_jwt, jwk

logger = logging.getLogger(__name__)

STATE_TTL_MIN = 10
TICKET_TTL_SEC = 60

_indexes_done = False


async def _ensure_indexes():
    global _indexes_done
    if _indexes_done:
        return
    await db.sso_states.create_index("expires_at", expireAfterSeconds=0)
    await db.sso_tickets.create_index("expires_at", expireAfterSeconds=0)
    await db.sso_replays.create_index("expires_at", expireAfterSeconds=0)
    _indexes_done = True


def _public_host(request: Request) -> tuple[str, str]:
    """(proto, host) publics — priorité : PUBLIC_BASE_URL env > x-forwarded-host > host."""
    env = os.environ.get("PUBLIC_BASE_URL", "").strip().rstrip("/")
    if env:
        proto, _, host = env.partition("://")
        return proto or "https", host
    if os.environ.get("MARCEL_ENV", "").lower() == "production":
        raise HTTPException(500, "PUBLIC_BASE_URL doit être configurée en production")
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    fwd_host = request.headers.get("x-forwarded-host", "")
    host = fwd_host.split(",")[0].strip() if fwd_host else request.headers.get("host", request.url.netloc)
    return proto, host


def base_url_of(request: Request) -> str:
    proto, host = _public_host(request)
    return f"{proto}://{host}"


# ─── Config tenant ────────────────────────────────────────────────────────────

async def get_sso_config(tenant_id: str) -> dict:
    tenant = await db.tenants.find_one({"tenant_id": tenant_id}, {"_id": 0, "settings": 1})
    return ((tenant or {}).get("settings") or {}).get("sso") or {}


async def resolve_tenant(email: str) -> tuple[str, dict | None]:
    """Retourne (tenant_id, user|None) pour un email. Fallback domaine si auto-provision."""
    email = email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        return user["tenant_id"], user
    domain = email.rsplit("@", 1)[-1]
    tenant = await db.tenants.find_one(
        {"settings.sso.allowed_domains": domain}, {"_id": 0, "tenant_id": 1}
    )
    if tenant:
        return tenant["tenant_id"], None
    raise HTTPException(404, "Aucun compte ni tenant SSO associé à cet email")


async def enabled_providers(email: str) -> list[str]:
    tenant_id, _ = await resolve_tenant(email)
    sso = await get_sso_config(tenant_id)
    out = []
    for p in ("google", "entra", "saml"):
        if (sso.get(p) or {}).get("enabled"):
            out.append(p)
    return out


# ─── Session utilisateur (commun OIDC/SAML) ──────────────────────────────────

async def _login_user(tenant_id: str, email: str, name: str, sso_cfg: dict) -> str:
    """Trouve/provisionne l'utilisateur, crée le JWT MARCEL, retourne un ticket one-shot."""
    email = (email or "").lower().strip()
    if not email:
        raise HTTPException(401, "Email absent de la réponse du fournisseur d'identité")

    user = await db.users.find_one({"email": email, "tenant_id": tenant_id}, {"_id": 0})
    if user and user.get("is_active") is False:
        raise HTTPException(403, "Compte désactivé — contactez votre administrateur")
    if not user:
        if not sso_cfg.get("auto_provision"):
            raise HTTPException(403, f"Aucun utilisateur {email} dans ce tenant (auto-provisioning désactivé)")
        user = {
            "user_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "email": email,
            "name": name or email,
            "role": "READ_ONLY",
            "profile_id": sso_cfg.get("default_profile_id"),
            "password_hash": "",
            "auth_source": "sso",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(dict(user))
        user.pop("_id", None)
        logger.info("[SSO] Utilisateur auto-provisionné : %s (tenant %s)", email, tenant_id)

    from modules.auth.router import _load_profile_data
    permissions, profile_name = await _load_profile_data(user)

    token = create_token({
        "tenant_id":   user["tenant_id"],
        "user_id":     user["user_id"],
        "email":       user["email"],
        "role":        user["role"],
        "name":        user["name"],
        "resource_id": user.get("resource_id"),
        "profile_id":  user.get("profile_id"),
        "permissions": permissions,
        "pv":          user.get("perm_version", 1),
    })
    user_data = {
        k: user.get(k)
        for k in ("user_id", "email", "name", "role", "tenant_id", "resource_id", "profile_id")
    }
    user_data["profile_name"] = profile_name

    code = secrets.token_urlsafe(24)
    await _ensure_indexes()
    await db.sso_tickets.insert_one({
        "_id": code,
        "payload": {
            "access_token": token,
            "token_type": "bearer",
            "user": user_data,
            "permissions": permissions,
        },
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=TICKET_TTL_SEC),
    })
    return code


async def exchange_ticket(code: str) -> dict:
    doc = await db.sso_tickets.find_one_and_delete({"_id": code})
    if not doc:
        raise HTTPException(401, "Code SSO invalide ou déjà utilisé")
    exp = doc["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(401, "Code SSO expiré")
    return doc["payload"]


# ─── OIDC (Google / Entra) ────────────────────────────────────────────────────

def _oidc_discovery_url(provider: str, pcfg: dict) -> str:
    if provider == "google":
        return "https://accounts.google.com/.well-known/openid-configuration"
    ms_tenant = (pcfg.get("ms_tenant") or "organizations").strip()
    return f"https://login.microsoftonline.com/{ms_tenant}/v2.0/.well-known/openid-configuration"


async def _fetch_discovery(provider: str, pcfg: dict) -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(_oidc_discovery_url(provider, pcfg))
        resp.raise_for_status()
        return resp.json()


async def oidc_login_url(provider: str, email: str, base_url: str) -> str:
    tenant_id, _ = await resolve_tenant(email)
    sso = await get_sso_config(tenant_id)
    pcfg = sso.get(provider) or {}
    if not pcfg.get("enabled") or not pcfg.get("client_id"):
        raise HTTPException(400, f"SSO {provider} non configuré pour ce tenant")

    disc = await _fetch_discovery(provider, pcfg)
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    await _ensure_indexes()
    await db.sso_states.insert_one({
        "_id": state,
        "tenant_id": tenant_id,
        "provider": provider,
        "nonce": nonce,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=STATE_TTL_MIN),
    })
    params = {
        "client_id": pcfg["client_id"],
        "response_type": "code",
        "scope": "openid email profile",
        "redirect_uri": f"{base_url}/api/auth/sso/callback/{provider}",
        "state": state,
        "nonce": nonce,
        "login_hint": email,
    }
    return f'{disc["authorization_endpoint"]}?{urlencode(params)}'


async def _verify_oidc_id_token(id_token: str, disc: dict, client_id: str) -> dict:
    try:
        header = jose_jwt.get_unverified_header(id_token)
    except Exception as exc:
        raise HTTPException(401, "ID token malformé") from exc
    alg = header.get("alg")
    if alg != "RS256":
        raise HTTPException(401, "Algorithme ID token non autorisé")
    kid = header.get("kid")
    if not kid or not disc.get("jwks_uri"):
        raise HTTPException(401, "Clé de signature OIDC introuvable")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(disc["jwks_uri"])
        r.raise_for_status()
        keys = r.json().get("keys") or []
    key_data = next((k for k in keys if k.get("kid") == kid and k.get("kty") == "RSA"), None)
    if not key_data:
        raise HTTPException(401, "Clé de signature OIDC inconnue")
    try:
        public_key = jwk.construct(key_data, algorithm="RS256").to_pem()
        return jose_jwt.decode(
            id_token, public_key, algorithms=["RS256"], audience=client_id,
            options={"verify_at_hash": False},
        )
    except Exception as exc:
        raise HTTPException(401, "Signature ou claims ID token invalides") from exc


async def oidc_callback(provider: str, code: str, state: str, base_url: str) -> str:
    st = await db.sso_states.find_one_and_delete({"_id": state})
    if not st or st["provider"] != provider:
        raise HTTPException(400, "State SSO invalide ou expiré")
    tenant_id = st["tenant_id"]
    sso = await get_sso_config(tenant_id)
    pcfg = sso.get(provider) or {}
    if not pcfg.get("enabled"):
        raise HTTPException(400, f"SSO {provider} désactivé")

    disc = await _fetch_discovery(provider, pcfg)
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(disc["token_endpoint"], data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": pcfg["client_id"],
            "client_secret": pcfg.get("client_secret", ""),
            "redirect_uri": f"{base_url}/api/auth/sso/callback/{provider}",
        })
    if resp.status_code != 200:
        logger.warning("[SSO] Échec échange code %s : HTTP %d", provider, resp.status_code)
        raise HTTPException(401, "Échec de l'échange du code d'autorisation")
    tokens = resp.json()
    claims = await _verify_oidc_id_token(tokens["id_token"], disc, pcfg["client_id"])

    # Validations (code flow confidentiel sur TLS : iss/aud/exp/nonce)
    now_ts = datetime.now(timezone.utc).timestamp()
    if claims.get("exp", 0) < now_ts:
        raise HTTPException(401, "ID token expiré")
    aud = claims.get("aud")
    if (aud if isinstance(aud, str) else (aud or [""])[0]) != pcfg["client_id"]:
        raise HTTPException(401, "Audience du token invalide")
    iss = claims.get("iss", "")
    if provider == "google" and iss not in ("https://accounts.google.com", "accounts.google.com"):
        raise HTTPException(401, "Émetteur du token invalide")
    if provider == "entra" and not iss.startswith("https://login.microsoftonline.com/"):
        raise HTTPException(401, "Émetteur du token invalide")
    if claims.get("nonce") != st.get("nonce"):
        raise HTTPException(401, "Nonce invalide")

    email = claims.get("email") or claims.get("preferred_username") or ""
    name = claims.get("name") or email
    return await _login_user(tenant_id, email, name, sso)


# ─── SAML 2.0 (SP-initiated) ─────────────────────────────────────────────────

def _cert_pem(value: str) -> str:
    value = (value or "").strip()
    if "BEGIN CERTIFICATE" in value:
        return value
    return (
        "-----BEGIN CERTIFICATE-----\n"
        + "\n".join(value[i:i + 64] for i in range(0, len(value), 64))
        + "\n-----END CERTIFICATE-----"
    )


def _saml_settings(tenant_id: str, scfg: dict, base_url: str) -> dict:
    return {
        "strict": True,
        "debug": False,
        "sp": {
            "entityId": f"{base_url}/api/auth/sso/saml/metadata/{tenant_id}",
            "assertionConsumerService": {
                "url": f"{base_url}/api/auth/sso/saml/acs/{tenant_id}",
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
            },
            "NameIDFormat": "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        },
        "idp": {
            "entityId": scfg["idp_entity_id"],
            "singleSignOnService": {
                "url": scfg["sso_url"],
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            },
            "x509cert": _cert_pem(scfg["x509_cert"]),
        },
        "security": {
            "authnRequestsSigned": False,
            "wantMessagesSigned": False,
            "wantAssertionsSigned": True,
            "wantNameId": True,
            "requestedAuthnContext": False,
        },
    }


def _saml_request_dict(request: Request, post_data: dict | None = None) -> dict:
    proto, host = _public_host(request)
    return {
        "https": "on" if proto == "https" else "off",
        "http_host": host,
        "server_port": "443" if proto == "https" else "80",
        "script_name": request.url.path,
        "get_data": dict(request.query_params),
        "post_data": post_data or {},
    }


async def _get_saml_cfg(tenant_id: str) -> tuple[dict, dict]:
    sso = await get_sso_config(tenant_id)
    scfg = sso.get("saml") or {}
    if not scfg.get("enabled") or not all(scfg.get(k) for k in ("idp_entity_id", "sso_url", "x509_cert")):
        raise HTTPException(400, "SSO SAML non configuré pour ce tenant")
    return sso, scfg


async def saml_login_url(email: str, request: Request) -> str:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth
    tenant_id, _ = await resolve_tenant(email)
    _, scfg = await _get_saml_cfg(tenant_id)
    base_url = base_url_of(request)
    state = secrets.token_urlsafe(32)
    await _ensure_indexes()
    await db.sso_states.insert_one({
        "_id": state,
        "tenant_id": tenant_id,
        "provider": "saml",
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=STATE_TTL_MIN),
    })
    auth = OneLogin_Saml2_Auth(
        _saml_request_dict(request), old_settings=_saml_settings(tenant_id, scfg, base_url)
    )
    return auth.login(return_to=state)


async def saml_acs(tenant_id: str, request: Request, form: dict) -> str:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth
    sso, scfg = await _get_saml_cfg(tenant_id)
    base_url = base_url_of(request)
    relay = str(form.get("RelayState", ""))

    state = await db.sso_states.find_one_and_delete({"_id": relay, "tenant_id": tenant_id})
    if not state:
        raise HTTPException(401, "État SAML invalide ou expiré")

    auth = OneLogin_Saml2_Auth(
        _saml_request_dict(request, {"SAMLResponse": str(form.get("SAMLResponse", "")), "RelayState": relay}),
        old_settings=_saml_settings(tenant_id, scfg, base_url),
    )
    try:
        auth.process_response()
    except Exception as exc:
        logger.warning("[SSO] SAML process_response erreur : %s", exc)
        raise HTTPException(401, "Réponse SAML invalide")
    if auth.get_errors() or not auth.is_authenticated():
        logger.warning("[SSO] SAML erreurs : %s", auth.get_errors())
        raise HTTPException(401, "Validation SAML échouée")

    # Anti-rejeu
    assertion_id = auth.get_last_assertion_id()
    if assertion_id:
        try:
            await db.sso_replays.insert_one({
                "_id": assertion_id,
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            })
        except Exception:
            raise HTTPException(401, "Assertion SAML rejouée")

    attrs = auth.get_attributes() or {}
    name_id = auth.get_nameid() or ""
    email = (
        (attrs.get("email") or attrs.get("mail")
         or attrs.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")
         or [name_id])[0]
    )
    name = (attrs.get("displayName") or attrs.get("cn")
            or attrs.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name")
            or [email])[0]
    return await _login_user(tenant_id, email, name, sso)


async def saml_metadata(tenant_id: str, request: Request) -> str:
    from onelogin.saml2.settings import OneLogin_Saml2_Settings
    _, scfg = await _get_saml_cfg(tenant_id)
    settings = OneLogin_Saml2_Settings(
        settings=_saml_settings(tenant_id, scfg, base_url_of(request)), sp_validation_only=True
    )
    metadata = settings.get_sp_metadata()
    errors = settings.validate_metadata(metadata)
    if errors:
        raise HTTPException(500, f"Métadonnées SP invalides : {errors}")
    return metadata if isinstance(metadata, str) else metadata.decode()
