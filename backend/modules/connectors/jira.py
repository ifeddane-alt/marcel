"""
Connecteur Jira — LECTURE SEULE (avancement des projets Jira → portefeuille MARCEL).
API Jira REST v3 (Cloud), auth Basic email + API token.
Mode simulation si l'URL contient demo/mock/example/fictif (aucun appel réseau).
"""
import asyncio
import base64
import random
from datetime import datetime, timezone

import httpx

from core.database import db
from core.ssrf import validate_public_url, hardened_async_client

JIRA_DEFAULT_MAPPING = {
    "fields": [
        {"source": "summary",        "target": "name",           "label": "Titre de l'issue",        "enabled": True},
        {"source": "statusCategory", "target": "progress",       "label": "Catégorie de statut → avancement", "enabled": True},
        {"source": "issuetype=Epic", "target": "epics",          "label": "Epics → lots",            "enabled": True},
    ],
    "status_map": {"To Do": "backlog", "In Progress": "implementation", "Done": "done"},
    "project_links": [],
}

_DEMO_URL_PATTERNS = ("demo", "example", "mock", "fictif")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_demo(base_url: str) -> bool:
    return not base_url or any(p in base_url.lower() for p in _DEMO_URL_PATTERNS)


def _ensure_safe(base_url: str) -> None:
    """Garde SSRF : bloque toute cible interne avant un appel réseau réel."""
    validate_public_url(base_url.rstrip("/"))


def _auth_headers(credentials: dict) -> dict:
    email = credentials.get("email", "")
    token = credentials.get("api_token") or credentials.get("pat") or credentials.get("password", "")
    b64 = base64.b64encode(f"{email}:{token}".encode()).decode()
    return {"Authorization": f"Basic {b64}", "Accept": "application/json"}


async def _request(client: httpx.AsyncClient, method: str, path: str, **kwargs) -> dict:
    """Requête avec retry sur 429/5xx (backoff)."""
    last_status = None
    for attempt in range(4):
        resp = await client.request(method, path, **kwargs)
        last_status = resp.status_code
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            delay = float(retry_after) if retry_after else min(2 ** attempt, 8)
            await asyncio.sleep(delay + random.random() * 0.5)
            continue
        if resp.status_code in (502, 503, 504) and attempt < 3:
            await asyncio.sleep(min(2 ** attempt, 4))
            continue
        if resp.status_code >= 400:
            try:
                body = resp.json()
                msg = "; ".join(body.get("errorMessages", [])) or str(body)[:200]
            except Exception:
                msg = resp.text[:200]
            raise Exception(f"Jira {resp.status_code} : {msg}")
        return resp.json()
    raise Exception(f"Jira rate limit ({last_status}) après plusieurs tentatives")


async def test_connection(base_url: str, auth_type: str, credentials: dict) -> dict:
    if not base_url:
        return {"success": False, "message": "URL de l'instance Jira non configurée"}
    if not credentials:
        return {"success": False, "message": "Credentials non configurés"}
    if _is_demo(base_url):
        return {
            "success": True,
            "message": "Connexion simulée (instance démo)",
            "server_info": {"serverTitle": "Jira Cloud (simulation)", "deployment": "Cloud"},
        }
    try:
        _ensure_safe(base_url)
        async with hardened_async_client(base_url=base_url.rstrip("/"), timeout=10,
                                     headers=_auth_headers(credentials)) as client:
            data = await _request(client, "GET", "/rest/api/3/myself")
        return {"success": True, "message": f"Connecté en tant que {data.get('displayName', 'inconnu')}"}
    except ValueError as e:
        return {"success": False, "message": f"URL refusée : {e}"}
    except Exception as e:
        return {"success": False, "message": f"Connexion impossible : {str(e)[:150]}"}


async def list_projects(config: dict) -> list:
    """Liste les projets Jira visibles (clé + nom) — lecture seule, paginée."""
    base_url = (config.get("base_url") or "").rstrip("/")
    creds = config.get("_decrypted_creds", {})
    if _is_demo(base_url):
        return [
            {"key": "WEB", "name": "Refonte Portail Web"},
            {"key": "MOB", "name": "Application Mobile"},
            {"key": "DATA", "name": "Plateforme Data"},
        ]
    results, start = [], 0
    _ensure_safe(base_url)
    async with hardened_async_client(base_url=base_url, timeout=15, headers=_auth_headers(creds)) as client:
        while True:
            page = await _request(client, "GET", "/rest/api/3/project/search",
                                  params={"startAt": start, "maxResults": 50})
            values = page.get("values", [])
            results.extend({"key": p["key"], "name": p["name"]} for p in values)
            if not values or start + len(values) >= page.get("total", len(results)):
                break
            start += len(values)
    return results


async def _search_count(client: httpx.AsyncClient, jql: str) -> tuple[int, int]:
    """Retourne (done, total) pour une JQL via /search/jql paginé (statusCategory)."""
    done = total = 0
    token = None
    for _ in range(50):
        body = {"jql": jql, "fields": ["statusCategory"], "maxResults": 100}
        if token:
            body["nextPageToken"] = token
        page = await _request(client, "POST", "/rest/api/3/search/jql", json=body)
        issues = page.get("issues", [])
        total += len(issues)
        done += sum(
            1 for i in issues
            if (i.get("fields", {}).get("statusCategory") or {}).get("key") == "done"
        )
        token = page.get("nextPageToken")
        if page.get("isLast", not token) or not token:
            break
    return done, total


async def project_summary(config: dict, jira_key: str) -> dict:
    """Avancement d'un projet Jira : issues done/total + epics done/total."""
    base_url = (config.get("base_url") or "").rstrip("/")
    creds = config.get("_decrypted_creds", {})
    if _is_demo(base_url):
        total = random.randint(40, 160)
        done = random.randint(10, total)
        et = random.randint(3, 9)
        return {"key": jira_key, "issues_done": done, "issues_total": total,
                "epics_done": random.randint(0, et), "epics_total": et}
    _ensure_safe(base_url)
    async with hardened_async_client(base_url=base_url, timeout=30, headers=_auth_headers(creds)) as client:
        done, total = await _search_count(client, f'project = "{jira_key}"')
        e_done, e_total = await _search_count(client, f'project = "{jira_key}" AND issuetype = Epic')
    return {"key": jira_key, "issues_done": done, "issues_total": total,
            "epics_done": e_done, "epics_total": e_total}


async def run_sync(config: dict, direction: str) -> dict:
    """Sync LECTURE SEULE : remonte l'avancement Jira sur les projets MARCEL liés."""
    tenant_id = config.get("tenant_id")
    links = (config.get("field_mapping") or {}).get("project_links") or []
    if not links:
        return {"items_processed": 0, "items_created": 0, "items_updated": 0, "items_failed": 0,
                "errors": ["Aucun projet lié — configurez les liaisons dans l'onglet Projets liés"],
                "status": "partial"}

    updated = failed = 0
    errors = []
    for link in links:
        project_id = link.get("project_id")
        jira_key = link.get("jira_key")
        if not project_id or not jira_key:
            continue
        try:
            s = await project_summary(config, jira_key)
            pct = round(s["issues_done"] / s["issues_total"] * 100) if s["issues_total"] else 0
            result = await db.projects.update_one(
                {"project_id": project_id, "tenant_id": tenant_id},
                {"$set": {"jira_sync": {
                    "jira_key": jira_key,
                    "issues_done": s["issues_done"],
                    "issues_total": s["issues_total"],
                    "epics_done": s["epics_done"],
                    "epics_total": s["epics_total"],
                    "progress_pct": pct,
                    "synced_at": _now(),
                }}},
            )
            if result.matched_count:
                updated += 1
            else:
                failed += 1
                errors.append(f"{jira_key} : projet MARCEL introuvable")
        except Exception as e:
            failed += 1
            errors.append(f"{jira_key} : {str(e)[:150]}")

    return {
        "items_processed": len(links),
        "items_created": 0,
        "items_updated": updated,
        "items_failed": failed,
        "errors": errors,
        "status": "success" if not failed else ("partial" if updated else "error"),
        "detail": {"direction": "import (lecture seule)"},
    }
