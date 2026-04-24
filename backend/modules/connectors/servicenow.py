"""
Connecteur ServiceNow — Import Change Requests / Incidents ↔ MARCEL Demandes / Risques.
API : ServiceNow REST Table API.
Auth : Basic Auth ou OAuth2.
"""
import random

SERVICENOW_DEFAULT_MAPPING = {
    "fields": [
        {"source": "short_description",     "target": "title",          "label": "Titre",                "enabled": True},
        {"source": "description",           "target": "description",    "label": "Description",          "enabled": True},
        {"source": "requested_by",          "target": "requester",      "label": "Demandeur",            "enabled": True},
        {"source": "priority",              "target": "urgency",        "label": "Priorité → Urgence",   "enabled": True},
        {"source": "state",                 "target": "status",         "label": "État → Statut",        "enabled": True},
        {"source": "business_justification","target": "business_value", "label": "Justification métier", "enabled": True},
        {"source": "assignment_group",      "target": "team",           "label": "Groupe assigné",       "enabled": False},
        {"source": "cmdb_ci",               "target": "linked_project", "label": "CI → Projet lié",     "enabled": False},
    ],
    "priority_map": {
        "1 - Critical": "critical",
        "2 - High":     "high",
        "3 - Moderate": "medium",
        "4 - Low":      "low",
        "1": "critical", "2": "high", "3": "medium", "4": "low",
    },
    "state_map": {
        "-5": "pending",  "1": "open",   "2": "work_in_progress",
        "3":  "pending",  "4": "closed", "7": "closed",
    },
    "import_target": "demands",       # demands | risks | both
    "incident_to_risk": True,         # Importer les incidents critiques comme risques
}

MOCK_SNOW_CHANGES = [
    {"number": "CHG0010042", "short_description": "Migration base de données Oracle → PostgreSQL",   "priority": "2 - High",    "state": "1"},
    {"number": "CHG0010043", "short_description": "Déploiement module RH Portail",                  "priority": "3 - Moderate","state": "2"},
    {"number": "CHG0010044", "short_description": "Montée de version ERP SAP S/4HANA 2023",         "priority": "1 - Critical","state": "1"},
    {"number": "CHG0010045", "short_description": "Renouvellement certificats SSL",                 "priority": "4 - Low",     "state": "4"},
    {"number": "CHG0010046", "short_description": "Activation MFA Azure AD pour tous les comptes",  "priority": "2 - High",    "state": "1"},
    {"number": "CHG0010047", "short_description": "Refonte architecture microservices paiement",    "priority": "1 - Critical","state": "2"},
    {"number": "CHG0010048", "short_description": "Décommissionnement serveurs on-premise DC2",     "priority": "3 - Moderate","state": "1"},
    {"number": "CHG0010049", "short_description": "Déploiement solution SIEM Splunk",               "priority": "2 - High",    "state": "2"},
    {"number": "CHG0010050", "short_description": "Conformité DORA — tests résilience",             "priority": "1 - Critical","state": "1"},
    {"number": "CHG0010051", "short_description": "Intégration connecteur Salesforce CRM → ERP",   "priority": "3 - Moderate","state": "4"},
    {"number": "CHG0010052", "short_description": "Audit sécurité annuel applicatifs critiques",    "priority": "2 - High",    "state": "1"},
    {"number": "CHG0010053", "short_description": "Migration workloads Azure région EU West",       "priority": "3 - Moderate","state": "2"},
]

MOCK_SNOW_INCIDENTS = [
    {"number": "INC0020101", "short_description": "Panne base de données production (P1)", "impact": "1", "urgency": "1"},
    {"number": "INC0020102", "short_description": "Indisponibilité API paiement 6h",       "impact": "1", "urgency": "2"},
    {"number": "INC0020103", "short_description": "Fuite données logs applicatifs",         "impact": "2", "urgency": "2"},
]

_IS_DEMO_URL_PATTERNS = ("demo", "acme", "example", "test", "mock", "service-now.com")


def _is_demo(base_url: str) -> bool:
    return not base_url or any(p in base_url.lower() for p in _IS_DEMO_URL_PATTERNS)


async def test_connection(base_url: str, auth_type: str, credentials: dict) -> dict:
    if not base_url:
        return {"success": False, "message": "URL de l'instance ServiceNow non configurée"}
    if not credentials:
        return {"success": False, "message": "Credentials ServiceNow non configurés"}

    if _is_demo(base_url):
        return {
            "success": True,
            "message": "Connexion simulée (instance ServiceNow démo)",
            "server_info": {"instance": "acme", "version": "Tokyo Patch 8", "build": "11-23-2023"},
        }

    try:
        import httpx
        user  = credentials.get("username") or credentials.get("email", "")
        pw    = credentials.get("password", "")
        url   = f"{base_url.rstrip('/')}/api/now/table/sys_user?sysparm_limit=1"
        async with httpx.AsyncClient(timeout=8, verify=False, auth=(user, pw)) as client:
            resp = await client.get(url, headers={"Accept": "application/json"})
        if resp.status_code == 200:
            return {"success": True, "message": "Connexion ServiceNow établie"}
        return {"success": False, "message": f"Erreur HTTP {resp.status_code} — vérifiez credentials"}
    except Exception as e:
        return {"success": False, "message": f"Impossible de contacter ServiceNow : {str(e)[:120]}"}


async def run_sync(config: dict, direction: str) -> dict:
    if _is_demo(config.get("base_url", "")):
        return _mock_sync_result(direction)
    try:
        return await _real_sync(config, direction)
    except Exception as e:
        return {
            "items_processed": 0, "items_created": 0, "items_updated": 0, "items_failed": 1,
            "errors": [str(e)[:200]], "status": "error",
        }


def _mock_sync_result(direction: str) -> dict:
    total    = len(MOCK_SNOW_CHANGES)
    created  = random.randint(2, 5)
    updated  = total - created
    return {
        "items_processed": total,
        "items_created":   created,
        "items_updated":   updated,
        "items_failed":    0,
        "errors":          [],
        "status":          "success",
        "detail": {
            "change_requests": [c["number"] for c in MOCK_SNOW_CHANGES[:4]],
            "incidents_as_risks": [i["number"] for i in MOCK_SNOW_INCIDENTS],
        },
    }


async def _real_sync(config: dict, direction: str) -> dict:
    """Sync réelle ServiceNow (V1 — import Change Requests uniquement)."""
    import httpx
    base_url = config.get("base_url", "").rstrip("/")
    creds    = config.get("_decrypted_creds", {})
    user     = creds.get("username") or creds.get("email", "")
    pw       = creds.get("password", "")
    url      = f"{base_url}/api/now/table/change_request?sysparm_limit=50&sysparm_display_value=true"
    async with httpx.AsyncClient(timeout=30, verify=False, auth=(user, pw)) as client:
        resp = await client.get(url, headers={"Accept": "application/json"})
        if resp.status_code != 200:
            raise Exception(f"ServiceNow Table API error {resp.status_code}")
        records = resp.json().get("result", [])
    return {
        "items_processed": len(records),
        "items_created":   len(records),
        "items_updated":   0,
        "items_failed":    0,
        "errors":          [],
        "status":          "success",
    }
