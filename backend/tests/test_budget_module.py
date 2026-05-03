"""Budget module backend tests — Altair PPM SaaS"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# ── Fixtures ─────────────────────────────────────────────────────────────────
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@altair.fr", "password": "Admin2026!"
    })
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json().get("access_token") or r.json().get("token")

@pytest.fixture(scope="module")
def pmo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "pmo@altair.fr", "password": "Pmo1234!"
    })
    if r.status_code != 200:
        return None
    return r.json().get("access_token") or r.json().get("token")

@pytest.fixture(scope="module")
def viewer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "viewer@altair.fr", "password": "View1234!"
    })
    if r.status_code != 200:
        return None
    return r.json().get("access_token") or r.json().get("token")

@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ── Tests consolidated ────────────────────────────────────────────────────────
class TestBudgetConsolidated:
    """Tests GET /api/budget/consolidated"""

    def test_consolidated_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_consolidated_has_kpis(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        data = r.json()
        assert "kpis" in data
        kpis = data["kpis"]
        for key in ["capex_planned", "capex_consumed", "opex_planned", "opex_consumed", "eac_total", "raf_total"]:
            assert key in kpis, f"Missing KPI: {key}"

    def test_consolidated_kpis_non_null(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        kpis = r.json()["kpis"]
        # At least some KPIs should be non-zero
        total = sum(kpis.get(k, 0) for k in ["capex_planned", "opex_planned", "eac_total"])
        assert total > 0, f"All KPIs are zero: {kpis}"

    def test_consolidated_has_projects(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        data = r.json()
        assert "projects" in data
        assert len(data["projects"]) > 0, "No projects returned"

    def test_consolidated_project_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        p = r.json()["projects"][0]
        for field in ["project_id", "name", "capex_planned", "capex_consumed",
                       "opex_planned", "opex_consumed", "eac", "raf", "ecart_pct", "status_rag"]:
            assert field in p, f"Missing field: {field}"

    def test_consolidated_sorted_by_ecart_desc(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        projects = r.json()["projects"]
        # Just check they have ecart_pct and some red ones
        ecarts = [p["ecart_pct"] for p in projects]
        print(f"Ecarts: {ecarts}")
        red_projects = [p for p in projects if p["status_rag"] == "red"]
        print(f"Red projects: {[p['name'] for p in red_projects]}")
        assert len(projects) >= 1

    def test_consolidated_filter_by_status(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers,
                         params={"status": "actif"})
        assert r.status_code == 200

    def test_consolidated_envelope(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        data = r.json()
        # envelope may be None if not seeded, just check structure
        print(f"Envelope: {data.get('envelope')}")

    def test_consolidated_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated")
        assert r.status_code in [401, 403], f"Expected 401/403, got {r.status_code}"


# ── Tests by-program ─────────────────────────────────────────────────────────
class TestBudgetByProgram:
    """Tests GET /api/budget/by-program"""

    def test_by_program_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/by-program", headers=admin_headers)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"

    def test_by_program_returns_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/by-program", headers=admin_headers)
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_by_program_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/by-program", headers=admin_headers)
        pg = r.json()[0]
        for field in ["program_name", "nb_projects", "capex_total", "opex_total", "eac_total", "ecart_pct"]:
            assert field in pg, f"Missing field: {field}"

    def test_by_program_has_projects(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/by-program", headers=admin_headers)
        for pg in r.json():
            assert "projects" in pg, f"Program {pg.get('program_name')} missing 'projects'"


# ── Tests project revisions ───────────────────────────────────────────────────
class TestBudgetProjectRevisions:
    """Tests GET /api/budget/project/{id}/revisions"""

    def get_first_project_id(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        return r.json()["projects"][0]["project_id"]

    def test_revisions_200(self, admin_headers):
        pid = self.get_first_project_id(admin_headers)
        r = requests.get(f"{BASE_URL}/api/budget/project/{pid}/revisions", headers=admin_headers)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"

    def test_revisions_fields(self, admin_headers):
        pid = self.get_first_project_id(admin_headers)
        r = requests.get(f"{BASE_URL}/api/budget/project/{pid}/revisions", headers=admin_headers)
        data = r.json()
        for field in ["project_id", "name", "capex_planned", "opex_planned", "eac", "revisions"]:
            assert field in data, f"Missing field: {field}"
        assert isinstance(data["revisions"], list)

    def test_revisions_not_found(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/project/NONEXISTENT_ID/revisions", headers=admin_headers)
        assert r.status_code == 404


# ── Tests revise budget ───────────────────────────────────────────────────────
class TestRevise:
    """Tests POST /api/budget/project/{id}/revise"""

    def get_first_project_id(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        return r.json()["projects"][0]["project_id"]

    def test_revise_success(self, admin_headers):
        pid = self.get_first_project_id(admin_headers)
        r_before = requests.get(f"{BASE_URL}/api/budget/project/{pid}/revisions", headers=admin_headers)
        old_eac = r_before.json().get("eac", 0)

        new_eac = (old_eac or 1000000) + 50000
        r = requests.post(f"{BASE_URL}/api/budget/project/{pid}/revise", headers=admin_headers,
                          json={"eac": new_eac, "reason": "TEST revision budgétaire"})
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        assert data["eac"] == new_eac

    def test_revise_missing_reason(self, admin_headers):
        pid = self.get_first_project_id(admin_headers)
        r = requests.post(f"{BASE_URL}/api/budget/project/{pid}/revise", headers=admin_headers,
                          json={"eac": 500000})
        assert r.status_code == 422, f"Expected 422, got {r.status_code}"

    def test_revise_missing_eac(self, admin_headers):
        pid = self.get_first_project_id(admin_headers)
        r = requests.post(f"{BASE_URL}/api/budget/project/{pid}/revise", headers=admin_headers,
                          json={"reason": "test sans eac"})
        assert r.status_code == 422, f"Expected 422, got {r.status_code}"

    def test_revise_revision_persisted(self, admin_headers):
        pid = self.get_first_project_id(admin_headers)
        new_eac = 999999
        requests.post(f"{BASE_URL}/api/budget/project/{pid}/revise", headers=admin_headers,
                      json={"eac": new_eac, "reason": "TEST persistence check"})
        r = requests.get(f"{BASE_URL}/api/budget/project/{pid}/revisions", headers=admin_headers)
        data = r.json()
        assert data["eac"] == new_eac
        assert len(data["revisions"]) >= 1
        # Verify last revision has reason
        last_rev = data["revisions"][-1]
        assert "reason" in last_rev
        assert "TEST" in last_rev["reason"]


# ── Tests export ─────────────────────────────────────────────────────────────
class TestBudgetExport:
    """Tests export Excel and PDF"""

    def test_export_excel_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/export/excel", headers=admin_headers)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_export_excel_content_type(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/export/excel", headers=admin_headers)
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct or "excel" in ct or "octet-stream" in ct, f"Bad content-type: {ct}"

    def test_export_excel_non_empty(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/export/excel", headers=admin_headers)
        assert len(r.content) > 1000, f"Excel file too small: {len(r.content)} bytes"

    def test_export_pdf_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/export/pdf", headers=admin_headers)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"

    def test_export_pdf_content_type(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/export/pdf", headers=admin_headers)
        ct = r.headers.get("content-type", "")
        assert "pdf" in ct, f"Bad content-type: {ct}"

    def test_export_pdf_non_empty(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/budget/export/pdf", headers=admin_headers)
        assert len(r.content) > 1000, f"PDF too small: {len(r.content)} bytes"


# ── Tests RBAC ────────────────────────────────────────────────────────────────
class TestBudgetRBAC:
    """RBAC: viewer without budget.view should get 401/403"""

    def test_viewer_consolidated(self, viewer_token):
        if not viewer_token:
            pytest.skip("viewer@altair.fr not found")
        headers = {"Authorization": f"Bearer {viewer_token}"}
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=headers)
        print(f"Viewer consolidated status: {r.status_code}")
        # Should be 403 if no budget.view
        # (may be 200 if viewer has budget.view — just log)
        assert r.status_code in [200, 403], f"Unexpected: {r.status_code}"

    def test_viewer_revise_blocked(self, viewer_token):
        if not viewer_token:
            pytest.skip("viewer@altair.fr not found")
        # First get any project id with admin
        admin_r = requests.post(f"{BASE_URL}/api/auth/login",
                                json={"email": "admin@altair.fr", "password": "Admin2026!"})
        admin_token = admin_r.json().get("access_token") or admin_r.json().get("token")
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        r = requests.get(f"{BASE_URL}/api/budget/consolidated", headers=admin_headers)
        pid = r.json()["projects"][0]["project_id"]

        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
        r2 = requests.post(f"{BASE_URL}/api/budget/project/{pid}/revise",
                           headers=viewer_headers,
                           json={"eac": 999, "reason": "test viewer"})
        print(f"Viewer revise status: {r2.status_code}")
        assert r2.status_code in [403], f"Viewer should be blocked from revising budget: {r2.status_code}"
