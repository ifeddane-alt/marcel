"""
Tests for S2-03 Roadmap page and S2-04 PPT export with roadmap slide
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Auth credentials
EMAIL = "admin@altair.fr"
PASSWORD = "Admin1234!"


@pytest.fixture(scope="module")
def auth_token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    if res.status_code != 200:
        pytest.skip(f"Auth failed: {res.status_code} {res.text}")
    return res.json().get("access_token") or res.json().get("token")


@pytest.fixture(scope="module")
def client(auth_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def project_ids(client):
    res = client.get(f"{BASE_URL}/api/projects")
    assert res.status_code == 200
    projects = res.json()
    assert len(projects) >= 1
    return [p["project_id"] for p in projects[:3]]


# S2-03: Roadmap data APIs
class TestRoadmapDataAPIs:
    """APIs needed by the Roadmap page"""

    def test_projects_list(self, client):
        res = client.get(f"{BASE_URL}/api/projects")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Each project should have required fields
        p = data[0]
        assert "project_id" in p
        assert "name" in p
        print(f"PASS: {len(data)} projects found")

    def test_programs_list(self, client):
        res = client.get(f"{BASE_URL}/api/programs")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: {len(data)} programs found")

    def test_milestones_list(self, client):
        res = client.get(f"{BASE_URL}/api/milestones")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: {len(data)} milestones found")


# S2-04: PPT export with include_roadmap
class TestExportCopilWithRoadmap:
    """S2-04: Export COPIL with roadmap slide"""

    def test_export_copil_without_roadmap(self, client, project_ids):
        payload = {
            "project_ids": project_ids,
            "instance_name": "Test COPIL S2-04",
            "instance_date": "2026-02-15",
            "include_roadmap": False,
        }
        res = client.post(f"{BASE_URL}/api/export/copil", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"
        assert res.headers.get("content-type", "").startswith(
            "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        ), f"Content-type wrong: {res.headers.get('content-type')}"
        size = len(res.content)
        assert size > 10_000, f"PPTX too small: {size} bytes"
        print(f"PASS: COPIL without roadmap = {size} bytes")

    def test_export_copil_with_roadmap(self, client, project_ids):
        """S2-04 core: include_roadmap=true must return valid PPTX > 50KB"""
        payload = {
            "project_ids": project_ids,
            "instance_name": "Test Roadmap S204",
            "instance_date": "2026-02-15",
            "include_roadmap": True,
        }
        res = client.post(f"{BASE_URL}/api/export/copil", json=payload)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text[:200]}"
        ct = res.headers.get("content-type", "")
        assert "presentationml" in ct or "application/octet-stream" in ct, f"Bad content-type: {ct}"
        size = len(res.content)
        assert size > 50_000, f"PPTX with roadmap too small ({size} bytes), expected > 50KB"
        print(f"PASS: COPIL with roadmap = {size} bytes")

    def test_export_copil_include_roadmap_schema(self, client, project_ids):
        """include_roadmap field is accepted (no 422 validation error)"""
        payload = {
            "project_ids": project_ids[:1],
            "instance_name": "Test Schema",
            "instance_date": "2026-02-15",
            "include_roadmap": True,
        }
        res = client.post(f"{BASE_URL}/api/export/copil", json=payload)
        assert res.status_code != 422, f"Schema validation failed: {res.text[:300]}"
        print(f"PASS: include_roadmap accepted, status={res.status_code}")
