"""
Tests Chantier 3 SAFe: Trains, PIs, Sprints, Capabilities, Phase Transitions
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")

ADMIN = {"email": "admin@altair.fr", "password": "Admin1234!"}


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ─── 3a: Trains ───────────────────────────────────────────────────────────────

class TestTrains:
    def test_list_trains_returns_one_train(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers)
        assert r.status_code == 200
        trains = r.json()
        assert len(trains) >= 1
        names = [t["name"] for t in trains]
        assert any("Digital Banking" in n or "ART" in n for n in names), f"Expected ART Digital Banking, got {names}"
        print(f"PASS: {len(trains)} train(s) found: {names}")

    def test_train_has_pi_count(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers)
        trains = r.json()
        train = trains[0]
        assert "pi_count" in train
        assert train["pi_count"] == 2, f"Expected pi_count=2, got {train['pi_count']}"
        print(f"PASS: pi_count={train['pi_count']}")

    def test_train_has_team_ids(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers)
        trains = r.json()
        train = trains[0]
        assert "team_ids" in train
        assert len(train["team_ids"]) >= 1
        print(f"PASS: team_ids={train['team_ids']}")


# ─── 3a: PIs ──────────────────────────────────────────────────────────────────

class TestPIs:
    def test_list_pis_for_train(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train_id = trains[0]["train_id"]
        r = requests.get(f"{BASE_URL}/api/safe/pis?train_id={train_id}", headers=admin_headers)
        assert r.status_code == 200
        pis = r.json()
        assert len(pis) == 2, f"Expected 2 PIs, got {len(pis)}"
        statuses = [p["status"] for p in pis]
        assert "active" in statuses
        assert "planning" in statuses
        print(f"PASS: PIs found: {[p['name'] for p in pis]}")

    def test_pi_names_contain_2026(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train_id = trains[0]["train_id"]
        pis = requests.get(f"{BASE_URL}/api/safe/pis?train_id={train_id}", headers=admin_headers).json()
        names = [p["name"] for p in pis]
        assert any("2026" in n for n in names), f"Expected 2026 in PI names, got {names}"
        print(f"PASS: PI names contain 2026: {names}")


# ─── 3a: Sprints ──────────────────────────────────────────────────────────────

class TestSprints:
    def test_list_sprints_for_pi1(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train_id = trains[0]["train_id"]
        pis = requests.get(f"{BASE_URL}/api/safe/pis?train_id={train_id}", headers=admin_headers).json()
        # PI-1 is active
        pi1 = next((p for p in pis if p.get("status") == "active"), pis[0])
        r = requests.get(f"{BASE_URL}/api/safe/sprints?pi_id={pi1['pi_id']}", headers=admin_headers)
        assert r.status_code == 200
        sprints = r.json()
        assert len(sprints) >= 2, f"Expected >=2 sprints for PI1, got {len(sprints)}"
        names = [s["name"] for s in sprints]
        print(f"PASS: Sprints for PI1: {names}")

    def test_sprints_completed_status(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train_id = trains[0]["train_id"]
        pis = requests.get(f"{BASE_URL}/api/safe/pis?train_id={train_id}", headers=admin_headers).json()
        pi1 = next((p for p in pis if p.get("status") == "active"), pis[0])
        sprints = requests.get(f"{BASE_URL}/api/safe/sprints?pi_id={pi1['pi_id']}", headers=admin_headers).json()
        statuses = [s["status"] for s in sprints]
        assert "completed" in statuses, f"Expected completed sprints, got {statuses}"
        print(f"PASS: Sprint statuses: {statuses}")


# ─── 3a: Capabilities ─────────────────────────────────────────────────────────

class TestCapabilities:
    def test_list_capabilities_for_train(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train_id = trains[0]["train_id"]
        r = requests.get(f"{BASE_URL}/api/safe/capabilities?train_id={train_id}", headers=admin_headers)
        assert r.status_code == 200
        caps = r.json()
        assert len(caps) == 5, f"Expected 5 capabilities, got {len(caps)}"
        names = [c["name"] for c in caps]
        print(f"PASS: Capabilities: {names}")

    def test_capability_names(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train_id = trains[0]["train_id"]
        caps = requests.get(f"{BASE_URL}/api/safe/capabilities?train_id={train_id}", headers=admin_headers).json()
        names = [c["name"] for c in caps]
        expected_keywords = ["Onboarding", "API Gateway", "Score", "DORA", "Batch"]
        for kw in expected_keywords:
            assert any(kw in n for n in names), f"Expected '{kw}' in capabilities, got {names}"
        print(f"PASS: All expected capability keywords found")


# ─── 3a: Train Overview ───────────────────────────────────────────────────────

class TestTrainOverview:
    def test_overview_summary(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train_id = trains[0]["train_id"]
        r = requests.get(f"{BASE_URL}/api/safe/trains/{train_id}/overview", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        s = data["summary"]
        assert s["total_pis"] == 2, f"Expected total_pis=2, got {s['total_pis']}"
        assert s["total_sprints"] == 4, f"Expected total_sprints=4, got {s['total_sprints']}"
        assert s["total_capabilities"] == 5, f"Expected total_capabilities=5, got {s['total_capabilities']}"
        assert s["caps_by_status"]["done"] == 1, f"Expected done=1, got {s['caps_by_status']['done']}"
        print(f"PASS: Overview summary: {s}")


# ─── 3a: CRUD Capability ──────────────────────────────────────────────────────

class TestCapabilityCRUD:
    def test_create_and_delete_capability(self, admin_headers):
        trains = requests.get(f"{BASE_URL}/api/safe/trains", headers=admin_headers).json()
        train = trains[0]
        train_id = train["train_id"]
        pis = requests.get(f"{BASE_URL}/api/safe/pis?train_id={train_id}", headers=admin_headers).json()
        pi_id = pis[0]["pi_id"]

        # Create
        payload = {
            "name": "TEST_Cap_New",
            "train_id": train_id,
            "pi_id": pi_id,
            "status": "identified",
        }
        r = requests.post(f"{BASE_URL}/api/safe/capabilities", json=payload, headers=admin_headers)
        assert r.status_code == 201, f"Create failed: {r.text}"
        cap = r.json()
        cap_id = cap["capability_id"]
        assert cap["name"] == "TEST_Cap_New"
        print(f"PASS: Created capability {cap_id}")

        # Delete
        r = requests.delete(f"{BASE_URL}/api/safe/capabilities/{cap_id}", headers=admin_headers)
        assert r.status_code == 204, f"Delete failed: {r.text}"
        print(f"PASS: Deleted capability {cap_id}")


# ─── 3b: Task Hierarchy (Phoenix) ─────────────────────────────────────────────

class TestTaskHierarchy:
    def test_phoenix_tasks_have_safe_levels(self, admin_headers):
        # Get projects, find Phoenix
        projects = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers).json()
        phoenix = next((p for p in projects if "Phoenix" in p.get("name", "") or "PRJ-2025-001" in p.get("project_id", "")), None)
        assert phoenix, "Phoenix project not found"
        phoenix_id = phoenix["project_id"]

        tasks = requests.get(f"{BASE_URL}/api/tasks?project_id={phoenix_id}", headers=admin_headers).json()
        levels = [t.get("task_level") for t in tasks]
        assert "feature" in levels or "user_story" in levels, f"Expected SAFe levels, got {set(levels)}"
        # Check user_stories have parent_id
        user_stories = [t for t in tasks if t.get("task_level") == "user_story"]
        for us in user_stories:
            assert us.get("parent_id"), f"user_story {us.get('task_id')} has no parent_id"
        print(f"PASS: Task levels: {set(levels)}, {len(user_stories)} user stories with parent_id")


# ─── 3d: Phase Transitions ────────────────────────────────────────────────────

class TestPhaseTransitions:
    def test_valid_transition_backlog_to_review(self, admin_headers):
        # Get or create a test task
        projects = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers).json()
        phoenix = next((p for p in projects if "Phoenix" in p.get("name", "")), projects[0])
        tasks = requests.get(f"{BASE_URL}/api/tasks?project_id={phoenix['project_id']}", headers=admin_headers).json()
        # Find a task in backlog
        backlog_task = next((t for t in tasks if t.get("lifecycle_phase", "backlog") == "backlog" and t.get("task_level", "task") == "task"), None)

        if not backlog_task:
            # Create one
            r = requests.post(f"{BASE_URL}/api/tasks", json={
                "project_id": phoenix["project_id"],
                "name": "TEST_Transition_Task",
                "type": "development",
                "task_level": "task",
                "lifecycle_phase": "backlog",
            }, headers=admin_headers)
            assert r.status_code == 201
            backlog_task = r.json()

        task_id = backlog_task["task_id"]

        # Ensure it's in backlog
        if backlog_task.get("lifecycle_phase") != "backlog":
            pytest.skip("No backlog task available")

        r = requests.post(f"{BASE_URL}/api/tasks/{task_id}/transition", json={"to_phase": "review"}, headers=admin_headers)
        assert r.status_code == 200, f"Transition failed: {r.text}"
        data = r.json()
        assert "task" in data and "history_entry" in data
        assert data["history_entry"]["from_phase"] == "backlog"
        assert data["history_entry"]["to_phase"] == "review"
        print(f"PASS: Transition backlog->review: {data['history_entry']}")

        # Cleanup: try to transition back or delete
        requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=admin_headers)

    def test_invalid_transition_returns_422(self, admin_headers):
        projects = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers).json()
        phoenix = next((p for p in projects if "Phoenix" in p.get("name", "")), projects[0])
        # Create a fresh backlog task
        r = requests.post(f"{BASE_URL}/api/tasks", json={
            "project_id": phoenix["project_id"],
            "name": "TEST_Invalid_Transition_Task",
            "type": "development",
            "task_level": "task",
            "lifecycle_phase": "backlog",
        }, headers=admin_headers)
        assert r.status_code == 201
        task_id = r.json()["task_id"]

        # Invalid: backlog → done (not in VALID_TRANSITIONS - must go via review/analysis/implementation/test/hypercare)
        r = requests.post(f"{BASE_URL}/api/tasks/{task_id}/transition", json={"to_phase": "done"}, headers=admin_headers)
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"
        assert "non autoris" in r.json().get("detail", "").lower() or "non autorisée" in r.json().get("detail", ""), f"Expected 'non autorisée' in error, got: {r.text}"
        print(f"PASS: Invalid transition returned 422: {r.json()['detail']}")

        requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=admin_headers)

    def test_phase_history_after_transition(self, admin_headers):
        projects = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers).json()
        phoenix = next((p for p in projects if "Phoenix" in p.get("name", "")), projects[0])
        # Create + transition
        r = requests.post(f"{BASE_URL}/api/tasks", json={
            "project_id": phoenix["project_id"],
            "name": "TEST_History_Task",
            "type": "development",
            "task_level": "task",
            "lifecycle_phase": "backlog",
        }, headers=admin_headers)
        task_id = r.json()["task_id"]
        requests.post(f"{BASE_URL}/api/tasks/{task_id}/transition", json={"to_phase": "review"}, headers=admin_headers)

        r = requests.get(f"{BASE_URL}/api/tasks/{task_id}/phase-history", headers=admin_headers)
        assert r.status_code == 200
        history = r.json()
        assert len(history) >= 1, "Expected at least 1 history entry"
        assert history[0]["from_phase"] == "backlog"
        assert history[0]["to_phase"] == "review"
        print(f"PASS: Phase history: {history}")

        requests.delete(f"{BASE_URL}/api/tasks/{task_id}", headers=admin_headers)
