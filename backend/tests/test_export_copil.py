"""Tests for Chantier 5: Export COPIL PPTX endpoint"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

def get_token(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if r.status_code == 200:
        return r.json().get("access_token")
    return None

@pytest.fixture(scope="module")
def admin_token():
    token = get_token("admin@altair.fr", "Admin1234!")
    if not token:
        pytest.skip("Admin auth failed")
    return token

@pytest.fixture(scope="module")
def pmo_token():
    token = get_token("pmo@altair.fr", "Pmo1234!")
    if not token:
        pytest.skip("PMO auth failed")
    return token

@pytest.fixture(scope="module")
def viewer_token():
    token = get_token("viewer@altair.fr", "View1234!")
    if not token:
        pytest.skip("Viewer auth failed")
    return token

@pytest.fixture(scope="module")
def first_project_id(admin_token):
    """Get first project_id from portfolio"""
    r = requests.get(f"{BASE_URL}/api/projects", headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 0, "No projects found"
    return projects[0]["project_id"], projects[0]["name"]


class TestExportCopilAPI:
    """Tests for POST /api/export/copil"""

    def test_export_copil_admin_returns_200(self, admin_token, first_project_id):
        """Admin can generate PPTX - returns 200 with correct content-type"""
        pid, pname = first_project_id
        r = requests.post(
            f"{BASE_URL}/api/export/copil",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "project_ids": [pid],
                "instance_name": "TEST_COPIL_Admin",
                "instance_date": "2026-02-15",
                "governance_id": None,
            }
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        assert "presentationml" in r.headers.get("content-type", ""), \
            f"Expected PPTX content-type, got: {r.headers.get('content-type')}"
        assert len(r.content) > 10000, f"PPTX file too small: {len(r.content)} bytes"
        print(f"PPTX size: {len(r.content)} bytes - OK")

    def test_export_copil_pmo_returns_200(self, pmo_token, first_project_id):
        """PMO user can generate PPTX"""
        pid, _ = first_project_id
        r = requests.post(
            f"{BASE_URL}/api/export/copil",
            headers={"Authorization": f"Bearer {pmo_token}"},
            json={
                "project_ids": [pid],
                "instance_name": "TEST_COPIL_PMO",
                "instance_date": "2026-02-15",
            }
        )
        assert r.status_code == 200, f"PMO export failed: {r.status_code}: {r.text}"
        print(f"PMO PPTX size: {len(r.content)} bytes - OK")

    def test_export_copil_viewer_returns_200(self, viewer_token, first_project_id):
        """READ_ONLY viewer can generate PPTX"""
        pid, _ = first_project_id
        r = requests.post(
            f"{BASE_URL}/api/export/copil",
            headers={"Authorization": f"Bearer {viewer_token}"},
            json={
                "project_ids": [pid],
                "instance_name": "TEST_COPIL_Viewer",
                "instance_date": "2026-02-15",
            }
        )
        assert r.status_code == 200, f"Viewer export failed: {r.status_code}: {r.text}"
        print(f"Viewer PPTX size: {len(r.content)} bytes - OK")

    def test_export_copil_empty_ids_returns_422(self, admin_token):
        """Empty project_ids returns 422"""
        r = requests.post(
            f"{BASE_URL}/api/export/copil",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "project_ids": [],
                "instance_name": "COPIL Test",
                "instance_date": "2026-02-15",
            }
        )
        assert r.status_code == 422, f"Expected 422 for empty project_ids, got {r.status_code}"
        print("Empty project_ids returns 422 - OK")

    def test_export_copil_no_auth_returns_401(self, first_project_id):
        """Unauthenticated request returns 401"""
        pid, _ = first_project_id
        r = requests.post(
            f"{BASE_URL}/api/export/copil",
            json={
                "project_ids": [pid],
                "instance_name": "COPIL Test",
                "instance_date": "2026-02-15",
            }
        )
        assert r.status_code in [401, 403], f"Expected 401 or 403, got {r.status_code}"
        print("Unauthenticated returns 401 - OK")

    def test_export_copil_content_disposition_header(self, admin_token, first_project_id):
        """Response has correct Content-Disposition for download"""
        pid, _ = first_project_id
        r = requests.post(
            f"{BASE_URL}/api/export/copil",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "project_ids": [pid],
                "instance_name": "TEST COPIL",
                "instance_date": "2026-02-15",
            }
        )
        assert r.status_code == 200
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd, f"Expected 'attachment' in Content-Disposition, got: {cd}"
        assert ".pptx" in cd, f"Expected .pptx in Content-Disposition, got: {cd}"
        print(f"Content-Disposition: {cd} - OK")
