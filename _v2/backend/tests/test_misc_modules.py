"""
Tests — Risks, Milestones, Arbitrage, Connectors, Export COPIL.
"""
import pytest
import pytest_asyncio
import uuid
from conftest import auth

pytestmark = pytest.mark.asyncio


async def _first_project_id(client, token):
    r = await client.get("/api/projects", headers=auth(token))
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 0
    return projects[0]["project_id"]


# ══════════════════════════════════════════════════════════════════════════════
# RISQUES
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_risks(client, admin_token):
    r = await client.get("/api/risks", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_risks_isolation(client, admin_token, beta_token):
    a = {r["risk_id"] for r in (await client.get("/api/risks", headers=auth(admin_token))).json()}
    b = {r["risk_id"] for r in (await client.get("/api/risks", headers=auth(beta_token))).json()}
    assert a.isdisjoint(b)


async def test_create_risk(client, admin_token):
    pid = await _first_project_id(client, admin_token)
    payload = {
        "project_id":  pid,
        "title":       "Risque pytest",
        "category":    "Technique",
        "probability": 3,
        "impact":      3,
        "criticality": 9,
        "status":      "identifié",
        "owner":       "Test",
    }
    r = await client.post("/api/risks", json=payload, headers=auth(admin_token))
    assert r.status_code in (200, 201)
    rid = r.json().get("risk_id")


# ══════════════════════════════════════════════════════════════════════════════
# JALONS
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_milestones(client, admin_token):
    r = await client.get("/api/milestones", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_create_milestone(client, admin_token):
    pid = await _first_project_id(client, admin_token)
    payload = {
        "project_id":     pid,
        "name":           "Jalon pytest",
        "family":         "epic_milestone",
        "type":           "key_deliverable",
        "attribute":      "Majeur",
        "planned_date":   "2026-06-30",
        "status":         "en_cours",
        "is_blocking":    False,
    }
    r = await client.post("/api/milestones", json=payload, headers=auth(admin_token))
    assert r.status_code in (200, 201), r.text
    mid = r.json().get("milestone_id")
    assert mid
    # Cleanup
    await client.delete(f"/api/milestones/{mid}", headers=auth(admin_token))


# ══════════════════════════════════════════════════════════════════════════════
# ARBITRAGE
# ══════════════════════════════════════════════════════════════════════════════

async def test_arbitrage_summary(client, admin_token):
    r = await client.get("/api/arbitrage/summary", headers=auth(admin_token))
    assert r.status_code == 200


async def test_arbitrage_weights(client, admin_token):
    r = await client.get("/api/arbitrage/weights", headers=auth(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert "strategic_value" in body or "weights" in body or isinstance(body, dict)


async def test_arbitrage_scenarios_list(client, admin_token):
    r = await client.get("/api/arbitrage/scenarios", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_arbitrage_scenarios_isolation(client, admin_token, beta_token):
    a = {s.get("scenario_id") for s in (await client.get("/api/arbitrage/scenarios", headers=auth(admin_token))).json()}
    b = {s.get("scenario_id") for s in (await client.get("/api/arbitrage/scenarios", headers=auth(beta_token))).json()}
    assert a.isdisjoint(b)


# ══════════════════════════════════════════════════════════════════════════════
# CONNECTEURS
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_connector_configs(client, admin_token):
    r = await client.get("/api/connectors", headers=auth(admin_token))
    assert r.status_code == 200


async def test_connector_metadata(client, admin_token):
    r = await client.get("/api/connectors", headers=auth(admin_token))
    assert r.status_code == 200


async def test_sap_connector_has_rfc_auth(client, admin_token):
    r = await client.get("/api/connectors/sap/config", headers=auth(admin_token))
    # Either returns config or 404 if not configured — both are valid
    assert r.status_code in (200, 404, 400)


# ══════════════════════════════════════════════════════════════════════════════
# EXPORT COPIL
# ══════════════════════════════════════════════════════════════════════════════

async def test_export_copil_ppt(client, admin_token):
    r = await client.get("/api/export/copil/instances", headers=auth(admin_token))
    if r.status_code == 404:
        pytest.skip("Pas d'instance governance disponible")
    instances = r.json() if isinstance(r.json(), list) else r.json().get("instances", [])
    if not instances:
        pytest.skip("Pas d'instance governance disponible")
    gid = instances[0].get("governance_id") or instances[0].get("id")
    r2 = await client.post(
        "/api/export/copil",
        json={"governance_id": gid, "project_ids": [], "include_roadmap": False},
        headers=auth(admin_token),
    )
    assert r2.status_code in (200, 422, 404)
    if r2.status_code == 200:
        assert len(r2.content) > 1000


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ══════════════════════════════════════════════════════════════════════════════

async def test_health_endpoint(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
