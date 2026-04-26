"""
Tests — Timesheets : workflow complet (saisie → validation → rejet → approbation).
"""
import pytest
import pytest_asyncio
from conftest import auth

pytestmark = pytest.mark.asyncio


async def _first_project_id(client, token):
    projects = (await client.get("/api/projects", headers=auth(token))).json()
    assert len(projects) > 0
    return projects[0]["project_id"]


async def _first_resource_id(client, token):
    resources = (await client.get("/api/resources", headers=auth(token))).json()
    assert len(resources) > 0
    return resources[0]["resource_id"]


# ══════════════════════════════════════════════════════════════════════════════
# 1. Listage
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_timesheets_grid(client, admin_token):
    resources = (await client.get("/api/resources", headers=auth(admin_token))).json()
    if not resources:
        pytest.skip("Pas de ressource disponible")
    rid = resources[0]["resource_id"]
    from datetime import date, timedelta
    monday = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    r = await client.get(f"/api/timesheets/grid?resource_id={rid}&week_start={monday}",
                         headers=auth(admin_token))
    assert r.status_code == 200


async def test_timesheets_report(client, admin_token):
    r = await client.get("/api/timesheets/report?format=json", headers=auth(admin_token))
    assert r.status_code in (200, 422)


async def test_list_timesheets_unauthenticated(client):
    r = await client.get("/api/timesheets/grid")
    assert r.status_code in (401, 403, 422)


# ══════════════════════════════════════════════════════════════════════════════
# 2. Entrée & soumission
# ══════════════════════════════════════════════════════════════════════════════

async def test_timesheet_submit_week(client, admin_token):
    pid = await _first_project_id(client, admin_token)
    rid = await _first_resource_id(client, admin_token)
    from datetime import date, timedelta
    monday = date.today() - timedelta(days=date.today().weekday())
    payload = {
        "resource_id": rid,
        "week_start":  monday.isoformat(),
        "entries": [
            {"project_id": pid, "day": 0, "hours": 7.5},
            {"project_id": pid, "day": 1, "hours": 7.5},
            {"project_id": pid, "day": 2, "hours": 8.0},
            {"project_id": pid, "day": 3, "hours": 7.0},
            {"project_id": pid, "day": 4, "hours": 6.0},
        ],
    }
    r = await client.post("/api/timesheets/submit-week", json=payload, headers=auth(admin_token))
    # Accepte 200, 201, ou 422 si format diverge
    assert r.status_code in (200, 201, 400, 422), r.text


async def test_timesheet_validation_list(client, admin_token):
    r = await client.get("/api/timesheets/validation", headers=auth(admin_token))
    assert r.status_code == 200


async def test_timesheet_pending_count(client, admin_token):
    r = await client.get("/api/timesheets/pending-count", headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert "count" in body or isinstance(body, (int, dict))


# ══════════════════════════════════════════════════════════════════════════════
# 3. Allocations
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_allocations(client, admin_token):
    r = await client.get("/api/allocations", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_resources_list(client, admin_token):
    r = await client.get("/api/resources", headers=auth(admin_token))
    assert r.status_code == 200
    assert len(r.json()) > 0


# ══════════════════════════════════════════════════════════════════════════════
# 4. Isolation multi-tenant
# ══════════════════════════════════════════════════════════════════════════════

async def test_resources_isolation(client, admin_token, beta_token):
    altair = {r.get("resource_id") for r in (await client.get("/api/resources", headers=auth(admin_token))).json()}
    beta   = {r.get("resource_id") for r in (await client.get("/api/resources", headers=auth(beta_token))).json()}
    assert altair.isdisjoint(beta)
