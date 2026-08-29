"""
Chantier 6: Budget CAPEX/OPEX + EAC + Revision History backend tests
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

def login(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
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

def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}

class TestProjectStatus:
    """Test project status field and filtering"""

    def test_projects_have_status_field(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
        assert r.status_code == 200
        projects = r.json()
        assert len(projects) > 0
        for p in projects:
            assert "status" in p, f"Project {p.get('name')} missing status field"
        print(f"PASS: All {len(projects)} projects have status field")

    def test_filter_en_pause_returns_portail_rh(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
        projects = r.json()
        en_pause = [p for p in projects if p.get("status") == "en_pause"]
        names = [p["name"] for p in en_pause]
        assert any("Portail RH" in n or "portail" in n.lower() for n in names), f"No 'Portail RH' in en_pause: {names}"
        print(f"PASS: en_pause projects: {names}")

    def test_filter_en_preparation_returns_dora(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
        projects = r.json()
        en_prep = [p for p in projects if p.get("status") == "en_preparation"]
        names = [p["name"] for p in en_prep]
        assert any("DORA" in n or "NIS2" in n for n in names), f"No 'DORA-NIS2' in en_preparation: {names}"
        print(f"PASS: en_preparation projects: {names}")


class TestSAPProjectCapexOpex:
    """Test SAP S/4HANA project CAPEX/OPEX data"""

    def get_sap_project(self, token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(token))
        projects = r.json()
        sap = next((p for p in projects if "SAP" in p.get("name", "") or "S/4HANA" in p.get("name", "")), None)
        return sap

    def test_sap_capex_planned_2000k(self, admin_token):
        sap = self.get_sap_project(admin_token)
        assert sap is not None, "SAP S/4HANA project not found"
        # 2000 K€ = 2_000_000
        assert abs(sap.get("capex_planned", 0) - 2_000_000) < 1000, f"capex_planned={sap.get('capex_planned')}"
        print(f"PASS: capex_planned={sap['capex_planned']}")

    def test_sap_capex_consumed_1640k(self, admin_token):
        sap = self.get_sap_project(admin_token)
        assert abs(sap.get("capex_consumed", 0) - 1_640_000) < 1000, f"capex_consumed={sap.get('capex_consumed')}"
        print(f"PASS: capex_consumed={sap['capex_consumed']}")

    def test_sap_opex_planned_3000k(self, admin_token):
        sap = self.get_sap_project(admin_token)
        assert abs(sap.get("opex_planned", 0) - 3_000_000) < 1000, f"opex_planned={sap.get('opex_planned')}"
        print(f"PASS: opex_planned={sap['opex_planned']}")

    def test_sap_opex_consumed_2460k(self, admin_token):
        sap = self.get_sap_project(admin_token)
        assert abs(sap.get("opex_consumed", 0) - 2_460_000) < 1000, f"opex_consumed={sap.get('opex_consumed')}"
        print(f"PASS: opex_consumed={sap['opex_consumed']}")

    def test_sap_eac_6500k_after_revision(self, admin_token):
        sap = self.get_sap_project(admin_token)
        eac = sap.get("eac") or sap.get("budget_forecast")
        assert eac is not None, "EAC/budget_forecast missing"
        assert abs(eac - 6_500_000) < 1000, f"eac={eac}, expected ~6500000"
        print(f"PASS: eac={eac}")

    def test_sap_has_3_revision_history(self, admin_token):
        sap = self.get_sap_project(admin_token)
        history = sap.get("budget_revision_history", [])
        assert len(history) == 3, f"Expected 3 revisions, got {len(history)}: {history}"
        print(f"PASS: revision history has {len(history)} entries")

    def test_sap_budget_total_calculated(self, admin_token):
        sap = self.get_sap_project(admin_token)
        # budget_total = capex_planned + opex_planned = 5_000_000
        assert abs(sap.get("budget_total", 0) - 5_000_000) < 1000, f"budget_total={sap.get('budget_total')}"
        print(f"PASS: budget_total={sap['budget_total']}")


class TestBudgetRevisionEndpoint:
    """Test POST /api/projects/:id/budget-revision"""

    def get_sap_id(self, token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(token))
        projects = r.json()
        sap = next((p for p in projects if "SAP" in p.get("name", "") or "S/4HANA" in p.get("name", "")), None)
        return sap["project_id"] if sap else None

    def test_admin_can_revise_budget(self, admin_token):
        pid = self.get_sap_id(admin_token)
        assert pid is not None
        # Get current eac before revision
        r_before = requests.get(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers(admin_token))
        before_count = len(r_before.json().get("budget_revision_history", []))
        
        # Post revision
        r = requests.post(f"{BASE_URL}/api/projects/{pid}/budget-revision",
            headers=auth_headers(admin_token),
            json={"eac": 6600000, "reason": "TEST revision admin", "author": "Test Agent"})
        assert r.status_code == 200, f"Revision failed: {r.text}"
        
        # Verify history grew
        r_after = requests.get(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers(admin_token))
        after_count = len(r_after.json().get("budget_revision_history", []))
        assert after_count == before_count + 1
        print(f"PASS: admin revision added (count: {before_count} -> {after_count})")

    def test_pmo_can_revise_budget(self, pmo_token):
        pid = self.get_sap_id(pmo_token)
        assert pid is not None
        r = requests.post(f"{BASE_URL}/api/projects/{pid}/budget-revision",
            headers=auth_headers(pmo_token),
            json={"eac": 6500000, "reason": "TEST PMO revert", "author": "PMO Test"})
        assert r.status_code == 200
        print("PASS: PMO can revise budget")

    def test_viewer_cannot_revise_budget(self, viewer_token):
        pid = self.get_sap_id(viewer_token)
        assert pid is not None
        r = requests.post(f"{BASE_URL}/api/projects/{pid}/budget-revision",
            headers=auth_headers(viewer_token),
            json={"eac": 9999000, "reason": "Should be blocked", "author": "Viewer"})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("PASS: viewer cannot revise budget (403)")


class TestProjectCreateCapexOpex:
    """Test project creation with CAPEX/OPEX fields"""

    def test_create_project_with_capex_opex(self, admin_token):
        payload = {
            "name": "TEST_CAPEX_OPEX_Project",
            "methodology": "waterfall",
            "status_rag": "green",
            "status": "actif",
            "start_date": "2026-01-01",
            "end_date_baseline": "2026-12-31",
            "end_date_forecast": "2026-12-31",
            "capex_planned": 500000,
            "capex_consumed": 0,
            "opex_planned": 1000000,
            "opex_consumed": 0,
            "jh_planned": 100,
            "jh_consumed": 0,
        }
        r = requests.post(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token), json=payload)
        assert r.status_code == 201, f"Create failed: {r.text}"
        data = r.json()
        assert abs(data.get("budget_total", 0) - 1_500_000) < 1000, f"budget_total={data.get('budget_total')}, expected 1500000"
        assert abs(data.get("capex_planned", 0) - 500000) < 1
        assert abs(data.get("opex_planned", 0) - 1000000) < 1
        print(f"PASS: project created, budget_total={data['budget_total']}")
        
        # Cleanup
        pid = data.get("project_id")
        if pid:
            requests.delete(f"{BASE_URL}/api/projects/{pid}", headers=auth_headers(admin_token))
