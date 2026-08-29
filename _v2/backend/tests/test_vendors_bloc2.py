"""
Backend tests for Bloc 2: Vendors & Resource Enrichment
Tests: /api/vendors/summary, /api/vendors/project/{project_id}, Resources type filters
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PASSWORD = "Admin1234!"
ACHATS_EMAIL = "achats@altair.fr"
ACHATS_PASSWORD = "Altair2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def achats_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ACHATS_EMAIL, "password": ACHATS_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Achats login failed: {r.text}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def achats_headers(achats_token):
    return {"Authorization": f"Bearer {achats_token}"}


class TestVendorsSummary:
    """Tests for GET /api/vendors/summary"""

    def test_vendors_summary_status_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_vendors_summary_has_required_fields(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        data = r.json()
        assert "vendors" in data
        assert "summary" in data
        summary = data["summary"]
        assert "total_vendors" in summary
        assert "total_regie_resources" in summary
        assert "total_forfait_resources" in summary
        assert "total_alerts" in summary

    def test_vendors_summary_total_vendors_is_5(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        summary = r.json()["summary"]
        assert summary["total_vendors"] == 5, f"Expected 5 vendors, got {summary['total_vendors']}"

    def test_vendors_summary_regie_count(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        summary = r.json()["summary"]
        assert summary["total_regie_resources"] == 3, f"Expected 3 regie, got {summary['total_regie_resources']}"

    def test_vendors_summary_forfait_count(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        summary = r.json()["summary"]
        assert summary["total_forfait_resources"] == 2, f"Expected 2 forfait, got {summary['total_forfait_resources']}"

    def test_vendors_summary_alerts_gte_3(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        summary = r.json()["summary"]
        assert summary["total_alerts"] >= 3, f"Expected >=3 alerts, got {summary['total_alerts']}"

    def test_vendors_list_contains_expected_names(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        vendors = r.json()["vendors"]
        names = [v["vendor"] for v in vendors]
        expected = ["Capgemini", "Accenture", "Sopra Steria", "IBM France", "Atos"]
        for e in expected:
            assert e in names, f"Vendor '{e}' not found in {names}"

    def test_accenture_has_tjm_variance_alert(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        vendors = r.json()["vendors"]
        accenture = next((v for v in vendors if v["vendor"] == "Accenture"), None)
        assert accenture is not None, "Accenture vendor not found"
        alert_types = [a["type"] for a in accenture.get("alerts", [])]
        assert "tjm_variance" in alert_types, f"No TJM variance alert for Accenture. Alerts: {accenture['alerts']}"

    def test_sopra_steria_has_forfait_alert(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=admin_headers)
        vendors = r.json()["vendors"]
        sopra = next((v for v in vendors if v["vendor"] == "Sopra Steria"), None)
        assert sopra is not None, "Sopra Steria vendor not found"
        alert_types = [a["type"] for a in sopra.get("alerts", [])]
        assert "forfait_consumption" in alert_types, f"No forfait alert for Sopra Steria. Alerts: {sopra['alerts']}"

    def test_vendors_summary_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/vendors/summary")
        assert r.status_code in [401, 403], f"Expected auth error, got {r.status_code}"

    def test_achats_can_access_vendors_summary(self, achats_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/summary", headers=achats_headers)
        assert r.status_code == 200, f"Achats user should access vendors. Got {r.status_code}: {r.text}"


class TestVendorsProjectCosts:
    """Tests for GET /api/vendors/project/{project_id}"""

    def test_get_cloud_azure_project_id(self, admin_headers):
        """Find Cloud Azure project ID"""
        r = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
        assert r.status_code == 200
        projects = r.json()
        azure = next((p for p in projects if "Cloud Azure" in p.get("name", "")), None)
        assert azure is not None, f"Cloud Azure project not found. Projects: {[p['name'] for p in projects[:5]]}"

    def test_project_external_costs_positive_regie(self, admin_headers):
        """Cloud Azure should have total_regie_eur > 0"""
        # Get project ID first
        r = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
        projects = r.json()
        azure = next((p for p in projects if "Cloud Azure" in p.get("name", "")), None)
        if not azure:
            pytest.skip("Cloud Azure project not found")
        project_id = azure["project_id"]

        r2 = requests.get(f"{BASE_URL}/api/vendors/project/{project_id}", headers=admin_headers)
        assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
        data = r2.json()
        assert data["total_regie_eur"] > 0, f"Expected total_regie_eur > 0, got {data['total_regie_eur']}"

    def test_project_external_costs_has_resources(self, admin_headers):
        """Cloud Azure should have non-empty resources"""
        r = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
        projects = r.json()
        azure = next((p for p in projects if "Cloud Azure" in p.get("name", "")), None)
        if not azure:
            pytest.skip("Cloud Azure project not found")
        project_id = azure["project_id"]

        r2 = requests.get(f"{BASE_URL}/api/vendors/project/{project_id}", headers=admin_headers)
        data = r2.json()
        assert len(data["resources"]) > 0, f"Expected non-empty resources list"

    def test_project_external_costs_404_on_unknown(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/vendors/project/nonexistent-project-id", headers=admin_headers)
        assert r.status_code == 404


class TestResourcesList:
    """Tests for GET /api/resources - type enrichment"""

    def test_resources_list_status_200(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/resources", headers=admin_headers)
        assert r.status_code == 200

    def test_resources_have_resource_type_field(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/resources", headers=admin_headers)
        resources = r.json()
        assert len(resources) >= 15, f"Expected >=15 resources, got {len(resources)}"
        # Check some have explicit types
        types = [res.get("resource_type") for res in resources]
        assert "externe_regie" in types, "No externe_regie resources found"
        assert "externe_forfait" in types, "No externe_forfait resources found"

    def test_resources_external_have_vendor_field(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/resources", headers=admin_headers)
        resources = r.json()
        external = [res for res in resources if res.get("resource_type") in ["externe_regie", "externe_forfait"]]
        assert len(external) == 5, f"Expected 5 external resources, got {len(external)}"
        for ext in external:
            assert ext.get("vendor"), f"External resource {ext['name']} has no vendor"

    def test_regie_resources_have_contract_tjm(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/resources", headers=admin_headers)
        resources = r.json()
        regie = [res for res in resources if res.get("resource_type") == "externe_regie"]
        assert len(regie) == 3, f"Expected 3 regie resources, got {len(regie)}"
        for reg in regie:
            assert reg.get("contract_tjm") is not None, f"Regie resource {reg['name']} missing contract_tjm"

    def test_forfait_resources_have_envelope(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/resources", headers=admin_headers)
        resources = r.json()
        forfait = [res for res in resources if res.get("resource_type") == "externe_forfait"]
        assert len(forfait) == 2, f"Expected 2 forfait resources, got {len(forfait)}"
        for f in forfait:
            assert f.get("forfait_envelope") is not None, f"Forfait resource {f['name']} missing forfait_envelope"
