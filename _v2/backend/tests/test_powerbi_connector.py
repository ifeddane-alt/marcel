"""Power BI Connector — Backend tests
Tests: 6 data endpoints + 3 admin key management endpoints + auth (JWT + X-API-Key)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


@pytest.fixture(scope="module")
def auth_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@altair.fr",
        "password": "Admin2026!"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}"}


# ─── Admin key management ─────────────────────────────────────────────────────

class TestAdminKeyManagement:
    """Admin API key CRUD"""

    def test_get_key_initial(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/key", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "has_key" in data
        assert "masked_key" in data
        print(f"Key info: {data}")

    def test_generate_key(self, auth_headers):
        resp = requests.post(f"{BASE_URL}/api/admin/powerbi/generate-key", headers=auth_headers)
        assert resp.status_code == 201
        data = resp.json()
        assert "api_key" in data
        assert data["api_key"].startswith("pbi-")
        print(f"Generated key: {data['api_key'][:15]}...")

    def test_get_key_after_generate(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/key", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_key"] is True
        assert data["masked_key"] is not None
        assert "pbi-..." in data["masked_key"]

    def test_revoke_key(self, auth_headers):
        resp = requests.delete(f"{BASE_URL}/api/admin/powerbi/revoke-key", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("revoked") is True

    def test_get_key_after_revoke(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/key", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["has_key"] is False
        assert data["masked_key"] is None


# ─── Auth Tests ────────────────────────────────────────────────────────────────

class TestPowerBIAuth:
    """Auth: JWT Bearer + X-API-Key"""

    def test_jwt_auth_on_projects(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/projects", headers=auth_headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_no_auth_returns_401(self):
        resp = requests.get(f"{BASE_URL}/api/powerbi/projects")
        assert resp.status_code == 401

    def test_invalid_api_key_returns_401(self):
        resp = requests.get(f"{BASE_URL}/api/powerbi/projects", headers={"X-API-Key": "pbi-invalid"})
        assert resp.status_code == 401

    def test_xapikey_auth(self, auth_headers):
        # Generate a key first
        gen = requests.post(f"{BASE_URL}/api/admin/powerbi/generate-key", headers=auth_headers)
        assert gen.status_code == 201
        api_key = gen.json()["api_key"]

        # Use it
        resp = requests.get(f"{BASE_URL}/api/powerbi/projects", headers={"X-API-Key": api_key})
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/powerbi/revoke-key", headers=auth_headers)


# ─── Data Endpoints ───────────────────────────────────────────────────────────

class TestPowerBIDataEndpoints:
    """6 data endpoints — field validation"""

    def test_projects_returns_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/projects", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for field in ["id", "name", "program", "methodology", "status", "rag",
                          "capex_budget", "opex_budget", "capex_consumed", "opex_consumed",
                          "eac", "raf", "start_date", "end_date", "owner"]:
                assert field in row, f"Missing field: {field}"
        print(f"Projects: {len(data)} rows")

    def test_resources_returns_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/resources", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for field in ["id", "name", "role", "team", "type", "vendor",
                          "tjm", "availability_rate", "capacity_jh"]:
                assert field in row, f"Missing field: {field}"
        print(f"Resources: {len(data)} rows")

    def test_timesheets_returns_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/timesheets", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"Timesheets: {len(data)} rows (0 is acceptable)")

    def test_budget_returns_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/budget", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for field in ["project_name", "program", "capex_prev", "capex_cons",
                          "opex_prev", "opex_cons", "eac", "raf", "ecart_pct"]:
                assert field in row, f"Missing field: {field}"
        print(f"Budget: {len(data)} rows")

    def test_risks_returns_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/risks", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for field in ["project_name", "name", "probability", "impact",
                          "criticality", "category", "status"]:
                assert field in row, f"Missing field: {field}"
        print(f"Risks: {len(data)} rows")

    def test_milestones_returns_list(self, auth_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/milestones", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for field in ["project_name", "name", "family", "type", "date",
                          "days_remaining", "attribute", "status"]:
                assert field in row, f"Missing field: {field}"
        print(f"Milestones: {len(data)} rows")
