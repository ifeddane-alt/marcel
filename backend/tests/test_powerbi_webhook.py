"""Tests for PowerBI Template ZIP and Webhook features (iteration 45)"""
import pytest
import requests
import os
import zipfile
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PASS = "Admin2026!"


@pytest.fixture(scope="module")
def admin_token():
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ─── Feature A: Template ZIP ─────────────────────────────────────────────────

class TestTemplateZIP:
    """Tests for GET /api/admin/powerbi/template"""

    def test_template_zip_returns_200(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/template", headers=admin_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_template_zip_content_type(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/template", headers=admin_headers)
        assert resp.status_code == 200
        ct = resp.headers.get("content-type", "")
        assert "zip" in ct.lower() or "octet-stream" in ct.lower(), f"Expected zip content-type, got: {ct}"

    def test_template_zip_content_disposition(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/template", headers=admin_headers)
        assert resp.status_code == 200
        cd = resp.headers.get("content-disposition", "")
        assert "attachment" in cd, f"Expected attachment disposition, got: {cd}"
        assert ".zip" in cd, f"Expected .zip in filename, got: {cd}"

    def test_template_zip_contains_7_files(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/template", headers=admin_headers)
        assert resp.status_code == 200
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = zf.namelist()
        assert len(names) == 7, f"Expected 7 files, got {len(names)}: {names}"

    def test_template_zip_expected_files(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/template", headers=admin_headers)
        assert resp.status_code == 200
        zf = zipfile.ZipFile(io.BytesIO(resp.content))
        names = set(zf.namelist())
        expected = {
            "MARCEL_Projets.m",
            "MARCEL_Ressources.m",
            "MARCEL_Timesheets.m",
            "MARCEL_Budget.m",
            "MARCEL_Risques.m",
            "MARCEL_Jalons.m",
            "README.txt",
        }
        assert names == expected, f"Missing files: {expected - names}, extra: {names - expected}"

    def test_template_zip_requires_auth(self):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/template")
        assert resp.status_code in [401, 403], f"Expected 401/403 without auth, got {resp.status_code}"

    def test_template_zip_size(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/powerbi/template", headers=admin_headers)
        assert resp.status_code == 200
        assert len(resp.content) > 1000, f"ZIP too small: {len(resp.content)} bytes"


# ─── Feature B: Webhook Config ───────────────────────────────────────────────

class TestWebhookConfig:
    """Tests for PUT /api/admin/config/webhooks and GET /api/admin/config"""

    def test_put_webhook_config_returns_200(self, admin_headers):
        payload = {
            "webhook": {
                "url": "https://example.com/hook",
                "enabled": True,
                "events": ["project.created", "project.updated"],
                "secret": "test-secret-hmac"
            }
        }
        resp = requests.put(f"{BASE_URL}/api/admin/config/webhooks", json=payload, headers=admin_headers)
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    def test_get_config_contains_webhook_field(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/admin/config", headers=admin_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "webhook" in data, f"'webhook' key missing from config response. Keys: {list(data.keys())}"

    def test_webhook_config_persisted(self, admin_headers):
        # Save config
        payload = {
            "webhook": {
                "url": "https://example.com/hook-test",
                "enabled": True,
                "events": ["project.created"],
                "secret": "my-secret"
            }
        }
        put_resp = requests.put(f"{BASE_URL}/api/admin/config/webhooks", json=payload, headers=admin_headers)
        assert put_resp.status_code == 200

        # Verify it's persisted
        get_resp = requests.get(f"{BASE_URL}/api/admin/config", headers=admin_headers)
        assert get_resp.status_code == 200
        wh = get_resp.json().get("webhook", {})
        assert wh.get("url") == "https://example.com/hook-test", f"URL not persisted: {wh}"
        assert wh.get("enabled") is True

    def test_webhook_config_requires_auth(self):
        payload = {"webhook": {"url": "https://example.com/hook", "enabled": True, "events": [], "secret": ""}}
        resp = requests.put(f"{BASE_URL}/api/admin/config/webhooks", json=payload)
        assert resp.status_code in [401, 403]


# ─── Feature B: Webhook fire-and-forget ──────────────────────────────────────

class TestWebhookFireAndForget:
    """Test that project create/update does NOT block on webhook failure"""

    def test_project_update_not_blocked_by_webhook(self, admin_headers):
        """Update a project when webhook URL is invalid — should return 200"""
        # First get a project
        proj_resp = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
        if proj_resp.status_code != 200 or not proj_resp.json():
            pytest.skip("No projects available to test")

        projects = proj_resp.json()
        # Handle both list and dict with items key
        if isinstance(projects, dict):
            projects = projects.get("items", projects.get("projects", []))
        if not projects:
            pytest.skip("No projects available")

        project_id = projects[0].get("project_id") or projects[0].get("id")
        if not project_id:
            pytest.skip("Could not get project_id")

        # Set webhook to invalid URL
        wh_payload = {
            "webhook": {
                "url": "https://example.com/hook",
                "enabled": True,
                "events": ["project.updated"],
                "secret": ""
            }
        }
        requests.put(f"{BASE_URL}/api/admin/config/webhooks", json=wh_payload, headers=admin_headers)

        # Update project — should NOT be blocked
        import time
        start = time.time()
        update_resp = requests.put(
            f"{BASE_URL}/api/projects/{project_id}",
            json={"name": projects[0].get("name", "Test")},
            headers=admin_headers,
            timeout=15
        )
        elapsed = time.time() - start
        assert update_resp.status_code == 200, f"Expected 200, got {update_resp.status_code}: {update_resp.text}"
        # Fire-and-forget: should respond quickly (< 10s even with failed webhook)
        assert elapsed < 10, f"Request took too long ({elapsed:.1f}s), webhook may be blocking"


# ─── Feature: Legacy PowerBI endpoints ───────────────────────────────────────

class TestLegacyPowerBIEndpoints:
    """Verify old PowerBI endpoints still work with Bearer JWT"""

    def test_powerbi_projects(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/projects", headers=admin_headers)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        assert isinstance(resp.json(), list)

    def test_powerbi_timesheets(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/timesheets", headers=admin_headers)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        assert isinstance(resp.json(), list)

    def test_powerbi_budget(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/budget", headers=admin_headers)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        assert isinstance(resp.json(), list)

    def test_powerbi_risks(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/risks", headers=admin_headers)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        assert isinstance(resp.json(), list)

    def test_powerbi_milestones(self, admin_headers):
        resp = requests.get(f"{BASE_URL}/api/powerbi/milestones", headers=admin_headers)
        assert resp.status_code == 200, f"Got {resp.status_code}: {resp.text}"
        assert isinstance(resp.json(), list)
