"""
Sprint 0 - Modular Architecture Regression Tests
Tests all endpoints after migration from monolithic server.py to modular architecture
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')

ADMIN = {"email": "admin@altair.fr", "password": "Admin1234!"}
PMO = {"email": "pmo@altair.fr", "password": "Pmo1234!"}
VIEWER = {"email": "viewer@altair.fr", "password": "View1234!"}


def get_token(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return get_token(ADMIN)


@pytest.fixture(scope="module")
def pmo_token():
    return get_token(PMO)


@pytest.fixture(scope="module")
def viewer_token():
    return get_token(VIEWER)


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ===== AUTH =====
class TestAuth:
    """Authentication endpoints"""

    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        print("PASS: admin login")

    def test_login_pmo(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=PMO)
        assert r.status_code == 200
        print("PASS: pmo login")

    def test_login_viewer(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json=VIEWER)
        assert r.status_code == 200
        print("PASS: viewer login")

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "bad@x.fr", "password": "wrong"})
        assert r.status_code in [401, 403, 400]
        print("PASS: invalid login rejected")

    def test_me_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN["email"]
        assert "role" in data
        print(f"PASS: me admin role={data['role']}")

    def test_me_viewer(self, viewer_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers(viewer_token))
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == VIEWER["email"]
        print(f"PASS: me viewer role={data['role']}")


# ===== PROJECTS =====
class TestProjects:
    """Projects CRUD"""

    def test_list_projects_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 8, f"Expected 8 projects, got {len(data)}"
        print(f"PASS: projects list count={len(data)}")

    def test_create_project_pmo(self, pmo_token):
        payload = {
            "name": "TEST_Project_Sprint0",
            "methodology": "Agile",
            "status_rag": "green",
            "status": "on_track",
            "jh_planned": 10,
            "end_date_baseline": "2024-12-31",
            "end_date_forecast": "2024-12-31",
            "start_date": "2024-01-01"
        }
        r = requests.post(f"{BASE_URL}/api/projects", json=payload, headers=auth_headers(pmo_token))
        assert r.status_code in [200, 201], f"PMO create failed: {r.text}"
        data = r.json()
        assert "project_id" in data
        TestProjects.created_id = data["project_id"]
        print(f"PASS: create project id={data['project_id']}")

    def test_update_project_pmo(self, pmo_token):
        if not hasattr(TestProjects, 'created_id'):
            pytest.skip("No project created")
        r = requests.put(f"{BASE_URL}/api/projects/{TestProjects.created_id}",
                         json={"name": "TEST_Project_Sprint0_Updated"},
                         headers=auth_headers(pmo_token))
        assert r.status_code == 200
        print("PASS: update project")

    def test_create_project_viewer_403(self, viewer_token):
        r = requests.post(f"{BASE_URL}/api/projects",
                          json={"name": "X", "methodology": "Agile", "status_rag": "green",
                                "jh_planned": 1, "start_date": "2024-01-01",
                                "end_date_baseline": "2024-12-31",
                                "end_date_forecast": "2024-12-31"},
                          headers=auth_headers(viewer_token))
        assert r.status_code == 403
        print("PASS: viewer create project 403")

    def test_delete_project_pmo_403(self, pmo_token):
        if not hasattr(TestProjects, 'created_id'):
            pytest.skip("No project created")
        r = requests.delete(f"{BASE_URL}/api/projects/{TestProjects.created_id}",
                            headers=auth_headers(pmo_token))
        assert r.status_code == 403
        print("PASS: pmo delete project 403")

    def test_delete_project_admin(self, admin_token):
        if not hasattr(TestProjects, 'created_id'):
            pytest.skip("No project created")
        r = requests.delete(f"{BASE_URL}/api/projects/{TestProjects.created_id}",
                            headers=auth_headers(admin_token))
        assert r.status_code in [200, 204]
        print("PASS: admin delete project")

    def test_budget_revision(self, pmo_token, admin_token):
        # Get first project
        r = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token))
        projects = r.json()
        pid = projects[0]["project_id"]
        r2 = requests.post(f"{BASE_URL}/api/projects/{pid}/budget-revision",
                           json={"eac": 50000.0, "reason": "Test revision"},
                           headers=auth_headers(pmo_token))
        assert r2.status_code in [200, 201], f"Budget revision failed: {r2.text}"
        print("PASS: budget revision")


# ===== PROGRAMS =====
class TestPrograms:
    """Programs CRUD"""

    def test_list_programs(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/programs", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 4, f"Expected at least 4 programs, got {len(data)}"
        print(f"PASS: programs count={len(data)}")

    def test_get_program_detail(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/programs", headers=auth_headers(admin_token))
        pid = r.json()[0]["program_id"]
        r2 = requests.get(f"{BASE_URL}/api/programs/{pid}", headers=auth_headers(admin_token))
        assert r2.status_code == 200
        data = r2.json()
        assert "program_id" in data or "id" in data
        print("PASS: program detail")

    def test_create_program_pmo(self, pmo_token):
        r = requests.post(f"{BASE_URL}/api/programs",
                          json={"name": "TEST_Program_Sprint0", "description": "test"},
                          headers=auth_headers(pmo_token))
        assert r.status_code in [200, 201], f"Create program failed: {r.text}"
        data = r.json()
        TestPrograms.created_id = data.get("program_id") or data.get("id")
        print(f"PASS: create program id={TestPrograms.created_id}")

    def test_update_program(self, pmo_token):
        if not hasattr(TestPrograms, 'created_id'):
            pytest.skip("No program created")
        r = requests.put(f"{BASE_URL}/api/programs/{TestPrograms.created_id}",
                         json={"name": "TEST_Program_Sprint0_Updated"},
                         headers=auth_headers(pmo_token))
        assert r.status_code == 200
        print("PASS: update program")

    def test_delete_program(self, admin_token):
        if not hasattr(TestPrograms, 'created_id'):
            pytest.skip("No program created")
        r = requests.delete(f"{BASE_URL}/api/programs/{TestPrograms.created_id}",
                            headers=auth_headers(admin_token))
        assert r.status_code in [200, 204]
        print("PASS: delete program")


# ===== RESOURCES =====
class TestResources:
    """Resources CRUD"""

    def test_list_resources(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/resources", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 10, f"Expected at least 10 resources, got {len(data)}"
        print(f"PASS: resources count={len(data)}")

    def test_create_resource(self, pmo_token):
        r = requests.post(f"{BASE_URL}/api/resources",
                          json={"name": "TEST_Resource_Sprint0", "role": "Developer", "capacity_jh_month": 15},
                          headers=auth_headers(pmo_token))
        assert r.status_code in [200, 201], f"Create resource failed: {r.text}"
        data = r.json()
        TestResources.created_id = data.get("resource_id") or data.get("id")
        print(f"PASS: create resource id={TestResources.created_id}")

    def test_update_resource(self, pmo_token):
        if not hasattr(TestResources, 'created_id'):
            pytest.skip("No resource created")
        r = requests.put(f"{BASE_URL}/api/resources/{TestResources.created_id}",
                         json={"name": "TEST_Resource_Updated"},
                         headers=auth_headers(pmo_token))
        assert r.status_code == 200
        print("PASS: update resource")

    def test_delete_resource(self, admin_token):
        if not hasattr(TestResources, 'created_id'):
            pytest.skip("No resource created")
        r = requests.delete(f"{BASE_URL}/api/resources/{TestResources.created_id}",
                            headers=auth_headers(admin_token))
        assert r.status_code in [200, 204]
        print("PASS: delete resource")


# ===== TASKS =====
class TestTasks:
    """Tasks CRUD with mini-RAG"""

    def test_list_tasks(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 46, f"Expected 46 tasks, got {len(data)}"
        print(f"PASS: tasks count={len(data)}")

    def test_create_task(self, pmo_token, admin_token):
        projects = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token)).json()
        pid = projects[0]["project_id"]
        r = requests.post(f"{BASE_URL}/api/tasks",
                          json={"name": "TEST_Task_Sprint0", "project_id": pid, "type": "task", "status": "not_started"},
                          headers=auth_headers(pmo_token))
        assert r.status_code in [200, 201], f"Create task failed: {r.text}"
        data = r.json()
        TestTasks.created_id = data.get("task_id") or data.get("id")
        print(f"PASS: create task id={TestTasks.created_id}")

    def test_update_task(self, pmo_token):
        if not hasattr(TestTasks, 'created_id'):
            pytest.skip("No task created")
        r = requests.put(f"{BASE_URL}/api/tasks/{TestTasks.created_id}",
                         json={"title": "TEST_Task_Updated"},
                         headers=auth_headers(pmo_token))
        assert r.status_code == 200
        print("PASS: update task")

    def test_delete_task(self, admin_token):
        if not hasattr(TestTasks, 'created_id'):
            pytest.skip("No task created")
        r = requests.delete(f"{BASE_URL}/api/tasks/{TestTasks.created_id}",
                            headers=auth_headers(admin_token))
        assert r.status_code in [200, 204]
        print("PASS: delete task")


# ===== RISKS =====
class TestRisks:
    """Risks CRUD with auto-criticality"""

    def test_list_risks(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/risks", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 38, f"Expected 38 risks, got {len(data)}"
        print(f"PASS: risks count={len(data)}")

    def test_create_risk_criticality(self, pmo_token, admin_token):
        projects = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token)).json()
        pid = projects[0]["project_id"]
        r = requests.post(f"{BASE_URL}/api/risks",
                          json={"title": "TEST_Risk_Sprint0", "project_id": pid,
                                "category": "technique", "probability": 3, "impact": 4, "status": "identifié"},
                          headers=auth_headers(pmo_token))
        assert r.status_code in [200, 201], f"Create risk failed: {r.text}"
        data = r.json()
        TestRisks.created_id = data.get("risk_id") or data.get("id")
        print(f"PASS: create risk id={TestRisks.created_id}")

    def test_update_risk(self, pmo_token):
        if not hasattr(TestRisks, 'created_id'):
            pytest.skip("No risk created")
        r = requests.put(f"{BASE_URL}/api/risks/{TestRisks.created_id}",
                         json={"probability": 2, "impact": 2},
                         headers=auth_headers(pmo_token))
        assert r.status_code == 200
        print("PASS: update risk")

    def test_delete_risk_pmo_403(self, pmo_token):
        if not hasattr(TestRisks, 'created_id'):
            pytest.skip("No risk created")
        r = requests.delete(f"{BASE_URL}/api/risks/{TestRisks.created_id}",
                            headers=auth_headers(pmo_token))
        assert r.status_code == 403
        print("PASS: pmo delete risk 403")

    def test_delete_risk_admin(self, admin_token):
        if not hasattr(TestRisks, 'created_id'):
            pytest.skip("No risk created")
        r = requests.delete(f"{BASE_URL}/api/risks/{TestRisks.created_id}",
                            headers=auth_headers(admin_token))
        assert r.status_code in [200, 204]
        print("PASS: admin delete risk")


# ===== DECISIONS =====
class TestDecisions:
    """Decisions CRUD"""

    def test_list_decisions(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/decisions", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 32, f"Expected 32 decisions, got {len(data)}"
        print(f"PASS: decisions count={len(data)}")

    def test_create_decision(self, pmo_token, admin_token):
        projects = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token)).json()
        pid = projects[0]["project_id"]
        r = requests.post(f"{BASE_URL}/api/decisions",
                          json={"title": "TEST_Decision_Sprint0", "project_id": pid,
                                "category": "technique", "status": "proposée"},
                          headers=auth_headers(pmo_token))
        assert r.status_code in [200, 201], f"Create decision failed: {r.text}"
        data = r.json()
        TestDecisions.created_id = data.get("decision_id") or data.get("id")
        print(f"PASS: create decision id={TestDecisions.created_id}")

    def test_update_decision(self, pmo_token):
        if not hasattr(TestDecisions, 'created_id'):
            pytest.skip("No decision created")
        r = requests.put(f"{BASE_URL}/api/decisions/{TestDecisions.created_id}",
                         json={"title": "TEST_Decision_Updated"},
                         headers=auth_headers(pmo_token))
        assert r.status_code == 200
        print("PASS: update decision")

    def test_delete_decision_pmo_403(self, pmo_token):
        if not hasattr(TestDecisions, 'created_id'):
            pytest.skip("No decision created")
        r = requests.delete(f"{BASE_URL}/api/decisions/{TestDecisions.created_id}",
                            headers=auth_headers(pmo_token))
        assert r.status_code == 403
        print("PASS: pmo delete decision 403")

    def test_delete_decision_admin(self, admin_token):
        if not hasattr(TestDecisions, 'created_id'):
            pytest.skip("No decision created")
        r = requests.delete(f"{BASE_URL}/api/decisions/{TestDecisions.created_id}",
                            headers=auth_headers(admin_token))
        assert r.status_code in [200, 204]
        print("PASS: admin delete decision")


# ===== DASHBOARD =====
class TestDashboard:
    """Dashboard endpoints"""

    def test_summary(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "total_projects" in data or "projects" in data or len(data) > 0
        print(f"PASS: dashboard summary: {data}")

    def test_top_risks(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/top-risks", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"PASS: top risks count={len(data)}")

    def test_heatmap_risks(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/heatmap-risks", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"PASS: heatmap risks count={len(data)}")


# ===== GOVERNANCE =====
class TestGovernance:
    """Governance instances"""

    def test_list_governance(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/governance", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5, f"Expected 5 governance instances, got {len(data)}"
        print(f"PASS: governance count={len(data)}")


# ===== ALLOCATIONS =====
class TestAllocations:
    """Allocations"""

    def test_list_allocations(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/allocations", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 18, f"Expected 18 allocations, got {len(data)}"
        print(f"PASS: allocations count={len(data)}")


# ===== MILESTONES =====
class TestMilestones:
    """Milestones"""

    def test_list_milestones(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/milestones", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 21, f"Expected 21 milestones, got {len(data)}"
        print(f"PASS: milestones count={len(data)}")


# ===== TENANT =====
class TestTenant:
    """Tenant settings"""

    def test_get_settings(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/tenant/settings", headers=auth_headers(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, dict)
        print(f"PASS: tenant settings keys={list(data.keys())}")

    def test_put_settings_admin(self, admin_token):
        r = requests.put(f"{BASE_URL}/api/tenant/settings",
                         json={"company_name": "Altair Test Sprint0"},
                         headers=auth_headers(admin_token))
        assert r.status_code == 200
        print("PASS: admin update tenant settings")

    def test_put_settings_viewer_403(self, viewer_token):
        r = requests.put(f"{BASE_URL}/api/tenant/settings",
                         json={"company_name": "X"},
                         headers=auth_headers(viewer_token))
        assert r.status_code == 403
        print("PASS: viewer update tenant settings 403")


# ===== IMPORT/EXPORT =====
class TestImportExport:
    """CSV import template and PPTX export"""

    def test_import_template_projects(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/import/template/projects", headers=auth_headers(admin_token))
        assert r.status_code == 200
        assert len(r.content) > 0
        print(f"PASS: CSV template download size={len(r.content)}")

    def test_export_copil(self, admin_token):
        projects = requests.get(f"{BASE_URL}/api/projects", headers=auth_headers(admin_token)).json()
        pid = projects[0]["project_id"]
        r = requests.post(f"{BASE_URL}/api/export/copil",
                          json={"project_ids": [pid], "instance_date": "2024-01-15"},
                          headers=auth_headers(admin_token))
        assert r.status_code == 200, f"Export copil failed: {r.text[:200]}"
        assert len(r.content) > 1000
        print(f"PASS: export copil size={len(r.content)}")


# ===== RBAC GLOBAL =====
class TestRBACGlobal:
    """READ_ONLY gets 403 on all POST/PUT/DELETE"""

    def test_viewer_post_project(self, viewer_token):
        r = requests.post(f"{BASE_URL}/api/projects",
                          json={"name": "X", "methodology": "Agile", "status_rag": "green",
                                "jh_planned": 1, "start_date": "2024-01-01",
                                "end_date_baseline": "2024-12-31",
                                "end_date_forecast": "2024-12-31"},
                          headers=auth_headers(viewer_token))
        assert r.status_code == 403

    def test_viewer_post_resource(self, viewer_token):
        r = requests.post(f"{BASE_URL}/api/resources",
                          json={"name": "X", "role": "Dev"},
                          headers=auth_headers(viewer_token))
        assert r.status_code == 403

    def test_viewer_post_task(self, viewer_token):
        r = requests.post(f"{BASE_URL}/api/tasks",
                          json={"name": "X", "project_id": "fake", "type": "task", "status": "not_started"},
                          headers=auth_headers(viewer_token))
        assert r.status_code == 403

    def test_viewer_post_risk(self, viewer_token):
        r = requests.post(f"{BASE_URL}/api/risks",
                          json={"title": "X", "project_id": "fake", "category": "tech",
                                "probability": 1, "impact": 1},
                          headers=auth_headers(viewer_token))
        assert r.status_code == 403

    def test_viewer_post_decision(self, viewer_token):
        r = requests.post(f"{BASE_URL}/api/decisions",
                          json={"title": "X", "project_id": "fake", "category": "tech"},
                          headers=auth_headers(viewer_token))
        assert r.status_code == 403
