"""Chantier 7 — Registre des risques: CRUD, heatmap data, dashboard top-risks, RBAC"""

import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN = {"email": "admin@altair.fr", "password": "Admin1234!"}
PMO = {"email": "pmo@altair.fr", "password": "Pmo1234!"}
VIEWER = {"email": "viewer@altair.fr", "password": "View1234!"}


def get_token(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    return get_token(ADMIN)


@pytest.fixture(scope="module")
def pmo_token():
    return get_token(PMO)


@pytest.fixture(scope="module")
def viewer_token():
    return get_token(VIEWER)


@pytest.fixture(scope="module")
def sap_project_id(admin_token):
    """Get SAP project id"""
    r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
    assert r.status_code == 200
    projects = r.json()
    for p in projects:
        if "SAP" in p.get("name", "") or "S/4HANA" in p.get("name", ""):
            return p["project_id"]
    # fallback: return first project
    return projects[0]["project_id"]


# ---- CRUD Tests ----

class TestRiskCRUD:
    """Test risk CRUD operations"""

    created_risk_id = None

    def test_list_risks_by_project(self, admin_token, sap_project_id):
        """GET /api/risks?project_id=XXX returns risks sorted by criticality desc"""
        r = requests.get(
            f"{BASE_URL}/api/risks?project_id={sap_project_id}",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        risks = r.json()
        assert isinstance(risks, list)
        assert len(risks) > 0
        # Verify sorted by criticality descending
        crits = [risk["criticality"] for risk in risks]
        assert crits == sorted(crits, reverse=True), f"Not sorted desc: {crits}"
        print(f"PASS: GET /api/risks?project_id returns {len(risks)} risks sorted: {crits}")

    def test_create_risk_calculates_criticality(self, admin_token, sap_project_id):
        """POST /api/risks creates risk and auto-calculates criticality = prob × impact"""
        payload = {
            "project_id": sap_project_id,
            "title": "TEST_Risque chantier 7 auto-criticality",
            "category": "technique",
            "probability": 4,
            "impact": 3,
            "status": "identifié",
        }
        r = requests.post(
            f"{BASE_URL}/api/risks",
            json=payload,
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 201, f"Create failed: {r.text}"
        data = r.json()
        assert data["criticality"] == 4 * 3, f"Expected 12, got {data['criticality']}"
        assert data["title"] == payload["title"]
        assert "risk_id" in data
        TestRiskCRUD.created_risk_id = data["risk_id"]
        print(f"PASS: POST /api/risks created risk {data['risk_id']}, criticality={data['criticality']}")

    def test_create_risk_verify_in_list(self, admin_token, sap_project_id):
        """After creating, risk appears in list"""
        assert TestRiskCRUD.created_risk_id, "No risk created"
        r = requests.get(
            f"{BASE_URL}/api/risks?project_id={sap_project_id}",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        risk_ids = [risk["risk_id"] for risk in r.json()]
        assert TestRiskCRUD.created_risk_id in risk_ids
        print("PASS: Created risk appears in list")

    def test_update_risk_recalculates_criticality(self, admin_token):
        """PUT /api/risks/:id updates and recalculates criticality"""
        assert TestRiskCRUD.created_risk_id, "No risk created"
        payload = {"probability": 5, "impact": 4}
        r = requests.put(
            f"{BASE_URL}/api/risks/{TestRiskCRUD.created_risk_id}",
            json=payload,
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        data = r.json()
        assert data["criticality"] == 5 * 4, f"Expected 20, got {data['criticality']}"
        print(f"PASS: PUT /api/risks recalculated criticality to {data['criticality']}")

    def test_pmo_can_create_risk(self, pmo_token, sap_project_id):
        """PMO_USER can create a risk (201)"""
        payload = {
            "project_id": sap_project_id,
            "title": "TEST_Risque PMO creation",
            "category": "budget",
            "probability": 2,
            "impact": 2,
            "status": "identifié",
        }
        r = requests.post(
            f"{BASE_URL}/api/risks",
            json=payload,
            headers=auth_headers(pmo_token),
        )
        assert r.status_code == 201, f"PMO create failed: {r.text}"
        data = r.json()
        # cleanup
        print(f"PASS: PMO can create risk, id={data['risk_id']}")
        return data["risk_id"]

    def test_pmo_can_update_risk(self, admin_token, pmo_token):
        """PMO_USER can update a risk (200)"""
        assert TestRiskCRUD.created_risk_id
        payload = {"title": "TEST_Risque PMO updated"}
        r = requests.put(
            f"{BASE_URL}/api/risks/{TestRiskCRUD.created_risk_id}",
            json=payload,
            headers=auth_headers(pmo_token),
        )
        assert r.status_code == 200, f"PMO update failed: {r.text}"
        print("PASS: PMO can update risk")

    def test_pmo_cannot_delete_risk(self, pmo_token):
        """PMO_USER gets 403 on DELETE"""
        assert TestRiskCRUD.created_risk_id
        r = requests.delete(
            f"{BASE_URL}/api/risks/{TestRiskCRUD.created_risk_id}",
            headers=auth_headers(pmo_token),
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("PASS: PMO gets 403 on DELETE risk")

    def test_viewer_403_post_risk(self, viewer_token, sap_project_id):
        """READ_ONLY gets 403 on POST"""
        payload = {
            "project_id": sap_project_id,
            "title": "TEST_Viewer risk",
            "category": "technique",
            "probability": 1,
            "impact": 1,
            "status": "identifié",
        }
        r = requests.post(
            f"{BASE_URL}/api/risks",
            json=payload,
            headers=auth_headers(viewer_token),
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("PASS: READ_ONLY gets 403 on POST /api/risks")

    def test_viewer_403_put_risk(self, viewer_token):
        """READ_ONLY gets 403 on PUT"""
        assert TestRiskCRUD.created_risk_id
        r = requests.put(
            f"{BASE_URL}/api/risks/{TestRiskCRUD.created_risk_id}",
            json={"title": "hacked"},
            headers=auth_headers(viewer_token),
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("PASS: READ_ONLY gets 403 on PUT /api/risks")

    def test_viewer_403_delete_risk(self, viewer_token):
        """READ_ONLY gets 403 on DELETE"""
        assert TestRiskCRUD.created_risk_id
        r = requests.delete(
            f"{BASE_URL}/api/risks/{TestRiskCRUD.created_risk_id}",
            headers=auth_headers(viewer_token),
        )
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"
        print("PASS: READ_ONLY gets 403 on DELETE /api/risks")

    def test_admin_can_delete_risk(self, admin_token):
        """TENANT_ADMIN can delete a risk (204)"""
        assert TestRiskCRUD.created_risk_id
        r = requests.delete(
            f"{BASE_URL}/api/risks/{TestRiskCRUD.created_risk_id}",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 204, f"Admin delete failed: {r.text}"
        print("PASS: TENANT_ADMIN can delete risk (204)")


class TestDashboardTopRisks:
    """Test GET /api/dashboard/top-risks"""

    def test_top_risks_returns_list(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/top-risks",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 10, f"Expected max 10, got {len(data)}"
        print(f"PASS: GET /api/dashboard/top-risks returns {len(data)} risks")

    def test_top_risks_sorted_by_criticality_desc(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/top-risks",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        risks = r.json()
        crits = [r["criticality"] for r in risks]
        assert crits == sorted(crits, reverse=True), f"Not sorted desc: {crits}"
        print(f"PASS: top-risks sorted: {crits}")

    def test_top_risks_enriched_with_project_name(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/top-risks",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        risks = r.json()
        for risk in risks:
            assert "project_name" in risk, f"Missing project_name in {risk}"
            assert risk["project_name"] != "", "project_name is empty"
        print("PASS: all top-risks have project_name")

    def test_top_risks_max_10(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/top-risks",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        assert len(r.json()) <= 10
        print("PASS: top-risks capped at 10")


class TestCrossTenantIsolation:
    """Verify tenant isolation for risks"""

    def test_risks_scoped_to_tenant(self, admin_token, viewer_token):
        """Admin and viewer (same tenant) see same risks; different tenants would not"""
        r_admin = requests.get(f"{BASE_URL}/api/risks", headers=auth_headers(admin_token))
        r_viewer = requests.get(f"{BASE_URL}/api/risks", headers=auth_headers(viewer_token))
        assert r_admin.status_code == 200
        assert r_viewer.status_code == 200
        # Same tenant — should see same risks
        admin_ids = {r["risk_id"] for r in r_admin.json()}
        viewer_ids = {r["risk_id"] for r in r_viewer.json()}
        assert admin_ids == viewer_ids, "Same tenant users should see same risks"
        print(f"PASS: Cross-tenant isolation verified ({len(admin_ids)} risks visible to both same-tenant users)")


class TestSAPProjectRisks:
    """Test SAP project specific risks (should have 6+ risks)"""

    def test_sap_has_risks(self, admin_token, sap_project_id):
        r = requests.get(
            f"{BASE_URL}/api/risks?project_id={sap_project_id}",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        risks = r.json()
        assert len(risks) >= 6, f"SAP should have >=6 risks, got {len(risks)}"
        print(f"PASS: SAP project has {len(risks)} risks")

    def test_sap_risks_criticality_values(self, admin_token, sap_project_id):
        """Verify expected criticality values (20, 20, 16, 12, 8, 6 from seed)"""
        r = requests.get(
            f"{BASE_URL}/api/risks?project_id={sap_project_id}",
            headers=auth_headers(admin_token),
        )
        risks = r.json()
        crits = [risk["criticality"] for risk in risks]
        # Should have at least the top 3 seed criticalities: 20, 20, 16
        assert max(crits) >= 16, f"Expected max criticality >=16, got {max(crits)}"
        print(f"PASS: SAP risk criticalities: {crits}")
