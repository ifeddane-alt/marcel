"""Tests S1-01 — Collection teams (happy path + RBAC + cross-tenant)"""
import pytest
import httpx
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
if "preview.emergentagent" in BASE_URL or "localhost" not in BASE_URL:
    API = BASE_URL + "/api"
else:
    API = "http://localhost:8001/api"


def login(email, password):
    r = httpx.post(f"{API}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return login("admin@altair.fr", "Admin1234!")


@pytest.fixture(scope="module")
def pmo_token():
    return login("pmo@altair.fr", "Pmo1234!")


@pytest.fixture(scope="module")
def viewer_token():
    return login("viewer@altair.fr", "View1234!")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------------ #
# Happy path
# ------------------------------------------------------------------ #

def test_list_teams_admin(admin_token):
    r = httpx.get(f"{API}/teams", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    names = [t["name"] for t in data]
    for expected in ["Dev A", "Dev B", "Infra", "QA", "Support"]:
        assert expected in names, f"Équipe '{expected}' manquante"


def test_team_has_manager_name(admin_token):
    r = httpx.get(f"{API}/teams", headers=auth(admin_token))
    teams = r.json()
    team_with_manager = next((t for t in teams if t.get("manager_resource_id")), None)
    assert team_with_manager is not None
    assert "manager_name" in team_with_manager
    assert team_with_manager["manager_name"] is not None


def test_create_team_admin(admin_token):
    payload = {"name": "Test S1-01 Admin", "manager_resource_id": None}
    r = httpx.post(f"{API}/teams", json=payload, headers=auth(admin_token))
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Test S1-01 Admin"
    assert "team_id" in data
    assert "tenant_id" in data
    # cleanup
    httpx.delete(f"{API}/teams/{data['team_id']}", headers=auth(admin_token))


def test_update_team_admin(admin_token):
    # Create
    r = httpx.post(f"{API}/teams", json={"name": "ToUpdate"}, headers=auth(admin_token))
    team_id = r.json()["team_id"]
    # Update
    r2 = httpx.put(f"{API}/teams/{team_id}", json={"name": "Updated Name"}, headers=auth(admin_token))
    assert r2.status_code == 200
    assert r2.json()["name"] == "Updated Name"
    # cleanup
    httpx.delete(f"{API}/teams/{team_id}", headers=auth(admin_token))


def test_delete_team_admin(admin_token):
    r = httpx.post(f"{API}/teams", json={"name": "ToDelete"}, headers=auth(admin_token))
    team_id = r.json()["team_id"]
    rd = httpx.delete(f"{API}/teams/{team_id}", headers=auth(admin_token))
    assert rd.status_code == 204
    # Vérifier suppression
    r2 = httpx.get(f"{API}/teams", headers=auth(admin_token))
    ids = [t["team_id"] for t in r2.json()]
    assert team_id not in ids


def test_delete_nonexistent_team(admin_token):
    r = httpx.delete(f"{API}/teams/nonexistent-id", headers=auth(admin_token))
    assert r.status_code == 404


# ------------------------------------------------------------------ #
# RBAC
# ------------------------------------------------------------------ #

def test_list_teams_pmo(pmo_token):
    r = httpx.get(f"{API}/teams", headers=auth(pmo_token))
    assert r.status_code == 200


def test_list_teams_viewer(viewer_token):
    r = httpx.get(f"{API}/teams", headers=auth(viewer_token))
    assert r.status_code == 200


def test_create_team_pmo(pmo_token, admin_token):
    r = httpx.post(f"{API}/teams", json={"name": "PMO Team"}, headers=auth(pmo_token))
    assert r.status_code == 201
    # cleanup
    httpx.delete(f"{API}/teams/{r.json()['team_id']}", headers=auth(admin_token))


def test_create_team_viewer_forbidden(viewer_token):
    r = httpx.post(f"{API}/teams", json={"name": "Viewer Team"}, headers=auth(viewer_token))
    assert r.status_code == 403


def test_update_team_pmo(pmo_token, admin_token):
    r = httpx.post(f"{API}/teams", json={"name": "For PMO Update"}, headers=auth(admin_token))
    team_id = r.json()["team_id"]
    r2 = httpx.put(f"{API}/teams/{team_id}", json={"name": "PMO Updated"}, headers=auth(pmo_token))
    assert r2.status_code == 200
    httpx.delete(f"{API}/teams/{team_id}", headers=auth(admin_token))


def test_delete_team_pmo_forbidden(pmo_token, admin_token):
    r = httpx.post(f"{API}/teams", json={"name": "NoDeletePMO"}, headers=auth(admin_token))
    team_id = r.json()["team_id"]
    r2 = httpx.delete(f"{API}/teams/{team_id}", headers=auth(pmo_token))
    assert r2.status_code == 403
    httpx.delete(f"{API}/teams/{team_id}", headers=auth(admin_token))


def test_delete_team_viewer_forbidden(viewer_token):
    # Get existing team ID from admin
    token_admin = login("admin@altair.fr", "Admin1234!")
    teams = httpx.get(f"{API}/teams", headers=auth(token_admin)).json()
    team_id = teams[0]["team_id"]
    r = httpx.delete(f"{API}/teams/{team_id}", headers=auth(viewer_token))
    assert r.status_code == 403


# ------------------------------------------------------------------ #
# Cross-tenant isolation
# ------------------------------------------------------------------ #

def test_no_id_leakage(admin_token):
    """Les équipes retournées ne contiennent pas _id MongoDB."""
    r = httpx.get(f"{API}/teams", headers=auth(admin_token))
    for team in r.json():
        assert "_id" not in team
