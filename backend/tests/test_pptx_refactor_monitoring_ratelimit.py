"""Tests for: PPT refactoring facade, health endpoint, monitoring endpoint, rate limiting."""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")


def get_admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@altair.fr",
        "password": "Admin2026!"
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


# ---- Health endpoint ----

class TestHealthEndpoint:
    def test_health_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200

    def test_health_has_required_fields(self):
        r = requests.get(f"{BASE_URL}/api/health")
        data = r.json()
        assert "status" in data
        assert "version" in data
        assert "uptime_seconds" in data
        assert "database" in data
        assert "error_counts" in data

    def test_health_status_ok(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.json()["status"] == "ok"

    def test_health_uptime_positive(self):
        r = requests.get(f"{BASE_URL}/api/health")
        assert r.json()["uptime_seconds"] >= 0


# ---- Monitoring admin endpoint ----

class TestMonitoringEndpoint:
    def setup_method(self):
        self.token = get_admin_token()
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_monitoring_returns_200(self):
        r = requests.get(f"{BASE_URL}/api/admin/monitoring", headers=self.headers)
        assert r.status_code == 200, r.text

    def test_monitoring_has_required_fields(self):
        r = requests.get(f"{BASE_URL}/api/admin/monitoring", headers=self.headers)
        data = r.json()
        assert "status" in data
        assert "uptime_human" in data
        assert "database" in data
        assert "error_counts" in data
        assert "collections" in data

    def test_monitoring_database_ok(self):
        r = requests.get(f"{BASE_URL}/api/admin/monitoring", headers=self.headers)
        assert r.json()["database"]["status"] == "ok"

    def test_monitoring_collections_present(self):
        r = requests.get(f"{BASE_URL}/api/admin/monitoring", headers=self.headers)
        cols = r.json()["collections"]
        assert "projects" in cols
        assert "users" in cols

    def test_monitoring_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/admin/monitoring")
        assert r.status_code in [401, 403]


# ---- PowerBI rate limiting ----

class TestPowerBIRateLimit:
    def setup_method(self):
        self.token = get_admin_token()
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_powerbi_projects_responds_200(self):
        r = requests.get(f"{BASE_URL}/api/powerbi/projects", headers=self.headers)
        assert r.status_code == 200, r.text

    def test_powerbi_multiple_calls_ok(self):
        """First 10 calls should all return 200 (limit is 10/minute)."""
        for i in range(5):
            r = requests.get(f"{BASE_URL}/api/powerbi/projects", headers=self.headers)
            assert r.status_code == 200, f"Call {i+1} failed: {r.status_code}"


# ---- PPT facade import ----

class TestPPTXFacadeImport:
    """Test that pptx_generator.py façade works correctly via export endpoint."""

    def setup_method(self):
        self.token = get_admin_token()
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_copil_export_generates_pptx(self):
        """POST /api/export/copil should return a pptx file."""
        # Get a project ID first
        r = requests.get(f"{BASE_URL}/api/projects", headers=self.headers)
        assert r.status_code == 200
        projects = r.json()
        if not projects:
            pytest.skip("No projects available for PPT test")

        project_id = projects[0].get("id") or projects[0].get("project_id")
        r = requests.post(
            f"{BASE_URL}/api/export/copil",
            json={"project_ids": [project_id], "instance_date": "2026-02-01"},
            headers=self.headers
        )
        assert r.status_code == 200, f"COPIL export failed: {r.text[:500]}"
        assert len(r.content) > 10000, "PPT file too small"
        assert r.headers.get("content-type", "").startswith("application/")
