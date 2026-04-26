"""
Tests — Projects : CRUD complet + validations.
"""
import pytest
import pytest_asyncio
import uuid
from conftest import auth

pytestmark = pytest.mark.asyncio

PROJECT_PAYLOAD = {
    "name":             "Projet Test CRUD",
    "status":           "actif",
    "status_rag":       "green",
    "methodology":      "agile",
    "budget_total":     500000,
    "budget_consumed":  50000,
    "budget_forecast":  510000,
    "capex_planned":    400000,
    "opex_planned":     100000,
    "capex_consumed":   40000,
    "opex_consumed":    10000,
    "jh_planned":       800,
    "jh_consumed":      80,
    "start_date":       "2026-01-01",
    "end_date_baseline":"2026-12-31",
    "end_date_forecast":"2026-12-31",
    "owner":            "Nicolas Petit",
    "phase":            "Développement",
}


# ══════════════════════════════════════════════════════════════════════════════
# LIST
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_projects_returns_list(client, admin_token):
    r = await client.get("/api/projects", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_list_projects_has_altair_data(client, admin_token):
    r = await client.get("/api/projects", headers=auth(admin_token))
    assert len(r.json()) >= 1


async def test_list_projects_unauthenticated(client):
    r = await client.get("/api/projects")
    assert r.status_code in (401, 403)


# ══════════════════════════════════════════════════════════════════════════════
# CREATE
# ══════════════════════════════════════════════════════════════════════════════

@pytest_asyncio.fixture(scope="module")
async def created_project(client, admin_token):
    r = await client.post("/api/projects", json=PROJECT_PAYLOAD, headers=auth(admin_token))
    assert r.status_code == 200, r.text
    project = r.json()
    yield project
    # Cleanup
    pid = project.get("project_id")
    if pid:
        await client.delete(f"/api/projects/{pid}", headers=auth(admin_token))


async def test_create_project_success(client, admin_token):
    payload = {**PROJECT_PAYLOAD, "name": f"Projet Create {uuid.uuid4().hex[:6]}"}
    r = await client.post("/api/projects", json=payload, headers=auth(admin_token))
    assert r.status_code in (200, 201)
    body = r.json()
    assert "project_id" in body
    assert body["name"] == payload["name"]
    # Cleanup
    await client.delete(f"/api/projects/{body['project_id']}", headers=auth(admin_token))


async def test_create_project_missing_name(client, admin_token):
    bad = {k: v for k, v in PROJECT_PAYLOAD.items() if k != "name"}
    r = await client.post("/api/projects", json=bad, headers=auth(admin_token))
    assert r.status_code == 422


async def test_viewer_cannot_create_project(client, viewer_token):
    r = await client.post("/api/projects", json=PROJECT_PAYLOAD, headers=auth(viewer_token))
    assert r.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# READ
# ══════════════════════════════════════════════════════════════════════════════

async def test_get_project_by_id(client, admin_token):
    projects = (await client.get("/api/projects", headers=auth(admin_token))).json()
    assert len(projects) > 0
    pid = projects[0]["project_id"]
    r = await client.get(f"/api/projects/{pid}", headers=auth(admin_token))
    assert r.status_code == 200
    assert r.json()["project_id"] == pid


async def test_get_project_not_found(client, admin_token):
    r = await client.get("/api/projects/00000000-0000-0000-0000-000000000000",
                         headers=auth(admin_token))
    assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# UPDATE
# ══════════════════════════════════════════════════════════════════════════════

async def test_update_project(client, admin_token):
    projects = (await client.get("/api/projects", headers=auth(admin_token))).json()
    pid = projects[0]["project_id"]
    old_name = projects[0]["name"]
    new_name = f"Updated {uuid.uuid4().hex[:6]}"
    r = await client.put(f"/api/projects/{pid}", json={**projects[0], "name": new_name},
                         headers=auth(admin_token))
    assert r.status_code == 200
    # Restore
    await client.put(f"/api/projects/{pid}", json={**projects[0], "name": old_name},
                     headers=auth(admin_token))


async def test_viewer_cannot_update_project(client, viewer_token, admin_token):
    projects = (await client.get("/api/projects", headers=auth(admin_token))).json()
    pid = projects[0]["project_id"]
    r = await client.put(f"/api/projects/{pid}", json=projects[0],
                         headers=auth(viewer_token))
    assert r.status_code == 403


# ══════════════════════════════════════════════════════════════════════════════
# TENANT ISOLATION
# ══════════════════════════════════════════════════════════════════════════════

async def test_beta_cannot_access_altair_project(client, admin_token, beta_token):
    altair_projects = (await client.get("/api/projects", headers=auth(admin_token))).json()
    pid = altair_projects[0]["project_id"]
    r = await client.get(f"/api/projects/{pid}", headers=auth(beta_token))
    assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

async def test_dashboard_loads(client, admin_token):
    r = await client.get("/api/dashboard/summary", headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert "total_projects" in body or "projects" in body or isinstance(body, dict)


async def test_portfolio_kpis_accessible(client, pmo_token):
    r = await client.get("/api/dashboard/summary", headers=auth(pmo_token))
    assert r.status_code == 200
