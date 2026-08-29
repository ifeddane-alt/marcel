"""
Tests for Tasks API - Décomposition du projet feature
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin1234!"}
VIEWER_CREDS = {"email": "viewer@altair.fr", "password": "View1234!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def viewer_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER_CREDS)
    assert r.status_code == 200
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def viewer_headers(viewer_token):
    return {"Authorization": f"Bearer {viewer_token}"}


@pytest.fixture(scope="module")
def project_id(admin_headers):
    """Get first project id"""
    r = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
    assert r.status_code == 200
    projects = r.json()
    assert len(projects) > 0
    return projects[0]["project_id"]


class TestTasksGet:
    """GET /api/tasks tests"""

    def test_get_all_tasks(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=admin_headers)
        assert r.status_code == 200
        tasks = r.json()
        assert isinstance(tasks, list)
        assert len(tasks) >= 5, f"Expected >=5 tasks, got {len(tasks)}"
        print(f"Total tasks: {len(tasks)}")

    def test_get_tasks_by_project(self, admin_headers, project_id):
        r = requests.get(f"{BASE_URL}/api/tasks?project_id={project_id}", headers=admin_headers)
        assert r.status_code == 200
        tasks = r.json()
        assert isinstance(tasks, list)
        assert len(tasks) >= 1, "Expected tasks for project"
        # All tasks belong to the project
        for t in tasks:
            assert t["project_id"] == project_id
        print(f"Tasks for project {project_id}: {len(tasks)}")

    def test_tasks_have_required_fields(self, admin_headers, project_id):
        r = requests.get(f"{BASE_URL}/api/tasks?project_id={project_id}", headers=admin_headers)
        assert r.status_code == 200
        tasks = r.json()
        required = ["task_id", "name", "type", "status", "jh_planned", "jh_consumed", "budget_planned_k", "budget_consumed_k"]
        for t in tasks:
            for field in required:
                assert field in t, f"Missing field: {field}"

    def test_task_type_values(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=admin_headers)
        tasks = r.json()
        valid_types = {"tâche", "feature", "epic", "user_story"}
        types_found = {t["type"] for t in tasks}
        assert types_found & valid_types, f"No valid types found. Got: {types_found}"
        print(f"Task types found: {types_found}")

    def test_task_status_values(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=admin_headers)
        tasks = r.json()
        valid_statuses = {"not_started", "in_progress", "completed", "delayed", "cancelled"}
        statuses_found = {t["status"] for t in tasks}
        assert statuses_found & valid_statuses, f"No valid statuses. Got: {statuses_found}"
        print(f"Task statuses found: {statuses_found}")

    def test_get_tasks_invalid_project(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tasks?project_id=nonexistent-id", headers=admin_headers)
        assert r.status_code == 404


class TestTasksCreate:
    """POST /api/tasks tests"""

    created_task_id = None

    def test_create_task_admin(self, admin_headers, project_id):
        payload = {
            "project_id": project_id,
            "name": "TEST_task_created_by_test",
            "type": "feature",
            "status": "not_started",
            "jh_planned": 10,
            "jh_consumed": 0,
            "budget_planned_k": 5.0,
            "budget_consumed_k": 0.0,
        }
        r = requests.post(f"{BASE_URL}/api/tasks", json=payload, headers=admin_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "TEST_task_created_by_test"
        assert "task_id" in data
        TestTasksCreate.created_task_id = data["task_id"]
        print(f"Created task: {data['task_id']}")

    def test_create_task_returns_correct_fields(self, admin_headers, project_id):
        payload = {
            "project_id": project_id,
            "name": "TEST_task_fields_check",
            "type": "epic",
            "status": "in_progress",
            "jh_planned": 20,
            "jh_consumed": 5,
            "budget_planned_k": 10.0,
            "budget_consumed_k": 3.0,
        }
        r = requests.post(f"{BASE_URL}/api/tasks", json=payload, headers=admin_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["type"] == "epic"
        assert data["status"] == "in_progress"
        assert data["jh_planned"] == 20
        assert data["budget_planned_k"] == 10.0


class TestTasksReadOnly:
    """READ_ONLY role restrictions"""

    def test_read_only_cannot_create_task(self, viewer_headers, project_id):
        payload = {
            "project_id": project_id,
            "name": "TEST_readonly_should_fail",
            "type": "tâche",
            "status": "not_started",
        }
        r = requests.post(f"{BASE_URL}/api/tasks", json=payload, headers=viewer_headers)
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_read_only_can_get_tasks(self, viewer_headers):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=viewer_headers)
        assert r.status_code == 200


class TestTasksUpdate:
    """PUT /api/tasks/:id tests"""

    def test_update_task(self, admin_headers, project_id):
        # Create a task to update
        payload = {
            "project_id": project_id,
            "name": "TEST_task_to_update",
            "type": "tâche",
            "status": "not_started",
            "jh_planned": 15,
        }
        r = requests.post(f"{BASE_URL}/api/tasks", json=payload, headers=admin_headers)
        assert r.status_code == 201
        task_id = r.json()["task_id"]

        # Update it
        update = {"status": "in_progress", "jh_consumed": 5}
        r2 = requests.put(f"{BASE_URL}/api/tasks/{task_id}", json=update, headers=admin_headers)
        assert r2.status_code == 200
        data = r2.json()
        assert data["status"] == "in_progress"
        assert data["jh_consumed"] == 5

    def test_update_nonexistent_task(self, admin_headers):
        r = requests.put(f"{BASE_URL}/api/tasks/nonexistent-task-id", json={"status": "completed"}, headers=admin_headers)
        assert r.status_code == 404


class TestTasksSeedData:
    """Verify 46 tasks seeded across projects"""

    def test_total_tasks_count(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=admin_headers)
        assert r.status_code == 200
        tasks = r.json()
        # At least 46 from seed (may have more from tests)
        assert len(tasks) >= 46, f"Expected >=46 seeded tasks, got {len(tasks)}"

    def test_tasks_per_project_range(self, admin_headers):
        r_tasks = requests.get(f"{BASE_URL}/api/tasks", headers=admin_headers)
        r_projects = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers)
        tasks = r_tasks.json()
        projects = r_projects.json()

        from collections import Counter
        task_counts = Counter(t["project_id"] for t in tasks)
        for proj in projects:
            pid = proj["project_id"]
            count = task_counts.get(pid, 0)
            print(f"Project {proj['name']}: {count} tasks")
