"""
Backend tests for Arbitrage Portefeuille module
Tests: summary, weights, envelopes, scoring patch, scenarios
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PASS = "Admin2026!"


@pytest.fixture(scope="module")
def token():
    res = requests.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json().get("access_token") or res.json().get("token")


@pytest.fixture(scope="module")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


class TestArbitrageSummary:
    """Tests for GET /api/arbitrage/summary"""

    def test_summary_returns_200(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
        print(f"PASS: summary 200")

    def test_summary_has_projects(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        data = res.json()
        assert "projects" in data
        assert len(data["projects"]) > 0
        print(f"PASS: {len(data['projects'])} projects returned")

    def test_summary_has_8_projects(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        data = res.json()
        count = len(data["projects"])
        assert count == 8, f"Expected 8 projects, got {count}"
        print(f"PASS: exactly 8 projects")

    def test_summary_projects_sorted_by_score_desc(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        projects = res.json()["projects"]
        scores = [p["score"] for p in projects]
        assert scores == sorted(scores, reverse=True), f"Projects not sorted by score desc: {scores}"
        print(f"PASS: scores sorted desc: {scores}")

    def test_summary_top_project_is_crm(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        top = res.json()["projects"][0]
        assert "crm" in top["name"].lower() or "salesforce" in top["name"].lower(), \
            f"Top project should be CRM Salesforce, got: {top['name']} with score {top['score']}"
        print(f"PASS: top project: {top['name']} score={top['score']}")

    def test_summary_has_totals(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        data = res.json()
        assert "totals" in data
        totals = data["totals"]
        assert "capex_planned" in totals
        assert "opex_planned" in totals
        print(f"PASS: totals capex={totals['capex_planned']}, opex={totals['opex_planned']}")

    def test_summary_capex_approx_5_675m(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        capex = res.json()["totals"]["capex_planned"]
        # Allow ~10% tolerance
        assert abs(capex - 5675000) < 1000000, f"CAPEX expected ~5.675M, got {capex}"
        print(f"PASS: CAPEX total = {capex}")

    def test_summary_opex_approx_11_375m(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        opex = res.json()["totals"]["opex_planned"]
        assert abs(opex - 11375000) < 2000000, f"OPEX expected ~11.375M, got {opex}"
        print(f"PASS: OPEX total = {opex}")

    def test_summary_has_weights(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        data = res.json()
        assert "weights" in data
        w = data["weights"]
        for k in ["w1", "w2", "w3", "w4", "w5", "w6"]:
            assert k in w, f"Missing weight {k}"
        print(f"PASS: weights present: {w}")

    def test_summary_projects_have_score_field(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        projects = res.json()["projects"]
        for p in projects:
            assert "score" in p, f"Project {p.get('name')} missing score"
            assert 0 <= p["score"] <= 100
        print("PASS: all projects have valid scores 0-100")


class TestArbitrageWeights:
    """Tests for GET/PUT /api/arbitrage/weights"""

    def test_get_weights_200(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/weights")
        assert res.status_code == 200
        print("PASS: get weights 200")

    def test_get_weights_has_defaults(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/weights")
        w = res.json()
        assert abs(w.get("w1", 0) - 0.20) < 0.01
        assert abs(w.get("w2", 0) - 0.25) < 0.01
        assert abs(w.get("w3", 0) - 0.15) < 0.01
        assert abs(w.get("w4", 0) - 0.15) < 0.01
        assert abs(w.get("w5", 0) - 0.15) < 0.01
        assert abs(w.get("w6", 0) - 0.10) < 0.01
        print(f"PASS: default weights correct: {w}")


class TestArbitrageEnvelopes:
    """Tests for GET/POST /api/arbitrage/envelopes"""

    def test_get_envelopes_200(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/envelopes")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        print(f"PASS: {len(data)} envelopes")

    def test_2026_envelope_exists(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/envelopes")
        envelopes = res.json()
        years = [e["year"] for e in envelopes]
        assert 2026 in years, f"No 2026 envelope found. Years: {years}"
        env = next(e for e in envelopes if e["year"] == 2026)
        print(f"PASS: 2026 envelope: capex={env.get('capex_envelope')}, opex={env.get('opex_envelope')}")

    def test_2026_capex_is_12m(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/envelopes")
        envelopes = res.json()
        env = next((e for e in envelopes if e["year"] == 2026), None)
        if env:
            assert abs(env["capex_envelope"] - 12000000) < 500000, \
                f"CAPEX envelope expected 12M, got {env['capex_envelope']}"
        print(f"PASS: CAPEX envelope = {env['capex_envelope'] if env else 'N/A'}")

    def test_2026_opex_is_6m(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/envelopes")
        envelopes = res.json()
        env = next((e for e in envelopes if e["year"] == 2026), None)
        if env:
            assert abs(env["opex_envelope"] - 6000000) < 500000, \
                f"OPEX envelope expected 6M, got {env['opex_envelope']}"
        print(f"PASS: OPEX envelope = {env['opex_envelope'] if env else 'N/A'}")

    def test_create_envelope(self, client):
        res = client.post(f"{BASE_URL}/api/arbitrage/envelopes", json={
            "year": 2099,
            "capex_envelope": 5000000,
            "opex_envelope": 3000000,
            "label": "TEST_Envelope 2099"
        })
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["year"] == 2099
        print(f"PASS: created envelope id={data.get('envelope_id')}")
        # cleanup
        if data.get("envelope_id"):
            client.delete(f"{BASE_URL}/api/arbitrage/envelopes/{data['envelope_id']}")


class TestArbitrageScoring:
    """Tests for PATCH /api/arbitrage/projects/{id}/scoring"""

    def test_patch_scoring_returns_updated_score(self, client):
        # Get first project
        res = client.get(f"{BASE_URL}/api/arbitrage/summary")
        projects = res.json()["projects"]
        proj = projects[0]
        pid = proj["project_id"]
        original_align = proj.get("strategic_alignment") or 3

        patch_res = client.patch(f"{BASE_URL}/api/arbitrage/projects/{pid}/scoring",
                                  json={"strategic_alignment": 4})
        assert patch_res.status_code == 200, f"Expected 200, got {patch_res.status_code}: {patch_res.text}"
        data = patch_res.json()
        assert "score" in data
        assert data["strategic_alignment"] == 4
        print(f"PASS: patch scoring returned score={data['score']}")

        # restore
        client.patch(f"{BASE_URL}/api/arbitrage/projects/{pid}/scoring",
                      json={"strategic_alignment": original_align})

    def test_patch_scoring_invalid_project(self, client):
        res = client.patch(f"{BASE_URL}/api/arbitrage/projects/nonexistent-id-999/scoring",
                            json={"strategic_alignment": 4})
        assert res.status_code == 404
        print("PASS: 404 for nonexistent project")


class TestArbitrageScenarios:
    """Tests for /api/arbitrage/scenarios"""

    def test_list_scenarios_200(self, client):
        res = client.get(f"{BASE_URL}/api/arbitrage/scenarios")
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        print(f"PASS: {len(res.json())} scenarios")

    def test_save_scenario(self, client):
        res = client.post(f"{BASE_URL}/api/arbitrage/scenarios", json={
            "name": "TEST_Scenario",
            "description": "Test scenario for testing",
            "modifications": [],
            "summary": {"capexDelta": 0}
        })
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["name"] == "TEST_Scenario"
        assert "scenario_id" in data
        print(f"PASS: scenario created id={data['scenario_id']}")
        # cleanup
        client.delete(f"{BASE_URL}/api/arbitrage/scenarios/{data['scenario_id']}")
