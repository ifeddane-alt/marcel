"""Backend tests for Projetenne API"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin1234!"}
VIEWER_CREDS = {"email": "viewer@altair.fr", "password": "View1234!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def viewer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER_CREDS)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}


# --- Auth tests ---

class TestAuth:
    """Auth endpoint tests"""

    def test_login_admin_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == "admin@altair.fr"
        assert data["user"]["role"] == "TENANT_ADMIN"

    def test_login_viewer_success(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER_CREDS)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["role"] == "READ_ONLY"

    def test_login_invalid_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@x.com", "password": "wrong"})
        assert r.status_code == 401

    def test_unauthorized_access_no_token(self):
        r = requests.get(f"{BASE_URL}/api/projects")
        assert r.status_code == 403  # FastAPI HTTPBearer returns 403 when no token

    def test_get_me(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@altair.fr"


# --- Projects tests ---

class TestProjects:
    """Projects endpoint tests"""

    def test_list_projects_returns_8(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 8, f"Expected 8 projects, got {len(data)}"

    def test_project_fields(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        assert r.status_code == 200
        p = r.json()[0]
        for field in ("project_id", "name", "status_rag", "budget_total", "methodology"):
            assert field in p, f"Missing field: {field}"

    def test_get_project_by_id(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        pid = r.json()[0]["project_id"]
        r2 = requests.get(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["project_id"] == pid

    def test_get_project_not_found(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/projects/nonexistent-id", headers=auth_headers)
        assert r.status_code == 404

    def test_viewer_can_read_projects(self, viewer_headers):
        r = requests.get(f"{BASE_URL}/api/projects", headers=viewer_headers)
        assert r.status_code == 200


# --- Dashboard tests ---

class TestDashboard:
    """Dashboard endpoint tests"""

    def test_dashboard_summary(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["total_projects"] == 8
        assert "rag_counts" in data
        assert "budget" in data
        assert data["budget"]["total"] >= 17_000_000

    def test_dashboard_rag_counts(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth_headers)
        rag = r.json()["rag_counts"]
        assert rag["green"] + rag["orange"] + rag["red"] == 8


# --- Milestones tests ---

class TestMilestones:
    """Milestones endpoint tests"""

    def test_milestones_for_project(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers)
        pid = r.json()[0]["project_id"]
        r2 = requests.get(f"{BASE_URL}/api/milestones?project_id={pid}", headers=auth_headers)
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

    def test_milestones_all(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/milestones", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) > 0


# --- Resources tests ---

class TestResources:
    """Resources endpoint tests"""

    def test_list_resources_returns_10(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/resources", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) == 10, f"Expected 10 resources, got {len(r.json())}"


# --- Governance tests ---

class TestGovernance:
    """Governance endpoint tests"""

    def test_list_governance_returns_5(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/governance", headers=auth_headers)
        assert r.status_code == 200
        assert len(r.json()) == 5, f"Expected 5 governance instances, got {len(r.json())}"
