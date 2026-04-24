"""
Service principal Connecteurs.
Orchestre CRUD configs, sync, test connexion et logs.
"""
from fastapi import HTTPException
from datetime import datetime, timezone
import uuid

from core.database import db
from core.auth import TokenPayload
from .schemas import ConnectorConfigUpsert, MappingUpdate
from .encryption import encrypt_credentials, decrypt_credentials, mask_credentials
from . import jira as jira_mod
from . import sap as sap_mod
from . import servicenow as snow_mod

CONNECTOR_MODULES = {
    "jira":        jira_mod,
    "sap":         sap_mod,
    "servicenow":  snow_mod,
}

DEFAULT_MAPPINGS = {
    "jira":       jira_mod.JIRA_DEFAULT_MAPPING,
    "sap":        sap_mod.SAP_DEFAULT_MAPPING,
    "servicenow": snow_mod.SERVICENOW_DEFAULT_MAPPING,
}

CONNECTOR_META = {
    "jira": {
        "label": "Jira",
        "description": "Synchronisation Epics / Stories ↔ features & tâches MARCEL",
        "auth_types": ["api_token", "basic"],
        "auth_fields": {
            "api_token": [
                {"key": "email",     "label": "Email Jira",  "type": "email",    "required": True},
                {"key": "api_token", "label": "API Token",   "type": "password", "required": True},
            ],
            "basic": [
                {"key": "email",    "label": "Email",         "type": "email",    "required": True},
                {"key": "password", "label": "Mot de passe",  "type": "password", "required": True},
            ],
        },
        "help_url": "https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/",
    },
    "sap": {
        "label": "SAP",
        "description": "Synchronisation budgets & centres de coût SAP ↔ projets MARCEL",
        "auth_types": ["basic", "oauth2"],
        "auth_fields": {
            "basic": [
                {"key": "username", "label": "Utilisateur SAP", "type": "text",     "required": True},
                {"key": "password", "label": "Mot de passe",    "type": "password", "required": True},
            ],
            "oauth2": [
                {"key": "client_id",     "label": "Client ID",       "type": "text",     "required": True},
                {"key": "client_secret", "label": "Client Secret",   "type": "password", "required": True},
                {"key": "token_url",     "label": "Token URL",       "type": "url",      "required": True},
            ],
        },
        "help_url": "https://help.sap.com/docs/",
    },
    "servicenow": {
        "label": "ServiceNow",
        "description": "Synchronisation Change Requests / Incidents ↔ demandes & risques MARCEL",
        "auth_types": ["basic", "oauth2"],
        "auth_fields": {
            "basic": [
                {"key": "username", "label": "Utilisateur SNOW", "type": "text",     "required": True},
                {"key": "password", "label": "Mot de passe",     "type": "password", "required": True},
            ],
            "oauth2": [
                {"key": "client_id",     "label": "Client ID",     "type": "text",     "required": True},
                {"key": "client_secret", "label": "Client Secret", "type": "password", "required": True},
                {"key": "token_url",     "label": "Token URL",     "type": "url",      "required": True},
            ],
        },
        "help_url": "https://docs.servicenow.com/bundle/utah-application-development/page/integrate/inbound-rest/concept/c_TableAPI.html",
    },
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_admin_config(user: TokenPayload) -> None:
    perms = getattr(user, "permissions", None) or []
    if "*" in perms or "admin.config" in perms:
        return
    raise HTTPException(403, "Permission admin.config requise")


def _mask_config(config: dict) -> dict:
    """Masque les credentials et retourne le doc sans _id."""
    c = {k: v for k, v in config.items() if k != "_id"}
    raw_creds = c.pop("auth_credentials_enc", "") or ""
    if raw_creds:
        try:
            decrypted = decrypt_credentials(raw_creds)
            c["auth_credentials"] = mask_credentials(decrypted)
        except Exception:
            c["auth_credentials"] = {}
    else:
        c["auth_credentials"] = {}
    return c


# ─── CRUD configs ─────────────────────────────────────────────────────────────

async def list_all_configs(user: TokenPayload) -> list:
    result = []
    for ctype in ("jira", "sap", "servicenow"):
        cfg = await db.connector_configs.find_one(
            {"tenant_id": user.tenant_id, "type": ctype}
        )
        if cfg:
            result.append(_mask_config(cfg))
        else:
            # Config vide par défaut
            result.append({
                "connector_id": None,
                "type": ctype,
                "enabled": False,
                "base_url": "",
                "auth_type": "api_token" if ctype == "jira" else "basic",
                "auth_credentials": {},
                "field_mapping": DEFAULT_MAPPINGS.get(ctype, {}),
                "sync_direction": "bidirectional",
                "sync_frequency": "manual",
                "last_sync_at": None,
                "last_sync_status": None,
                "meta": CONNECTOR_META.get(ctype, {}),
            })
    return result


async def get_config(connector_type: str, user: TokenPayload) -> dict:
    cfg = await db.connector_configs.find_one(
        {"tenant_id": user.tenant_id, "type": connector_type}
    )
    if not cfg:
        return {
            "connector_id": None, "type": connector_type,
            "enabled": False, "base_url": "",
            "auth_type": "api_token" if connector_type == "jira" else "basic",
            "auth_credentials": {},
            "field_mapping": DEFAULT_MAPPINGS.get(connector_type, {}),
            "sync_direction": "bidirectional",
            "sync_frequency": "manual",
            "meta": CONNECTOR_META.get(connector_type, {}),
        }
    masked = _mask_config(cfg)
    masked["meta"] = CONNECTOR_META.get(connector_type, {})
    return masked


async def upsert_config(connector_type: str, data: ConnectorConfigUpsert, user: TokenPayload) -> dict:
    _require_admin_config(user)
    existing = await db.connector_configs.find_one(
        {"tenant_id": user.tenant_id, "type": connector_type}
    )

    updates: dict = {"updated_at": _now()}

    if data.enabled is not None:
        updates["enabled"] = data.enabled
    if data.base_url is not None:
        updates["base_url"] = data.base_url.rstrip("/") if data.base_url else ""
    if data.auth_type is not None:
        updates["auth_type"] = data.auth_type.value
    if data.field_mapping is not None:
        updates["field_mapping"] = data.field_mapping
    if data.sync_direction is not None:
        updates["sync_direction"] = data.sync_direction.value
    if data.sync_frequency is not None:
        updates["sync_frequency"] = data.sync_frequency.value

    # Chiffrement credentials — mise à jour uniquement si fournis et non masqués
    if data.auth_credentials:
        raw_new = data.auth_credentials
        masked_sentinel = "••••••••"
        # N'écraser que si au moins un champ non masqué est fourni
        has_real = any(v and v != masked_sentinel for v in raw_new.values() if isinstance(v, str))
        if has_real:
            if existing:
                # Fusionner avec les credentials existants
                existing_creds = decrypt_credentials(existing.get("auth_credentials_enc", ""))
                merged = {**existing_creds, **{k: v for k, v in raw_new.items() if v and v != masked_sentinel}}
            else:
                merged = {k: v for k, v in raw_new.items() if v and v != masked_sentinel}
            updates["auth_credentials_enc"] = encrypt_credentials(merged)

    if existing:
        await db.connector_configs.update_one(
            {"tenant_id": user.tenant_id, "type": connector_type},
            {"$set": updates},
        )
    else:
        doc = {
            "connector_id": str(uuid.uuid4()),
            "tenant_id":    user.tenant_id,
            "type":         connector_type,
            "enabled":      data.enabled or False,
            "base_url":     (data.base_url or "").rstrip("/"),
            "auth_type":    data.auth_type.value if data.auth_type else ("api_token" if connector_type == "jira" else "basic"),
            "auth_credentials_enc": encrypt_credentials(data.auth_credentials or {}),
            "field_mapping": data.field_mapping or DEFAULT_MAPPINGS.get(connector_type, {}),
            "sync_direction": (data.sync_direction.value if data.sync_direction else "bidirectional"),
            "sync_frequency": (data.sync_frequency.value if data.sync_frequency else "manual"),
            "created_at":   _now(),
            **updates,
        }
        doc.pop("updated_at", None)
        doc["created_at"] = _now()
        doc["updated_at"] = _now()
        await db.connector_configs.insert_one(doc)

    return await get_config(connector_type, user)


async def update_mapping(connector_type: str, data: MappingUpdate, user: TokenPayload) -> dict:
    _require_admin_config(user)
    await db.connector_configs.update_one(
        {"tenant_id": user.tenant_id, "type": connector_type},
        {"$set": {"field_mapping": data.field_mapping, "updated_at": _now()}},
        upsert=True,
    )
    return await get_config(connector_type, user)


# ─── Test connexion ───────────────────────────────────────────────────────────

async def test_connection(connector_type: str, user: TokenPayload) -> dict:
    cfg = await db.connector_configs.find_one(
        {"tenant_id": user.tenant_id, "type": connector_type}
    )
    if not cfg:
        return {"success": False, "message": "Connecteur non configuré. Enregistrez d'abord la configuration."}

    base_url = cfg.get("base_url", "")
    auth_type = cfg.get("auth_type", "basic")
    creds = decrypt_credentials(cfg.get("auth_credentials_enc", ""))

    mod = CONNECTOR_MODULES.get(connector_type)
    if not mod:
        raise HTTPException(400, f"Type de connecteur inconnu : {connector_type}")

    return await mod.test_connection(base_url, auth_type, creds)


# ─── Sync ─────────────────────────────────────────────────────────────────────

async def trigger_sync(connector_type: str, user: TokenPayload) -> dict:
    _require_admin_config(user)
    cfg = await db.connector_configs.find_one(
        {"tenant_id": user.tenant_id, "type": connector_type}
    )
    if not cfg:
        raise HTTPException(400, "Connecteur non configuré")

    mod = CONNECTOR_MODULES.get(connector_type)
    if not mod:
        raise HTTPException(400, f"Type de connecteur inconnu : {connector_type}")

    direction = cfg.get("sync_direction", "bidirectional")
    started_at = _now()

    # Créer un log "running"
    log_id = str(uuid.uuid4())
    running_log = {
        "log_id":          log_id,
        "tenant_id":       user.tenant_id,
        "connector_type":  connector_type,
        "started_at":      started_at,
        "finished_at":     None,
        "direction":       direction,
        "items_processed": 0,
        "items_created":   0,
        "items_updated":   0,
        "items_failed":    0,
        "errors":          [],
        "status":          "running",
    }
    await db.sync_logs.insert_one(running_log)

    # Enrichir config avec credentials déchiffrés (pour module)
    cfg_enriched = dict(cfg)
    cfg_enriched["_decrypted_creds"] = decrypt_credentials(cfg.get("auth_credentials_enc", ""))

    # Lancer la sync
    result = await mod.run_sync(cfg_enriched, direction)
    finished_at = _now()

    # Mettre à jour le log
    log_update = {
        "finished_at":     finished_at,
        "items_processed": result.get("items_processed", 0),
        "items_created":   result.get("items_created", 0),
        "items_updated":   result.get("items_updated", 0),
        "items_failed":    result.get("items_failed", 0),
        "errors":          result.get("errors", []),
        "status":          result.get("status", "error"),
    }
    await db.sync_logs.update_one({"log_id": log_id}, {"$set": log_update})

    # Mettre à jour connector_config
    await db.connector_configs.update_one(
        {"tenant_id": user.tenant_id, "type": connector_type},
        {"$set": {
            "last_sync_at":     finished_at,
            "last_sync_status": result.get("status", "error"),
            "last_sync_error":  result.get("errors", [""])[0] if result.get("errors") else None,
        }},
    )

    return {**log_update, "log_id": log_id, "detail": result.get("detail")}


# ─── Statut et logs ───────────────────────────────────────────────────────────

async def get_status(connector_type: str, user: TokenPayload) -> dict:
    cfg = await db.connector_configs.find_one(
        {"tenant_id": user.tenant_id, "type": connector_type},
        {"_id": 0, "auth_credentials_enc": 0},
    )
    if not cfg:
        return {
            "type": connector_type,
            "enabled": False,
            "configured": False,
            "last_sync_at": None,
            "last_sync_status": None,
        }
    cfg.pop("_id", None)
    cfg["configured"] = bool(cfg.get("base_url"))
    return cfg


async def get_logs(connector_type: str, user: TokenPayload, limit: int = 20) -> list:
    logs = await db.sync_logs.find(
        {"tenant_id": user.tenant_id, "connector_type": connector_type},
        {"_id": 0},
    ).sort("started_at", -1).limit(limit).to_list(None)
    return logs
