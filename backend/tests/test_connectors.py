"""
Backend tests for Connectors module - Jira, SAP, ServiceNow
Tests: list, config CRUD, sync, test connection, logs, status, RBAC
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin2026!"}
VIEWER_CREDS = {"email": "viewer@altair.fr", "password": "View1234!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def viewer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER_CREDS)
    if r.status_code != 200:
        pytest.skip("Viewer login failed")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}


class TestListConnectors:
    """GET /api/connectors - returns 3 connectors"""

    def test_list_returns_3_connectors(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 3
        types = {c["type"] for c in data}
        assert types == {"jira", "sap", "servicenow"}
        print(f"✓ List connectors: {len(data)} connectors returned")

    def test_list_unauthenticated_fails(self):
        r = requests.get(f"{BASE_URL}/api/connectors")
        assert r.status_code in [401, 403]
        print("✓ Unauthenticated list rejected")


class TestGetConfig:
    """GET /api/connectors/{type}/config - credentials masked"""

    def test_jira_config_masked_credentials(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/jira/config", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "auth_credentials" in data
        # Credentials should be masked (values are ••••••••) or empty dict
        creds = data["auth_credentials"]
        for val in creds.values():
            if val:
                assert val == "••••••••", f"Credential not masked: {val}"
        print(f"✓ Jira config credentials masked: {creds}")

    def test_sap_config_accessible(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/sap/config", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["type"] == "sap"
        print(f"✓ SAP config: base_url={data.get('base_url')}")

    def test_invalid_connector_type(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/unknown/config", headers=admin_headers)
        assert r.status_code == 400
        print("✓ Invalid connector type returns 400")


class TestUpsertConfig:
    """PUT /api/connectors/{type}/config"""

    def test_save_jira_config(self, admin_headers):
        payload = {
            "base_url": "https://acme.atlassian.net",
            "auth_type": "api_token",
            "sync_direction": "import",
            "sync_frequency": "daily",
        }
        r = requests.put(f"{BASE_URL}/api/connectors/jira/config", json=payload, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["base_url"] == "https://acme.atlassian.net"
        assert data["auth_type"] == "api_token"
        assert data["sync_direction"] == "import"
        assert data["sync_frequency"] == "daily"
        print("✓ Jira config saved correctly")

    def test_viewer_cannot_save_config(self, viewer_headers):
        payload = {"base_url": "https://acme.atlassian.net"}
        r = requests.put(f"{BASE_URL}/api/connectors/jira/config", json=payload, headers=viewer_headers)
        assert r.status_code == 403
        print("✓ Viewer cannot save config - 403 returned")


class TestTestConnection:
    """POST /api/connectors/{type}/test"""

    def test_jira_test_empty_credentials_fails(self, admin_headers):
        # Jira with empty creds should return {success: false, message: '...Credentials...'}
        r = requests.post(f"{BASE_URL}/api/connectors/jira/test", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == False
        assert "Credentials" in data["message"] or "configuré" in data["message"]
        print(f"✓ Jira test with no creds: {data['message']}")

    def test_sap_test_demo_url_success(self, admin_headers):
        # Set SAP URL AND credentials (required for test_connection)
        requests.put(f"{BASE_URL}/api/connectors/sap/config",
                     json={"base_url": "https://sap.acme.fr/odata",
                           "auth_credentials": {"username": "demo_user", "password": "demo_pass"}},
                     headers=admin_headers)
        r = requests.post(f"{BASE_URL}/api/connectors/sap/test", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        print(f"✓ SAP test with acme URL: success={data['success']}, msg={data.get('message')}")

    def test_test_connection_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/connectors/jira/test")
        assert r.status_code in [401, 403]
        print("✓ Test connection rejects unauthenticated")


class TestSync:
    """POST /api/connectors/{type}/sync"""

    def test_jira_sync_generates_log(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/connectors/jira/sync", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "log_id" in data
        assert data["status"] in ["success", "partial", "error"]
        assert data["items_processed"] > 0
        print(f"✓ Jira sync: items_processed={data['items_processed']}, status={data['status']}")

    def test_sap_sync_returns_8_updated(self, admin_headers):
        # First set direction to export so it returns deterministically 8
        requests.put(f"{BASE_URL}/api/connectors/sap/config",
                     json={"sync_direction": "export"},
                     headers=admin_headers)
        r = requests.post(f"{BASE_URL}/api/connectors/sap/sync", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["items_updated"] == 8  # export path always returns 8
        assert data["status"] == "success"
        print(f"✓ SAP sync (export): items_updated={data['items_updated']}, status={data['status']}")

    def test_servicenow_sync_generates_log(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/connectors/servicenow/sync", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "log_id" in data
        assert data["items_processed"] > 0
        print(f"✓ ServiceNow sync: items_processed={data['items_processed']}, status={data['status']}")

    def test_sync_requires_admin(self, viewer_headers):
        r = requests.post(f"{BASE_URL}/api/connectors/jira/sync", headers=viewer_headers)
        assert r.status_code == 403
        print("✓ Sync requires admin.config permission")

    def test_sync_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/connectors/jira/sync")
        assert r.status_code in [401, 403]
        print("✓ Sync rejects unauthenticated")


class TestLogs:
    """GET /api/connectors/{type}/logs"""

    def test_jira_logs_returns_seeded_data(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/jira/logs", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # 3 seeded logs + possibly more from sync tests
        log = data[0]
        assert "log_id" in log
        assert "status" in log
        assert "items_processed" in log
        print(f"✓ Jira logs: {len(data)} entries, latest status={log['status']}")

    def test_sap_logs(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/sap/logs", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        print(f"✓ SAP logs: {len(data)} entries")

    def test_servicenow_logs(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/servicenow/logs", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"✓ ServiceNow logs: {len(data)} entries")


class TestStatus:
    """GET /api/connectors/{type}/status"""

    def test_jira_status_has_last_sync(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/jira/status", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["type"] == "jira"
        assert "last_sync_at" in data
        assert "enabled" in data
        print(f"✓ Jira status: last_sync_at={data.get('last_sync_at')}")

    def test_sap_status(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/connectors/sap/status", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["type"] == "sap"
        print(f"✓ SAP status: enabled={data.get('enabled')}, last_sync={data.get('last_sync_status')}")


class TestMapping:
    """PUT /api/connectors/{type}/mapping"""

    def test_update_jira_mapping(self, admin_headers):
        new_mapping = {
            "version": "1.0",
            "fields": [
                {"source": "summary", "target": "title", "label": "Titre", "enabled": True},
                {"source": "description", "target": "description", "label": "Description", "enabled": True},
            ]
        }
        r = requests.put(f"{BASE_URL}/api/connectors/jira/mapping",
                         json={"field_mapping": new_mapping},
                         headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["field_mapping"]["fields"][0]["source"] == "summary"
        print("✓ Jira mapping updated successfully")

    def test_mapping_requires_admin(self, viewer_headers):
        r = requests.put(f"{BASE_URL}/api/connectors/jira/mapping",
                         json={"field_mapping": {}},
                         headers=viewer_headers)
        assert r.status_code == 403
        print("✓ Mapping update requires admin permission")
