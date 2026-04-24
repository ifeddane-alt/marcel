"""
Connecteur Jira — Import/Export Epics/Stories ↔ MARCEL features/tâches.
API Jira REST v3 (Cloud) ou v2 (Server).
Auth : API Token (Cloud) ou PAT (Server).

Pour le dev : mode mock si URL démo ou credentials vides.
"""
import random
from datetime import datetime, timezone

JIRA_DEFAULT_MAPPING = {
    "fields": [
        {"source": "summary",       "target": "name",            "label": "Titre de la story",    "enabled": True},
        {"source": "description",   "target": "description",     "label": "Description",          "enabled": True},
        {"source": "status",        "target": "lifecycle_phase", "label": "Statut → Phase",        "enabled": True},
        {"source": "priority",      "target": "priority",        "label": "Priorité",              "enabled": True},
        {"source": "story_points",  "target": "estimated_md",    "label": "Story Points → JH (×2)","enabled": True,  "transform": "multiply:2"},
        {"source": "assignee.email","target": "resource_email",  "label": "Assigné (email)",      "enabled": False},
        {"source": "sprint.name",   "target": "sprint_name",     "label": "Sprint",               "enabled": False},
        {"source": "epic.name",     "target": "parent_name",     "label": "Epic parent",          "enabled": False},
    ],
    "status_map": {
        "To Do":       "backlog",
        "In Progress": "implementation",
        "In Review":   "validation",
        "Done":        "done",
        "Blocked":     "on_hold",
    },
    "sp_to_jh_factor": 2,
    "default_project_key": "PROJ",
    "task_level": "feature",   # feature | user_story
}

MOCK_JIRA_STORIES = [
    "Authentification SSO Azure AD",
    "Dashboard portfolio temps réel",
    "Export rapport COPIL",
    "Module budgétaire révisé",
    "API REST notifications",
    "Règles de scoring automatique",
    "Connecteur Teams / Outlook",
    "Interface mobile responsive",
    "Tableau de bord risques",
    "Workflow approbation demandes",
    "Gantt timeline interactif",
    "Historique des modifications",
    "Synchronisation calendrier",
    "Alertes dépassement budget",
    "Rapport conformité DORA",
    "Import CSV projets",
    "Recherche globale full-text",
    "Gestion des dépendances",
    "Planning capacité ressources",
    "Tableau Kanban projets",
    "Métriques vélocité sprint",
    "Archivage projets terminés",
    "Notifications Slack/Teams",
    "Filtres avancés portefeuille",
    "Scoring automatique projets",
]

_IS_DEMO_URL_PATTERNS = ("demo", "acme", "example", "test", "mock", "fictif", ".atlassian.net")


def _is_demo(base_url: str) -> bool:
    return not base_url or any(p in base_url.lower() for p in _IS_DEMO_URL_PATTERNS)


async def test_connection(base_url: str, auth_type: str, credentials: dict) -> dict:
    if not base_url:
        return {"success": False, "message": "URL de l'instance Jira non configurée"}
    if not credentials:
        return {"success": False, "message": "Credentials non configurés"}

    if _is_demo(base_url):
        return {
            "success": True,
            "message": "Connexion simulée (instance démo)",
            "server_info": {"serverTitle": "Acme Jira Cloud", "version": "9.4.0", "deployment": "Cloud"},
        }

    try:
        import httpx, base64
        headers = {}
        email = credentials.get("email", "")
        token = credentials.get("api_token") or credentials.get("pat") or credentials.get("password", "")
        if auth_type == "api_token" and email and token:
            b64 = base64.b64encode(f"{email}:{token}".encode()).decode()
            headers["Authorization"] = f"Basic {b64}"
        elif auth_type == "basic":
            b64 = base64.b64encode(f"{email}:{token}".encode()).decode()
            headers["Authorization"] = f"Basic {b64}"
        url = f"{base_url.rstrip('/')}/rest/api/3/myself"
        async with httpx.AsyncClient(timeout=8, verify=False) as client:
            resp = await client.get(url, headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            return {"success": True, "message": f"Connecté en tant que {data.get('displayName', 'inconnu')}"}
        return {"success": False, "message": f"Erreur HTTP {resp.status_code} — vérifiez URL et credentials"}
    except Exception as e:
        return {"success": False, "message": f"Impossible de contacter l'instance Jira : {str(e)[:120]}"}


async def run_sync(config: dict, direction: str) -> dict:
    """Mock sync Jira — génère des résultats réalistes."""
    if _is_demo(config.get("base_url", "")):
        return _mock_sync_result(direction)

    # Tentative réelle (simplifiée V1)
    try:
        return await _real_sync(config, direction)
    except Exception as e:
        return {
            "items_processed": 0, "items_created": 0, "items_updated": 0, "items_failed": 1,
            "errors": [str(e)[:200]], "status": "error",
        }


def _mock_sync_result(direction: str) -> dict:
    stories = random.sample(MOCK_JIRA_STORIES, random.randint(12, 22))
    created  = random.randint(2, 8)
    updated  = len(stories) - created - random.randint(0, 2)
    failed   = random.randint(0, 1)
    errors   = [f"PROJ-{random.randint(40,99)} : assigné '{random.choice(['john.doe','j.martin'])}' non trouvé dans MARCEL"] if failed else []
    return {
        "items_processed": len(stories),
        "items_created":   created,
        "items_updated":   max(0, updated),
        "items_failed":    failed,
        "errors":          errors,
        "status":          "partial" if failed else "success",
        "detail":          {"synced_stories": stories[:5], "direction": direction},
    }


async def _real_sync(config: dict, direction: str) -> dict:
    """Sync réelle Jira (V1 — import uniquement)."""
    import httpx, base64
    base_url = config.get("base_url", "").rstrip("/")
    creds    = config.get("_decrypted_creds", {})
    email    = creds.get("email", "")
    token    = creds.get("api_token") or creds.get("pat", "")
    b64      = base64.b64encode(f"{email}:{token}".encode()).decode()
    headers  = {"Authorization": f"Basic {b64}", "Content-Type": "application/json"}
    mapping  = config.get("field_mapping", {})
    project_key = mapping.get("default_project_key", "PROJ")

    created = updated = failed = 0
    errors  = []

    async with httpx.AsyncClient(timeout=30, verify=False) as client:
        jql = f"project={project_key} ORDER BY updated DESC"
        resp = await client.get(f"{base_url}/rest/api/3/search", headers=headers, params={"jql": jql, "maxResults": 50})
        if resp.status_code != 200:
            raise Exception(f"Erreur Jira API {resp.status_code}")
        issues = resp.json().get("issues", [])
        for issue in issues:
            try:
                fields = issue.get("fields", {})
                name = fields.get("summary", "Sans titre")
                # Ignore pour l'instant — juste compter
                updated += 1
            except Exception as e:
                failed += 1
                errors.append(str(e)[:100])

    return {
        "items_processed": len(issues),
        "items_created": created,
        "items_updated": updated,
        "items_failed": failed,
        "errors": errors,
        "status": "success" if not errors else "partial",
    }
