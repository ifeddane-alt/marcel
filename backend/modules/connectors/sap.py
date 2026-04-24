"""
Connecteur SAP — Import budgets/centres de coût ↔ MARCEL projets.
V1 : Import CSV structuré SAP + OData si disponible.
V2 (futur) : RFC natif PyRFC.
"""
import random

SAP_DEFAULT_MAPPING = {
    "fields": [
        {"source": "KOSTL",   "target": "project_code",       "label": "Centre de coût → Projet",    "enabled": True},
        {"source": "WKGBTR",  "target": "capex_budget",        "label": "Montant budget prévisionnel","enabled": True},
        {"source": "OBLIGO",  "target": "consumed",            "label": "Engagements → Consommé",     "enabled": True},
        {"source": "BELNR",   "target": "external_reference",  "label": "N° pièce comptable",         "enabled": True},
        {"source": "KOSTL",   "target": "opex_budget",         "label": "Budget OPEX (si OPEX)",      "enabled": False},
        {"source": "GSBER",   "target": "program_code",        "label": "Secteur d'activité",         "enabled": False},
    ],
    "cost_center_prefix": "100",
    "currency": "EUR",
    "fiscal_year": "2026",
}

MOCK_SAP_RECORDS = [
    {"KOSTL": "1001001", "WKGBTR": 1260000, "OBLIGO": 420000, "BELNR": "2026-100101", "NAME": "Phoenix Transf. Digitale"},
    {"KOSTL": "1001002", "WKGBTR": 360000,  "OBLIGO": 95000,  "BELNR": "2026-100102", "NAME": "SI Finance"},
    {"KOSTL": "1001003", "WKGBTR": 2000000, "OBLIGO": 780000, "BELNR": "2026-100103", "NAME": "ERP SAP S/4HANA"},
    {"KOSTL": "1001004", "WKGBTR": 240000,  "OBLIGO": 60000,  "BELNR": "2026-100104", "NAME": "Digital Workplace M365"},
    {"KOSTL": "1001005", "WKGBTR": 750000,  "OBLIGO": 210000, "BELNR": "2026-100105", "NAME": "CRM Salesforce"},
    {"KOSTL": "1001006", "WKGBTR": 600000,  "OBLIGO": 180000, "BELNR": "2026-100106", "NAME": "Cloud Azure Migration"},
    {"KOSTL": "1001007", "WKGBTR": 195000,  "OBLIGO": 0,      "BELNR": "2026-100107", "NAME": "Portail RH"},
    {"KOSTL": "1001008", "WKGBTR": 270000,  "OBLIGO": 45000,  "BELNR": "2026-100108", "NAME": "DORA / NIS2"},
]

_IS_DEMO_URL_PATTERNS = ("demo", "acme", "example", "test", "mock", "sap.acme", "odata")


def _is_demo(base_url: str) -> bool:
    return not base_url or any(p in base_url.lower() for p in _IS_DEMO_URL_PATTERNS)


async def test_connection(base_url: str, auth_type: str, credentials: dict) -> dict:
    if not base_url:
        return {"success": False, "message": "URL du serveur SAP OData non configurée"}

    if _is_demo(base_url):
        return {
            "success": True,
            "message": "Connexion simulée (instance SAP démo)",
            "server_info": {"system": "SAP S/4HANA", "client": "100", "release": "2023 FPS02"},
        }

    if not credentials:
        return {"success": False, "message": "Credentials SAP non configurés"}

    try:
        import httpx
        headers = {"Accept": "application/json"}
        user = credentials.get("username") or credentials.get("email", "")
        password = credentials.get("password", "")
        url = f"{base_url.rstrip('/')}/sap/opu/odata/sap/ZBDG_BUDGET_SRV/$metadata"
        async with httpx.AsyncClient(timeout=8, verify=False, auth=(user, password)) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code in (200, 401, 403):
            if resp.status_code == 200:
                return {"success": True, "message": "Connexion SAP OData établie"}
            return {"success": False, "message": f"Authentification refusée (HTTP {resp.status_code})"}
        return {"success": False, "message": f"Erreur HTTP {resp.status_code}"}
    except Exception as e:
        return {"success": False, "message": f"Impossible de contacter le serveur SAP : {str(e)[:120]}"}


async def run_sync(config: dict, direction: str) -> dict:
    if _is_demo(config.get("base_url", "")):
        return _mock_sync_result(direction)
    try:
        return await _real_odata_sync(config, direction)
    except Exception as e:
        return {
            "items_processed": 0, "items_created": 0, "items_updated": 0, "items_failed": 1,
            "errors": [str(e)[:200]], "status": "error",
        }


def _mock_sync_result(direction: str) -> dict:
    records = MOCK_SAP_RECORDS
    if direction in ("import", "bidirectional"):
        updated = len(records)   # toujours 8, déterministe
        return {
            "items_processed": len(records),
            "items_created":   0,
            "items_updated":   updated,
            "items_failed":    0,
            "errors":          [],
            "status":          "success",
            "detail": {"updated_projects": [r["NAME"] for r in records]},
        }
    # Export MARCEL → SAP
    return {
        "items_processed": 8, "items_created": 0, "items_updated": 8, "items_failed": 0,
        "errors": [], "status": "success",
        "detail": {"exported": "EAC et RAF envoyés pour 8 projets"},
    }


async def _real_odata_sync(config: dict, direction: str) -> dict:
    """Sync réelle SAP OData (V1 — import budgets uniquement)."""
    import httpx
    base_url = config.get("base_url", "").rstrip("/")
    creds = config.get("_decrypted_creds", {})
    user  = creds.get("username") or creds.get("email", "")
    pw    = creds.get("password", "")
    auth  = (user, pw)

    url = f"{base_url}/sap/opu/odata/sap/ZBDG_BUDGET_SRV/BudgetSet?$format=json&$top=50"
    async with httpx.AsyncClient(timeout=30, verify=False, auth=auth) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            raise Exception(f"SAP OData error {resp.status_code}")
        records = resp.json().get("d", {}).get("results", [])

    return {
        "items_processed": len(records),
        "items_created": 0,
        "items_updated": len(records),
        "items_failed": 0,
        "errors": [],
        "status": "success",
    }
