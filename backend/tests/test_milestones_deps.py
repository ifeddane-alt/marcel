"""
Tests for milestones CRUD + project_dependencies CRUD
Stream 4: New milestone model (3 families) + project_dependencies
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

# Credentials
ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin1234!"}
PMO_CREDS = {"email": "pmo@altair.fr", "password": "Pmo1234!"}
VIEWER_CREDS = {"email": "viewer@altair.fr", "password": "View1234!"}


def get_token(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    if r.status_code == 200:
        return r.json().get("access_token")
    return None


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def admin_token():
    t = get_token(ADMIN_CREDS)
    if not t:
        pytest.skip("Admin login failed")
    return t


@pytest.fixture(scope="module")
def pmo_token():
    t = get_token(PMO_CREDS)
    if not t:
        pytest.skip("PMO login failed")
    return t


@pytest.fixture(scope="module")
def viewer_token():
    t = get_token(VIEWER_CREDS)
    if not t:
        pytest.skip("Viewer login failed")
    return t


@pytest.fixture(scope="module")
def first_project_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 0, "No projects found"
    return projects[0]["project_id"]


@pytest.fixture(scope="module")
def second_project_id(admin_token):
    r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 1, "Need at least 2 projects"
    return projects[1]["project_id"]


class TestMilestonesGET:
    """GET milestones with enriched fields"""

    def test_list_milestones_by_project(self, admin_token, first_project_id):
        r = requests.get(
            f"{BASE_URL}/api/milestones?project_id={first_project_id}",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} milestones for project {first_project_id}")

    def test_milestone_fields_enriched(self, admin_token, first_project_id):
        """Check enriched fields are present"""
        r = requests.get(
            f"{BASE_URL}/api/milestones?project_id={first_project_id}",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        data = r.json()
        if data:
            m = data[0]
            # Check that enriched fields exist (can be None)
            for field in ["family", "type", "attribute", "comment", "owner_resource_id", "deliverable", "is_blocking"]:
                assert field in m, f"Field '{field}' missing from milestone response"
            print(f"Milestone fields OK: {list(m.keys())}")

    def test_list_all_milestones_no_project_id(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/milestones", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestMilestonesCRUD:
    """CRUD milestone with family/type/attribute"""
    created_id = None

    def test_create_milestone_epic_milestone(self, admin_token, first_project_id):
        payload = {
            "project_id": first_project_id,
            "name": "TEST_GoLive Integration",
            "family": "epic_milestone",
            "type": "go_live",
            "attribute": "critical",
            "date_baseline": "2025-12-01",
            "date_forecast": "2025-12-15",
            "status": "planned",
            "comment": "Test comment enriched",
            "deliverable": "PV de recette signé",
            "is_blocking": True,
            "is_governance": False,
        }
        r = requests.post(f"{BASE_URL}/api/milestones", json=payload, headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["family"] == "epic_milestone"
        assert data["type"] == "go_live"
        assert data["attribute"] == "critical"
        assert data["comment"] == "Test comment enriched"
        assert data["deliverable"] == "PV de recette signé"
        assert data["is_blocking"] == True
        assert "milestone_id" in data
        TestMilestonesCRUD.created_id = data["milestone_id"]
        print(f"Created milestone: {TestMilestonesCRUD.created_id}")

    def test_create_milestone_transversal_types(self, admin_token, first_project_id):
        """Test transversal family with valid type"""
        payload = {
            "project_id": first_project_id,
            "name": "TEST_Regulatory Transversal",
            "family": "transversal",
            "type": "regulatory",
            "date_baseline": "2025-11-01",
            "status": "planned",
        }
        r = requests.post(f"{BASE_URL}/api/milestones", json=payload, headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["family"] == "transversal"
        assert data["type"] == "regulatory"
        # Cleanup
        if data.get("milestone_id"):
            requests.delete(f"{BASE_URL}/api/milestones/{data['milestone_id']}", headers=auth_headers(admin_token))

    def test_create_milestone_invalid_type_for_family(self, admin_token, first_project_id):
        """go_live is NOT valid for transversal -> 400"""
        payload = {
            "project_id": first_project_id,
            "name": "TEST_Invalid Type",
            "family": "transversal",
            "type": "go_live",
            "date_baseline": "2025-11-01",
            "status": "planned",
        }
        r = requests.post(f"{BASE_URL}/api/milestones", json=payload, headers=auth_headers(admin_token))
        assert r.status_code == 400
        print(f"Validation error (expected): {r.json()}")

    def test_update_milestone_family_type(self, admin_token):
        mid = TestMilestonesCRUD.created_id
        if not mid:
            pytest.skip("No created_id")
        payload = {"family": "epic_lifecycle", "type": "kick_off"}
        r = requests.put(f"{BASE_URL}/api/milestones/{mid}", json=payload, headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["family"] == "epic_lifecycle"
        assert data["type"] == "kick_off"

    def test_delete_milestone(self, admin_token):
        mid = TestMilestonesCRUD.created_id
        if not mid:
            pytest.skip("No created_id")
        r = requests.delete(f"{BASE_URL}/api/milestones/{mid}", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data.get("deleted") == True

    def test_viewer_cannot_create_milestone(self, viewer_token, first_project_id):
        """READ_ONLY viewer must get 403"""
        payload = {
            "project_id": first_project_id,
            "name": "TEST_Unauthorized",
            "family": "epic_milestone",
            "type": "go_live",
            "date_baseline": "2025-12-01",
            "status": "planned",
        }
        r = requests.post(f"{BASE_URL}/api/milestones", json=payload, headers=auth_headers(viewer_token))
        assert r.status_code == 403
        print(f"403 as expected for viewer: {r.json()}")


class TestProjectDependencies:
    """CRUD project_dependencies"""
    created_dep_id = None

    def test_get_deps_all(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/project-dependencies/all", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Total deps: {len(data)}")
        if data:
            d = data[0]
            assert "source_project_name" in d
            assert "target_project_name" in d

    def test_get_deps_by_project(self, admin_token, first_project_id):
        r = requests.get(
            f"{BASE_URL}/api/project-dependencies?project_id={first_project_id}",
            headers=auth_headers(admin_token),
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            d = data[0]
            assert "source_project_name" in d
            assert "target_project_name" in d

    def test_create_dependency(self, admin_token, first_project_id, second_project_id):
        payload = {
            "source_project_id": first_project_id,
            "target_project_id": second_project_id,
            "nature": "technical",
            "description": "TEST_Dependency description",
            "status": "identified",
            "impact": "medium",
            "direction": "outbound",
        }
        r = requests.post(f"{BASE_URL}/api/project-dependencies", json=payload, headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["source_project_id"] == first_project_id
        assert data["target_project_id"] == second_project_id
        assert data["nature"] == "technical"
        assert "dependency_id" in data
        TestProjectDependencies.created_dep_id = data["dependency_id"]
        print(f"Created dep: {TestProjectDependencies.created_dep_id}")

    def test_delete_dependency(self, admin_token):
        dep_id = TestProjectDependencies.created_dep_id
        if not dep_id:
            pytest.skip("No dep_id")
        r = requests.delete(f"{BASE_URL}/api/project-dependencies/{dep_id}", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data.get("deleted") == True

    def test_viewer_cannot_create_dependency(self, viewer_token, first_project_id, second_project_id):
        payload = {
            "source_project_id": first_project_id,
            "target_project_id": second_project_id,
            "nature": "technical",
            "description": "TEST_Viewer unauthorized",
        }
        r = requests.post(f"{BASE_URL}/api/project-dependencies", json=payload, headers=auth_headers(viewer_token))
        assert r.status_code == 403
