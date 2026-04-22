"""Backend tests for Demands module - CRUD, Workflow, RBAC"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Credentials
PMO_CREDS = {"email": "pmo@altair.fr", "password": "Pmo1234!"}
ADMIN_CREDS = {"email": "admin@altair.fr", "password": "Admin1234!"}
VIEWER_CREDS = {"email": "viewer@altair.fr", "password": "View1234!"}


def get_token(creds):
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=creds)
    if resp.status_code == 200:
        return resp.json().get("access_token") or resp.json().get("token")
    return None


@pytest.fixture(scope="module")
def pmo_token():
    token = get_token(PMO_CREDS)
    if not token:
        pytest.skip("PMO login failed")
    return token


@pytest.fixture(scope="module")
def viewer_token():
    token = get_token(VIEWER_CREDS)
    if not token:
        pytest.skip("Viewer login failed")
    return token


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ─── Seed ─────────────────────────────────────────────────────────────────────

class TestSeed:
    def test_seed_demands(self, pmo_token):
        resp = requests.post(f"{BASE_URL}/api/demands/seed", headers=auth_headers(pmo_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "seeded" in data or "message" in data


# ─── GET /demands ─────────────────────────────────────────────────────────────

class TestListDemands:
    def test_list_demands_pmo(self, pmo_token):
        resp = requests.get(f"{BASE_URL}/api/demands", headers=auth_headers(pmo_token))
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        print(f"Total demands: {len(data)}")

    def test_filter_by_status(self, pmo_token):
        resp = requests.get(f"{BASE_URL}/api/demands?status=nouvelle", headers=auth_headers(pmo_token))
        assert resp.status_code == 200
        data = resp.json()
        for d in data:
            assert d["status"] == "nouvelle"

    def test_filter_by_urgency(self, pmo_token):
        resp = requests.get(f"{BASE_URL}/api/demands?urgency=critical", headers=auth_headers(pmo_token))
        assert resp.status_code == 200
        data = resp.json()
        for d in data:
            assert d["urgency"] == "critical"

    def test_viewer_can_list(self, viewer_token):
        resp = requests.get(f"{BASE_URL}/api/demands", headers=auth_headers(viewer_token))
        assert resp.status_code == 200


# ─── POST /demands ─────────────────────────────────────────────────────────────

class TestCreateDemand:
    def test_create_demand_pmo(self, pmo_token):
        payload = {"title": "TEST_Demand", "requester": "Test User", "urgency": "medium"}
        resp = requests.post(f"{BASE_URL}/api/demands", json=payload, headers=auth_headers(pmo_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "TEST_Demand"
        assert data["status"] == "nouvelle"
        assert "demand_id" in data
        # cleanup
        requests.delete(f"{BASE_URL}/api/demands/{data['demand_id']}", headers=auth_headers(pmo_token))

    def test_create_demand_readonly_forbidden(self, viewer_token):
        payload = {"title": "TEST_Demand_RO", "requester": "Viewer", "urgency": "low"}
        resp = requests.post(f"{BASE_URL}/api/demands", json=payload, headers=auth_headers(viewer_token))
        assert resp.status_code == 403


# ─── Workflow transitions ─────────────────────────────────────────────────────

class TestWorkflowTransitions:
    """Create a demand and test each workflow step"""

    def setup_method(self):
        self.token = get_token(PMO_CREDS)
        # Create a fresh demand
        payload = {"title": "TEST_Workflow", "requester": "Tester", "urgency": "high"}
        resp = requests.post(f"{BASE_URL}/api/demands", json=payload, headers=auth_headers(self.token))
        self.demand_id = resp.json()["demand_id"]

    def teardown_method(self):
        requests.delete(f"{BASE_URL}/api/demands/{self.demand_id}", headers=auth_headers(self.token))

    def test_qualify(self):
        resp = requests.patch(
            f"{BASE_URL}/api/demands/{self.demand_id}/transition",
            json={"action": "qualify"},
            headers=auth_headers(self.token)
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "qualifiee"

    def test_invalid_transition_nouvelle_to_priorisee(self):
        # nouvelle → priorisee is invalid
        resp = requests.patch(
            f"{BASE_URL}/api/demands/{self.demand_id}/transition",
            json={"action": "prioritize", "priority_score": 80},
            headers=auth_headers(self.token)
        )
        assert resp.status_code == 400

    def test_prioritize_requires_score(self):
        # First qualify
        requests.patch(
            f"{BASE_URL}/api/demands/{self.demand_id}/transition",
            json={"action": "qualify"},
            headers=auth_headers(self.token)
        )
        # Prioritize without score
        resp = requests.patch(
            f"{BASE_URL}/api/demands/{self.demand_id}/transition",
            json={"action": "prioritize"},
            headers=auth_headers(self.token)
        )
        assert resp.status_code == 400

    def test_refuse_requires_reason(self):
        # Qualify then prioritize
        requests.patch(f"{BASE_URL}/api/demands/{self.demand_id}/transition", json={"action": "qualify"}, headers=auth_headers(self.token))
        requests.patch(f"{BASE_URL}/api/demands/{self.demand_id}/transition", json={"action": "prioritize", "priority_score": 70}, headers=auth_headers(self.token))
        # Refuse without reason
        resp = requests.patch(
            f"{BASE_URL}/api/demands/{self.demand_id}/transition",
            json={"action": "refuse"},
            headers=auth_headers(self.token)
        )
        assert resp.status_code == 400

    def test_full_workflow_qualify_prioritize_accept(self):
        requests.patch(f"{BASE_URL}/api/demands/{self.demand_id}/transition", json={"action": "qualify"}, headers=auth_headers(self.token))
        requests.patch(f"{BASE_URL}/api/demands/{self.demand_id}/transition", json={"action": "prioritize", "priority_score": 75}, headers=auth_headers(self.token))
        resp = requests.patch(f"{BASE_URL}/api/demands/{self.demand_id}/transition", json={"action": "accept"}, headers=auth_headers(self.token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "acceptee"

    def test_readonly_cannot_transition(self):
        vtoken = get_token(VIEWER_CREDS)
        resp = requests.patch(
            f"{BASE_URL}/api/demands/{self.demand_id}/transition",
            json={"action": "qualify"},
            headers=auth_headers(vtoken)
        )
        assert resp.status_code == 403


# ─── DELETE ───────────────────────────────────────────────────────────────────

class TestDeleteDemand:
    def test_delete_demand(self, pmo_token):
        payload = {"title": "TEST_Delete", "requester": "Tester", "urgency": "low"}
        resp = requests.post(f"{BASE_URL}/api/demands", json=payload, headers=auth_headers(pmo_token))
        demand_id = resp.json()["demand_id"]
        del_resp = requests.delete(f"{BASE_URL}/api/demands/{demand_id}", headers=auth_headers(pmo_token))
        assert del_resp.status_code == 200
        get_resp = requests.get(f"{BASE_URL}/api/demands/{demand_id}", headers=auth_headers(pmo_token))
        assert get_resp.status_code == 404
