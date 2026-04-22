"""Backend tests for admin_config module - GET/PUT /admin/config endpoints"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin2026!"}
PMO_CREDS   = {"email": "cp@altair.fr",    "password": "Altair2026!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def pmo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=PMO_CREDS)
    assert r.status_code == 200, f"PMO Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def pmo_headers(pmo_token):
    return {"Authorization": f"Bearer {pmo_token}"}


# ─── GET /admin/config ────────────────────────────────────────────────────────

class TestGetConfig:
    def test_admin_can_get_config(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/config", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "modules_enabled" in data
        assert "workflows" in data
        assert "enums" in data
        assert "holidays" in data
        assert "thresholds" in data
        assert "ppt_branding" in data
        print("GET /admin/config: OK -", list(data.keys()))

    def test_pmo_forbidden(self, pmo_headers):
        r = requests.get(f"{BASE_URL}/api/admin/config", headers=pmo_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
        print("GET /admin/config (PMO): 403 OK")

    def test_unauthenticated_forbidden(self):
        r = requests.get(f"{BASE_URL}/api/admin/config")
        assert r.status_code in [401, 403]
        print(f"GET /admin/config (no auth): {r.status_code} OK")


# ─── PUT /admin/config/modules ───────────────────────────────────────────────

class TestModulesUpdate:
    def test_disable_safe_module(self, admin_headers):
        # Disable safe
        r = requests.put(f"{BASE_URL}/api/admin/config/modules",
                         json={"modules_enabled": ["demands", "timesheets", "leaves", "vendors", "compliance", "roadmap"]},
                         headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "safe" not in data.get("modules_enabled", [])
        print("Disable safe module: OK")

    def test_safe_trains_returns_403_when_disabled(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers)
        assert r.status_code == 403, f"Expected 403 (module disabled), got {r.status_code}"
        print("GET /safe/trains with disabled module: 403 OK")

    def test_re_enable_safe_module(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/admin/config/modules",
                         json={"modules_enabled": ["safe", "demands", "timesheets", "leaves", "vendors", "compliance", "roadmap"]},
                         headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "safe" in data.get("modules_enabled", [])
        print("Re-enable safe module: OK")


# ─── PUT /admin/config/thresholds ─────────────────────────────────────────────

class TestThresholdsUpdate:
    def test_update_thresholds(self, admin_headers):
        payload = {"thresholds": {
            "capacity_orange_pct": 75,
            "capacity_red_pct": 90,
            "forfait_orange_pct": 80,
            "forfait_red_pct": 95,
            "tjm_variance_pct": 10,
            "regulatory_days": 90,
            "eac_ratio": 1.10,
        }}
        r = requests.put(f"{BASE_URL}/api/admin/config/thresholds", json=payload, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("thresholds", {}).get("capacity_orange_pct") == 75
        print("Update thresholds: OK")


# ─── PUT /admin/config/holidays ───────────────────────────────────────────────

class TestHolidaysUpdate:
    def test_update_holidays(self, admin_headers):
        payload = {"holidays": [
            {"date": "2026-01-01", "name": "Jour de l'An", "country": "FR"},
            {"date": "2026-05-01", "name": "Fête du Travail", "country": "FR"},
        ]}
        r = requests.put(f"{BASE_URL}/api/admin/config/holidays", json=payload, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data.get("holidays", [])) == 2
        print("Update holidays: OK")


# ─── PUT /admin/config/workflows ──────────────────────────────────────────────

class TestWorkflowsUpdate:
    def test_update_workflows(self, admin_headers):
        payload = {"workflows": {
            "timesheet": {"validation_steps": 3, "cp_timeout_days": 5, "auto_validate_on_timeout": True},
            "demands":   {"active_statuses": ["qualifiee", "priorisee", "acceptee", "refusee", "convertie"]},
        }}
        r = requests.put(f"{BASE_URL}/api/admin/config/workflows", json=payload, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("workflows", {}).get("timesheet", {}).get("validation_steps") == 3
        print("Update workflows: OK")


# ─── PUT /admin/config/enums ──────────────────────────────────────────────────

class TestEnumsUpdate:
    def test_update_enums(self, admin_headers):
        payload = {"enums": {
            "risk_categories": [
                {"value": "financier", "label": "Financier", "is_system": True, "order": 0},
                {"value": "technique", "label": "Technique", "is_system": True, "order": 1},
                {"value": "TEST_custom", "label": "Custom Test", "is_system": False, "order": 2},
            ],
            "dependency_natures": [],
            "project_statuses": [],
            "demand_urgencies": [],
        }}
        r = requests.put(f"{BASE_URL}/api/admin/config/enums", json=payload, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        cats = data.get("enums", {}).get("risk_categories", [])
        assert any(c["value"] == "TEST_custom" for c in cats)
        print("Update enums: OK")


# ─── PUT /admin/config/ppt-branding ───────────────────────────────────────────

class TestBrandingUpdate:
    def test_update_branding(self, admin_headers):
        payload = {"ppt_branding": {
            "primary_color": "#0B2545",
            "secondary_color": "#134074",
            "accent_color": "#10B981",
            "company_name": "Groupe Altair Industries",
            "font": "Arial",
        }}
        r = requests.put(f"{BASE_URL}/api/admin/config/ppt-branding", json=payload, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data.get("ppt_branding", {}).get("company_name") == "Groupe Altair Industries"
        print("Update branding: OK")
