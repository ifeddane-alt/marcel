"""Tests S1-05/06/07 — Work Allocations, Team Consumption, RAF"""
import pytest
import httpx
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
API = BASE_URL + "/api"


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


def get_first_project(token):
    r = httpx.get(f"{API}/projects", headers=auth(token))
    r.raise_for_status()
    return r.json()[0]["project_id"]


def get_first_task(token, project_id):
    r = httpx.get(f"{API}/tasks", params={"project_id": project_id}, headers=auth(token))
    r.raise_for_status()
    items = r.json()
    return items[0]["task_id"] if items else None


def get_first_resource(token):
    r = httpx.get(f"{API}/resources", headers=auth(token))
    r.raise_for_status()
    return r.json()[0]


# ------------------------------------------------------------------ #
# S1-05 — Work Allocations CRUD
# ------------------------------------------------------------------ #

def test_list_work_allocations(admin_token):
    project_id = get_first_project(admin_token)
    r = httpx.get(f"{API}/projects/{project_id}/work-allocations", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 3, f"Expected at least 3 WAs, got {len(data)}"


def test_work_allocation_has_computed_costs(admin_token):
    project_id = get_first_project(admin_token)
    was = httpx.get(f"{API}/projects/{project_id}/work-allocations", headers=auth(admin_token)).json()
    wa_with_cost = [wa for wa in was if wa.get("planned_cost_eur", 0) > 0]
    assert len(wa_with_cost) > 0, "Aucune allocation avec coût calculé"
    wa = wa_with_cost[0]
    assert "planned_cost_eur" in wa
    assert "consumed_cost_eur" in wa
    assert "resource_name" in wa
    assert "_id" not in wa


def test_create_work_allocation_admin(admin_token):
    project_id = get_first_project(admin_token)
    task_id = get_first_task(admin_token, project_id)
    resource = get_first_resource(admin_token)
    assert task_id is not None

    payload = {
        "task_id": task_id,
        "resource_id": resource["resource_id"],
        "phase": "test",
        "planned_md": 5.0,
        "consumed_md": 2.0,
    }
    r = httpx.post(f"{API}/work-allocations", json=payload, headers=auth(admin_token))
    assert r.status_code == 201
    data = r.json()
    assert data["phase"] == "test"
    assert data["planned_md"] == 5.0
    assert "work_allocation_id" in data
    # cleanup
    httpx.delete(f"{API}/work-allocations/{data['work_allocation_id']}", headers=auth(admin_token))


def test_create_work_allocation_bad_task(admin_token):
    resource = get_first_resource(admin_token)
    r = httpx.post(f"{API}/work-allocations",
                   json={"task_id": "bad-id", "resource_id": resource["resource_id"], "phase": "test", "planned_md": 1},
                   headers=auth(admin_token))
    assert r.status_code == 404


def test_update_work_allocation(admin_token):
    project_id = get_first_project(admin_token)
    task_id = get_first_task(admin_token, project_id)
    resource = get_first_resource(admin_token)
    r = httpx.post(f"{API}/work-allocations",
                   json={"task_id": task_id, "resource_id": resource["resource_id"], "phase": "analyse", "planned_md": 8.0},
                   headers=auth(admin_token))
    wa_id = r.json()["work_allocation_id"]

    r2 = httpx.put(f"{API}/work-allocations/{wa_id}", json={"consumed_md": 4.0}, headers=auth(admin_token))
    assert r2.status_code == 200
    assert r2.json()["consumed_md"] == 4.0
    httpx.delete(f"{API}/work-allocations/{wa_id}", headers=auth(admin_token))


def test_delete_work_allocation(admin_token):
    project_id = get_first_project(admin_token)
    task_id = get_first_task(admin_token, project_id)
    resource = get_first_resource(admin_token)
    r = httpx.post(f"{API}/work-allocations",
                   json={"task_id": task_id, "resource_id": resource["resource_id"], "phase": "review", "planned_md": 3.0},
                   headers=auth(admin_token))
    wa_id = r.json()["work_allocation_id"]
    rd = httpx.delete(f"{API}/work-allocations/{wa_id}", headers=auth(admin_token))
    assert rd.status_code == 204


# ------------------------------------------------------------------ #
# RBAC — Work Allocations
# ------------------------------------------------------------------ #

def test_create_wa_pmo(pmo_token, admin_token):
    project_id = get_first_project(admin_token)
    task_id = get_first_task(admin_token, project_id)
    resource = get_first_resource(admin_token)
    r = httpx.post(f"{API}/work-allocations",
                   json={"task_id": task_id, "resource_id": resource["resource_id"], "phase": "analyse", "planned_md": 2.0},
                   headers=auth(pmo_token))
    assert r.status_code == 201
    httpx.delete(f"{API}/work-allocations/{r.json()['work_allocation_id']}", headers=auth(admin_token))


def test_create_wa_viewer_forbidden(viewer_token):
    r = httpx.post(f"{API}/work-allocations",
                   json={"task_id": "x", "resource_id": "y", "phase": "test", "planned_md": 1},
                   headers=auth(viewer_token))
    assert r.status_code == 403


# ------------------------------------------------------------------ #
# S1-06 — Team Consumption
# ------------------------------------------------------------------ #

def test_team_consumption(admin_token):
    project_id = get_first_project(admin_token)
    r = httpx.get(f"{API}/projects/{project_id}/team-consumption", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        tc = data[0]
        assert "team_name" in tc
        assert "planned_md" in tc
        assert "consumed_md" in tc
        assert "raf_md" in tc
        assert "planned_cost_eur" in tc
        assert "consumed_cost_eur" in tc
        assert "raf_cost_eur" in tc
        assert "_id" not in tc


def test_team_consumption_unknown_project(admin_token):
    r = httpx.get(f"{API}/projects/unknown-project/team-consumption", headers=auth(admin_token))
    assert r.status_code == 404


# ------------------------------------------------------------------ #
# S1-07 — RAF valorisé
# ------------------------------------------------------------------ #

def test_raf(admin_token):
    project_id = get_first_project(admin_token)
    r = httpx.get(f"{API}/projects/{project_id}/raf", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert "raf_md" in data
    assert "raf_cost_eur" in data
    assert "consumed_md" in data
    assert "consumed_cost_eur" in data
    assert "atterrissage_eur" in data
    assert data["atterrissage_eur"] == round(data["consumed_cost_eur"] + data["raf_cost_eur"], 2)


def test_raf_unknown_project(admin_token):
    r = httpx.get(f"{API}/projects/unknown-project/raf", headers=auth(admin_token))
    assert r.status_code == 404


def test_raf_viewer(viewer_token):
    """READ_ONLY peut lire le RAF."""
    token_admin = login("admin@altair.fr", "Admin1234!")
    project_id = get_first_project(token_admin)
    r = httpx.get(f"{API}/projects/{project_id}/raf", headers=auth(viewer_token))
    assert r.status_code == 200
