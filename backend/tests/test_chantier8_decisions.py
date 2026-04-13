"""
Tests for Chantier 8 - Decisions CRUD + Dashboard Heatmap
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN = {"email": "admin@altair.fr", "password": "Admin1234!"}
PMO = {"email": "pmo@altair.fr", "password": "Pmo1234!"}
VIEWER = {"email": "viewer@altair.fr", "password": "View1234!"}


def get_token(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


def auth_headers(creds):
    return {"Authorization": f"Bearer {get_token(creds)}"}


@pytest.fixture(scope="module")
def admin_headers():
    return auth_headers(ADMIN)


@pytest.fixture(scope="module")
def pmo_headers():
    return auth_headers(PMO)


@pytest.fixture(scope="module")
def viewer_headers():
    return auth_headers(VIEWER)


@pytest.fixture(scope="module")
def first_project_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 0
    return projects[0]["project_id"]


class TestHeatmapDashboard:
    """Dashboard heatmap-risks endpoint"""

    def test_heatmap_returns_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/heatmap-risks", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_heatmap_structure(self, admin_headers):
        # Returns flat list of risks (frontend aggregates into heatmap)
        r = requests.get(f"{BASE_URL}/api/dashboard/heatmap-risks", headers=admin_headers)
        data = r.json()
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Heatmap risks count: {len(data)}")

    def test_heatmap_risk_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/heatmap-risks", headers=admin_headers)
        data = r.json()
        if data:
            risk = data[0]
            assert "probability" in risk, f"Missing 'probability', keys: {list(risk.keys())}"
            assert "impact" in risk, "Missing 'impact'"
            assert "project_name" in risk, "Missing 'project_name'"
            print(f"Sample risk keys: {list(risk.keys())}")

    def test_heatmap_viewer_access(self, viewer_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/heatmap-risks", headers=viewer_headers)
        assert r.status_code == 200


class TestDecisionsAPI:
    """Decisions CRUD"""

    def test_list_decisions_returns_data(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/decisions", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Total decisions: {len(data)}")

    def test_list_decisions_count_32(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/decisions", headers=admin_headers)
        data = r.json()
        # Should have ~32 seeded decisions
        assert len(data) >= 32, f"Expected >= 32 decisions, got {len(data)}"

    def test_list_decisions_by_project(self, admin_headers, first_project_id):
        r = requests.get(f"{BASE_URL}/api/decisions?project_id={first_project_id}", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Decisions for project {first_project_id}: {len(data)}")

    def test_create_decision(self, admin_headers, first_project_id):
        payload = {
            "project_id": first_project_id,
            "title": "TEST_Decision_Create",
            "category": "stratégique",
            "status": "proposée",
        }
        r = requests.post(f"{BASE_URL}/api/decisions", json=payload, headers=admin_headers)
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        data = r.json()
        assert "decision_id" in data
        assert data["title"] == "TEST_Decision_Create"
        return data["decision_id"]

    def test_create_decision_all_fields(self, admin_headers, first_project_id):
        payload = {
            "project_id": first_project_id,
            "title": "TEST_Decision_AllFields",
            "description": "Test description",
            "category": "technique",
            "status": "prise",
            "decision_date": "2025-01-15",
            "due_date": "2025-03-01",
            "owner": "TEST_Owner",
            "impact": "Medium impact",
        }
        r = requests.post(f"{BASE_URL}/api/decisions", json=payload, headers=admin_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["category"] == "technique"
        assert data["status"] == "prise"
        assert data["owner"] == "TEST_Owner"

    def test_update_decision(self, admin_headers, first_project_id):
        # Create first
        payload = {"project_id": first_project_id, "title": "TEST_Decision_Update", "category": "planning", "status": "proposée"}
        cr = requests.post(f"{BASE_URL}/api/decisions", json=payload, headers=admin_headers)
        assert cr.status_code == 201
        did = cr.json()["decision_id"]

        # Update
        update = {"project_id": first_project_id, "title": "TEST_Decision_Updated", "category": "budgétaire", "status": "prise"}
        ur = requests.put(f"{BASE_URL}/api/decisions/{did}", json=update, headers=admin_headers)
        assert ur.status_code == 200
        assert ur.json()["title"] == "TEST_Decision_Updated"
        assert ur.json()["status"] == "prise"

    def test_delete_decision_admin(self, admin_headers, first_project_id):
        # Create
        payload = {"project_id": first_project_id, "title": "TEST_Decision_Delete", "category": "ressources", "status": "annulée"}
        cr = requests.post(f"{BASE_URL}/api/decisions", json=payload, headers=admin_headers)
        did = cr.json()["decision_id"]

        # Delete
        dr = requests.delete(f"{BASE_URL}/api/decisions/{did}", headers=admin_headers)
        assert dr.status_code == 204

    def test_delete_decision_pmo_forbidden(self, pmo_headers, first_project_id):
        # Create as admin
        admin_h = auth_headers(ADMIN)
        payload = {"project_id": first_project_id, "title": "TEST_Decision_PMOdel", "category": "gouvernance", "status": "proposée"}
        cr = requests.post(f"{BASE_URL}/api/decisions", json=payload, headers=admin_h)
        did = cr.json()["decision_id"]

        # PMO tries to delete
        dr = requests.delete(f"{BASE_URL}/api/decisions/{did}", headers=pmo_headers)
        assert dr.status_code in [403, 404], f"Expected 403/404 for PMO delete, got {dr.status_code}"

        # Cleanup
        requests.delete(f"{BASE_URL}/api/decisions/{did}", headers=admin_h)

    def test_viewer_cannot_create(self, viewer_headers, first_project_id):
        payload = {"project_id": first_project_id, "title": "TEST_Viewer_Create", "category": "conformité", "status": "proposée"}
        r = requests.post(f"{BASE_URL}/api/decisions", json=payload, headers=viewer_headers)
        assert r.status_code == 403, f"Expected 403 for viewer create, got {r.status_code}"

    def test_decisions_have_required_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/decisions", headers=admin_headers)
        data = r.json()
        if data:
            d = data[0]
            for field in ["decision_id", "title", "category", "status"]:
                assert field in d, f"Missing field: {field}"

    def test_cleanup_test_decisions(self, admin_headers):
        """Cleanup TEST_ decisions"""
        r = requests.get(f"{BASE_URL}/api/decisions", headers=admin_headers)
        for d in r.json():
            if d.get("title", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/decisions/{d['decision_id']}", headers=admin_headers)
        print("Cleanup done")
