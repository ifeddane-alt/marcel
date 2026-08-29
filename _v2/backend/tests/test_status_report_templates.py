"""Backend tests for Status Report and Project Templates features."""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PASS = "Admin2026!"
CP_EMAIL = "cp@altair.fr"
CP_PASS = "Altair2026!"


def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token") or r.json().get("token")
    return None


def get_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    token = get_token(ADMIN_EMAIL, ADMIN_PASS)
    if not token:
        pytest.skip("Admin auth failed")
    return token


@pytest.fixture(scope="module")
def cp_token():
    token = get_token(CP_EMAIL, CP_PASS)
    if not token:
        pytest.skip("CP auth failed")
    return token


@pytest.fixture(scope="module")
def first_project_id(admin_token):
    """Get first project to test endpoints."""
    r = requests.get(f"{BASE_URL}/api/projects", headers=get_headers(admin_token))
    assert r.status_code == 200
    projects = r.json()
    if not projects:
        pytest.skip("No projects available")
    return projects[0].get("project_id") or projects[0].get("id")


# ===================== GET /api/project-templates =====================

class TestProjectTemplates:
    """Tests for project templates endpoints."""

    def test_list_templates_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/project-templates", headers=get_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Templates count: {len(data)}")

    def test_list_templates_has_3_defaults(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/project-templates", headers=get_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3, f"Expected >=3 templates, got {len(data)}"
        methodologies = [t.get("methodology") for t in data]
        print(f"Methodologies: {methodologies}")
        assert "waterfall" in methodologies, "Waterfall template missing"
        assert "agile" in methodologies, "Agile template missing"
        assert "safe" in methodologies, "SAFe template missing"

    def test_templates_have_phases(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/project-templates", headers=get_headers(admin_token))
        data = r.json()
        for tpl in data:
            phases = tpl.get("phases", [])
            name = tpl.get("name", "")
            meth = tpl.get("methodology", "")
            print(f"Template {name} ({meth}): {len(phases)} phases")
            assert len(phases) > 0, f"Template {name} has no phases"

    def test_waterfall_has_6_phases(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/project-templates", headers=get_headers(admin_token))
        data = r.json()
        wf = next((t for t in data if t.get("methodology") == "waterfall"), None)
        assert wf is not None
        assert len(wf.get("phases", [])) == 6, f"Waterfall expected 6 phases, got {len(wf.get('phases', []))}"

    def test_agile_has_5_phases(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/project-templates", headers=get_headers(admin_token))
        data = r.json()
        ag = next((t for t in data if t.get("methodology") == "agile"), None)
        assert ag is not None
        assert len(ag.get("phases", [])) == 5, f"Agile expected 5 phases, got {len(ag.get('phases', []))}"

    def test_safe_has_4_phases(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/project-templates", headers=get_headers(admin_token))
        data = r.json()
        safe = next((t for t in data if t.get("methodology") == "safe"), None)
        assert safe is not None
        assert len(safe.get("phases", [])) == 4, f"SAFe expected 4 phases, got {len(safe.get('phases', []))}"

    def test_apply_template(self, admin_token, first_project_id):
        # Get template id first
        r = requests.get(f"{BASE_URL}/api/project-templates", headers=get_headers(admin_token))
        data = r.json()
        template_id = data[0].get("template_id")
        assert template_id

        r2 = requests.post(
            f"{BASE_URL}/api/projects/{first_project_id}/apply-template",
            headers=get_headers(admin_token),
            json={"template_id": template_id}
        )
        print(f"apply-template status: {r2.status_code}, response: {r2.text[:200]}")
        assert r2.status_code in [200, 201], f"apply-template failed: {r2.text}"

    def test_apply_template_without_id_returns_400(self, admin_token, first_project_id):
        r = requests.post(
            f"{BASE_URL}/api/projects/{first_project_id}/apply-template",
            headers=get_headers(admin_token),
            json={}
        )
        assert r.status_code == 400


# ===================== Status Report Weather =====================

class TestStatusReportWeather:
    """Tests for weather / status report endpoints."""

    def test_weather_admin(self, admin_token, first_project_id):
        r = requests.get(
            f"{BASE_URL}/api/projects/{first_project_id}/weather",
            headers=get_headers(admin_token)
        )
        print(f"weather status: {r.status_code}, response: {r.text[:400]}")
        assert r.status_code == 200

    def test_weather_has_4_indicators(self, admin_token, first_project_id):
        r = requests.get(
            f"{BASE_URL}/api/projects/{first_project_id}/weather",
            headers=get_headers(admin_token)
        )
        data = r.json()
        for key in ["perimeter", "budget", "calendar", "scope_change"]:
            assert key in data, f"Missing indicator: {key}"
            level = data[key].get("level")
            print(f"  {key}: {level}")
            assert level in ["soleil", "nuage", "pluie", "orage", "gel"], f"Invalid level for {key}: {level}"

    def test_weather_cp_has_access(self, cp_token, first_project_id):
        r = requests.get(
            f"{BASE_URL}/api/projects/{first_project_id}/weather",
            headers=get_headers(cp_token)
        )
        print(f"CP weather status: {r.status_code}")
        assert r.status_code == 200, f"CP should have access to weather: {r.text}"

    def test_weather_no_auth_returns_401_or_403(self, first_project_id):
        # FastAPI HTTPBearer returns 403 when no credentials provided
        r = requests.get(f"{BASE_URL}/api/projects/{first_project_id}/weather")
        assert r.status_code in [401, 403]


# ===================== Status Report PPT Generation =====================

class TestStatusReportGeneration:
    """Tests for PPT generation."""

    def test_generate_ppt_admin(self, admin_token, first_project_id):
        r = requests.post(
            f"{BASE_URL}/api/projects/{first_project_id}/status-report",
            headers=get_headers(admin_token),
            json={}
        )
        print(f"generate PPT status: {r.status_code}")
        print(f"Content-Type: {r.headers.get('content-type')}")
        print(f"Content size: {len(r.content)} bytes")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "presentationml" in ct or "pptx" in ct, f"Expected pptx content type, got: {ct}"
        assert len(r.content) > 10_000, f"PPT too small: {len(r.content)} bytes"

    def test_generate_ppt_with_overrides(self, admin_token, first_project_id):
        payload = {
            "perimeter_override": "pluie",
            "perimeter_comment": "Retard scope",
            "budget_comment": "Budget OK",
        }
        r = requests.post(
            f"{BASE_URL}/api/projects/{first_project_id}/status-report",
            headers=get_headers(admin_token),
            json=payload
        )
        assert r.status_code == 200
        assert len(r.content) > 10_000

    def test_generate_ppt_cp_has_access(self, cp_token, first_project_id):
        r = requests.post(
            f"{BASE_URL}/api/projects/{first_project_id}/status-report",
            headers=get_headers(cp_token),
            json={}
        )
        print(f"CP generate PPT status: {r.status_code}")
        assert r.status_code == 200, f"CP should be able to generate PPT: {r.text[:200]}"

    def test_generate_ppt_no_auth_returns_401_or_403(self, first_project_id):
        # FastAPI HTTPBearer returns 403 when no credentials provided
        r = requests.post(
            f"{BASE_URL}/api/projects/{first_project_id}/status-report",
            json={}
        )
        assert r.status_code in [401, 403]
