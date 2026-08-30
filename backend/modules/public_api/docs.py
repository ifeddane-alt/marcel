"""OpenAPI + Swagger UI DÉDIÉS à l'API publique v1 (ne documente que /api/v1/*)."""
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import JSONResponse, HTMLResponse

from core.public_api import SCOPES

_SCOPE_DESC = {
    "projects.read": "Lire les projets", "programs.read": "Lire les programmes",
    "portfolio.read": "Lire la synthèse portefeuille", "budgets.read": "Lire les budgets projets",
    "milestones.read": "Lire les jalons", "risks.read": "Lire les risques",
    "dependencies.read": "Lire les dépendances", "capacity.read": "Lire la capacité",
    "decisions.read": "Lire les décisions", "applications.read": "Lire les applications",
    "incidents.read": "Lire les incidents / Run",
}


def register_public_docs(app: FastAPI):
    @app.get("/api/v1/openapi.json", include_in_schema=False)
    async def public_openapi():
        public_routes = [
            r for r in app.routes
            if getattr(r, "path", "").startswith("/api/v1/")
            and "GET" in getattr(r, "methods", set())
            and not getattr(r, "path", "").endswith(("/openapi.json", "/docs"))
        ]
        schema = get_openapi(
            title="MARCEL — API Publique",
            version="1.0.0",
            summary="API REST publique MARCEL (lecture seule). Authentification par token tenant.",
            description=(
                "API publique versionnée en lecture seule.\n\n"
                "**Authentification** : header `Authorization: Bearer <token>` ou `X-API-Key: <token>`.\n"
                "Le `tenant_id` est dérivé du token — jamais fourni par le client.\n\n"
                "**Scopes** : un token n'accède qu'aux domaines autorisés.\n\n"
                "**Pagination** : `?page=1&limit=50` (limit max 100). **Tri** : `?sort=-created_at`. "
                "**Filtres** : paramètres simples par champ (ex. `?status=actif`).\n\n"
                "**Codes d'erreur** : 401 (token invalide/révoqué/expiré), 403 (scope manquant), "
                "404 (ressource inconnue), 429 (rate limit — voir `Retry-After`).\n\n"
                "**Gestion des tokens** (admin tenant) : `POST /api/admin/api-tokens` (création, "
                "token affiché une seule fois), `/rotate` (rotation), `DELETE` (révocation)."
            ),
            routes=public_routes,
        )
        schema.setdefault("components", {})["securitySchemes"] = {
            "BearerToken": {"type": "http", "scheme": "bearer",
                            "description": "Token API tenant : `Authorization: Bearer mrcl_live_...`"},
            "ApiKeyHeader": {"type": "apiKey", "in": "header", "name": "X-API-Key",
                             "description": "Alternative : `X-API-Key: mrcl_live_...`"},
        }
        schema["security"] = [{"BearerToken": []}, {"ApiKeyHeader": []}]
        schema["x-scopes"] = _SCOPE_DESC
        schema["x-example-curl"] = (
            "curl -H 'Authorization: Bearer mrcl_live_xxx' "
            "'https://marcel-ppm.com/api/v1/projects?status=actif&sort=-business_value&page=1&limit=20'"
        )
        return JSONResponse(schema)

    @app.get("/api/v1/docs", include_in_schema=False)
    async def public_docs():
        return get_swagger_ui_html(openapi_url="/api/v1/openapi.json", title="MARCEL — API Publique v1")

    _ = SCOPES  # scopes exposés via x-scopes
    return HTMLResponse  # (référence pour lint)
