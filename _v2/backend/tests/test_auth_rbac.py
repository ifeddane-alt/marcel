"""
Tests — Auth : login, JWT, RBAC, rate limiting, ownership.
"""
import pytest
import pytest_asyncio
import httpx
from conftest import BASE_URL, CREDENTIALS, auth, _login

pytestmark = pytest.mark.asyncio


# ══════════════════════════════════════════════════════════════════════════════
# 1. LOGIN — succès / échecs
# ══════════════════════════════════════════════════════════════════════════════

async def test_login_admin_success(client):
    r = await client.post("/api/auth/login", json=CREDENTIALS["admin"])
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == CREDENTIALS["admin"]["email"]


async def test_login_bad_password(client):
    r = await client.post("/api/auth/login",
                          json={"email": "admin@altair.fr", "password": "wrong"})
    assert r.status_code == 401


async def test_login_unknown_email(client):
    r = await client.post("/api/auth/login",
                          json={"email": "nobody@unknown.fr", "password": "x"})
    assert r.status_code == 401


async def test_login_empty_password(client):
    r = await client.post("/api/auth/login",
                          json={"email": "admin@altair.fr", "password": ""})
    assert r.status_code in (401, 422)


async def test_login_all_demo_users(client):
    """Tous les comptes démo doivent pouvoir se connecter."""
    for role, creds in CREDENTIALS.items():
        r = await client.post("/api/auth/login", json=creds)
        assert r.status_code == 200, f"Login failed for {role}: {r.text}"


# ══════════════════════════════════════════════════════════════════════════════
# 2. JWT — auth /me et protection des routes
# ══════════════════════════════════════════════════════════════════════════════

async def test_me_with_valid_token(client, admin_token):
    r = await client.get("/api/auth/me", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["email"] == CREDENTIALS["admin"]["email"]


async def test_protected_route_without_token(client):
    r = await client.get("/api/projects")
    assert r.status_code in (401, 403)


async def test_protected_route_with_invalid_token(client):
    r = await client.get("/api/projects",
                         headers={"Authorization": "Bearer invalid.token.here"})
    assert r.status_code in (401, 403)


async def test_protected_route_with_valid_token(client, admin_token):
    r = await client.get("/api/projects", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ══════════════════════════════════════════════════════════════════════════════
# 3. RBAC — permissions
# ══════════════════════════════════════════════════════════════════════════════

async def test_admin_can_access_users(client, admin_token):
    r = await client.get("/api/admin/users", headers=auth(admin_token))
    assert r.status_code == 200


async def test_viewer_cannot_access_admin_users(client, viewer_token):
    r = await client.get("/api/admin/users", headers=auth(viewer_token))
    assert r.status_code in (403, 401)


async def test_admin_can_access_agent_analytics(client, admin_token):
    r = await client.get("/api/admin/agent-analytics", headers=auth(admin_token))
    assert r.status_code == 200


async def test_viewer_cannot_access_agent_analytics(client, viewer_token):
    r = await client.get("/api/admin/agent-analytics", headers=auth(viewer_token))
    assert r.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# 4. Multi-tenant isolation (ownership)
# ══════════════════════════════════════════════════════════════════════════════

async def test_altair_projects_not_visible_to_beta(client, admin_token, beta_token):
    altair_projects = (await client.get("/api/projects", headers=auth(admin_token))).json()
    beta_projects   = (await client.get("/api/projects", headers=auth(beta_token))).json()
    altair_ids = {p["project_id"] for p in altair_projects}
    beta_ids   = {p["project_id"] for p in beta_projects}
    assert altair_ids.isdisjoint(beta_ids), "Fuite de données cross-tenant !"


async def test_beta_has_own_projects(client, beta_token):
    r = await client.get("/api/projects", headers=auth(beta_token))
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) >= 3
    names = [p["name"] for p in projects]
    assert "Modernisation ERP Beta" in names


async def test_altair_risks_not_visible_to_beta(client, admin_token, beta_token):
    altair_risks = (await client.get("/api/risks", headers=auth(admin_token))).json()
    beta_risks   = (await client.get("/api/risks", headers=auth(beta_token))).json()
    altair_ids = {r["risk_id"] for r in altair_risks}
    beta_ids   = {r["risk_id"] for r in beta_risks}
    assert altair_ids.isdisjoint(beta_ids)


# ══════════════════════════════════════════════════════════════════════════════
# 5. Rate limiting
# ══════════════════════════════════════════════════════════════════════════════

async def test_rate_limit_login(client):
    """6+ tentatives échouées depuis la même IP → 429."""
    bad_creds = {"email": "notexist@test.fr", "password": "wrong"}
    # IP dédiée au test pour ne pas bloquer les autres tests
    headers = {"X-Forwarded-For": "10.99.99.99"}
    responses = []
    for _ in range(8):
        r = await client.post("/api/auth/login", json=bad_creds, headers=headers)
        responses.append(r.status_code)
    # Au moins une réponse 429
    assert 429 in responses, f"Rate limiting non déclenché : {responses}"


# ══════════════════════════════════════════════════════════════════════════════
# 6. Sécurité headers
# ══════════════════════════════════════════════════════════════════════════════

async def test_security_headers_present(client, admin_token):
    r = await client.get("/api/projects", headers=auth(admin_token))
    assert "x-frame-options" in r.headers or "X-Frame-Options" in r.headers
    assert "x-content-type-options" in r.headers or "X-Content-Type-Options" in r.headers
    assert "x-xss-protection" in r.headers or "X-XSS-Protection" in r.headers
