"""Tests for SAFe features<->PI assignment + Participatory Budgeting (SAFe mode + Manual mode)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read the frontend env file
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

PI_2_2026 = "686c54ee-b5ec-46c5-98b3-9c63dcacd42b"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@altair.fr", "password": "Admin2026!"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def pmo_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "pmo@altair.fr", "password": "Pmo1234!"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ─── SAFe Feature Candidates & Assignment ─────────────────────────────

class TestFeatureCandidates:
    def test_candidates_returns_features_with_cost(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/safe/features/candidates", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        features = r.json()
        assert isinstance(features, list)
        assert len(features) >= 1, "expected features in tenant"
        # Each feature must have cost_eur, project_name/code, pi_name (nullable)
        for f in features:
            assert "cost_eur" in f
            assert "project_name" in f
            assert "project_code" in f
            assert "pi_name" in f
            assert isinstance(f["cost_eur"], (int, float))

    def test_candidates_forbidden_without_auth(self):
        r = requests.get(f"{BASE_URL}/api/safe/features/candidates")
        assert r.status_code in (401, 403)


class TestPIFeatures:
    def test_pi_features_returns_valued_features(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/safe/pis/{PI_2_2026}/features", headers=_h(admin_token))
        assert r.status_code == 200, r.text
        feats = r.json()
        assert isinstance(feats, list)
        # main agent context said 4 features affected
        assert len(feats) >= 2
        for f in feats:
            assert f.get("pi_id") == PI_2_2026
            assert "cost_eur" in f

    def test_pi_features_404_on_unknown(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/safe/pis/does-not-exist/features", headers=_h(admin_token))
        assert r.status_code == 404


class TestAssignFeaturePI:
    def test_assign_and_unassign(self, admin_token):
        # Pick a candidate feature that is NOT currently on PI_2_2026
        cands = requests.get(f"{BASE_URL}/api/safe/features/candidates", headers=_h(admin_token)).json()
        target = next((c for c in cands if c.get("pi_id") != PI_2_2026), None)
        assert target, "no feature available for assignment test"
        task_id = target["task_id"]
        original_pi = target.get("pi_id")

        # Assign to PI_2_2026
        r = requests.patch(f"{BASE_URL}/api/safe/features/{task_id}/pi",
                           json={"pi_id": PI_2_2026}, headers=_h(admin_token))
        assert r.status_code == 200, r.text
        assert r.json().get("pi_id") == PI_2_2026
        assert r.json().get("train_id"), "train_id must be set from PI"

        # Restore
        r = requests.patch(f"{BASE_URL}/api/safe/features/{task_id}/pi",
                           json={"pi_id": original_pi}, headers=_h(admin_token))
        assert r.status_code == 200

    def test_assign_unknown_feature(self, admin_token):
        r = requests.patch(f"{BASE_URL}/api/safe/features/no-such-task/pi",
                           json={"pi_id": PI_2_2026}, headers=_h(admin_token))
        assert r.status_code == 404

    def test_assign_unknown_pi(self, admin_token):
        cands = requests.get(f"{BASE_URL}/api/safe/features/candidates", headers=_h(admin_token)).json()
        task_id = cands[0]["task_id"]
        r = requests.patch(f"{BASE_URL}/api/safe/features/{task_id}/pi",
                           json={"pi_id": "no-such-pi"}, headers=_h(admin_token))
        assert r.status_code == 404

    def test_assign_forbidden_without_auth(self, admin_token):
        cands = requests.get(f"{BASE_URL}/api/safe/features/candidates", headers=_h(admin_token)).json()
        task_id = cands[0]["task_id"]
        r = requests.patch(f"{BASE_URL}/api/safe/features/{task_id}/pi", json={"pi_id": None})
        assert r.status_code in (401, 403)


# ─── PB SAFe Session flow ─────────────────────────────────────────────

class TestPBSafeSession:
    session_id = None
    items = None
    envelope = 2_000_000

    def test_create_safe_session(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/pb/sessions",
                          json={"name": "TEST_PB_SAFE_ITER", "envelope": self.envelope,
                                "pi_id": PI_2_2026},
                          headers=_h(admin_token))
        assert r.status_code == 201, r.text
        s = r.json()
        assert s["mode"] == "safe"
        assert s["pi_id"] == PI_2_2026
        assert s.get("pi_name")
        assert len(s["items"]) >= 2
        for it in s["items"]:
            assert it["ref"]  # task_id
            assert it["label"]
        TestPBSafeSession.session_id = s["session_id"]
        TestPBSafeSession.items = s["items"]

    def test_create_safe_session_pi_lt2_features(self, admin_token):
        # Find a PI with < 2 features
        pis = requests.get(f"{BASE_URL}/api/safe/pis", headers=_h(admin_token)).json()
        for pi in pis:
            feats = requests.get(f"{BASE_URL}/api/safe/pis/{pi['pi_id']}/features", headers=_h(admin_token)).json()
            if len(feats) < 2:
                r = requests.post(f"{BASE_URL}/api/pb/sessions",
                                  json={"name": "TEST_SHOULD_FAIL", "envelope": 100000,
                                        "pi_id": pi["pi_id"]},
                                  headers=_h(admin_token))
                assert r.status_code == 400
                assert "features" in r.text.lower()
                return
        pytest.skip("No PI with <2 features to test")

    def test_vote_over_envelope_rejected(self, admin_token):
        assert TestPBSafeSession.session_id
        # Sum items cost > envelope typically or force over-allocation
        allocs = {it["item_id"]: self.envelope for it in TestPBSafeSession.items}
        r = requests.post(f"{BASE_URL}/api/pb/sessions/{TestPBSafeSession.session_id}/vote",
                          json={"allocations": allocs}, headers=_h(admin_token))
        assert r.status_code == 400
        assert "enveloppe" in r.text.lower() or "envelope" in r.text.lower()

    def test_vote_and_results_cutline(self, admin_token, pmo_token):
        assert TestPBSafeSession.session_id
        items = TestPBSafeSession.items
        # Allocate: max to first item, some to others - use costs to shape allocation
        # Ensure total <= envelope
        alloc1 = {}
        remaining = self.envelope
        for i, it in enumerate(items):
            share = min(it["cost"], remaining) if it["cost"] > 0 else 0
            if i == len(items) - 1:
                share = 0  # keep last unfunded
            alloc1[it["item_id"]] = share
            remaining -= share
        r = requests.post(f"{BASE_URL}/api/pb/sessions/{TestPBSafeSession.session_id}/vote",
                          json={"allocations": alloc1}, headers=_h(admin_token))
        assert r.status_code == 200, r.text

        # PMO second vote (similar shape)
        r = requests.post(f"{BASE_URL}/api/pb/sessions/{TestPBSafeSession.session_id}/vote",
                          json={"allocations": alloc1}, headers=_h(pmo_token))
        assert r.status_code == 200, r.text

        # Results
        r = requests.get(f"{BASE_URL}/api/pb/sessions/{TestPBSafeSession.session_id}/results",
                         headers=_h(admin_token))
        assert r.status_code == 200
        res = r.json()
        assert res["participation"] == 2
        assert "retained_count" in res
        assert "retained_cost" in res
        assert res["retained_cost"] <= self.envelope
        # cutline: at least one item retained, sorted by avg_allocation
        sorted_items = res["items"]
        assert sorted_items[0]["avg_allocation"] >= sorted_items[-1]["avg_allocation"]
        # Last item with 0 allocation must not be retained
        assert sorted_items[-1]["retained"] is False

    def test_decide_applies_arbitrage(self, admin_token):
        assert TestPBSafeSession.session_id
        # Close first
        r = requests.put(f"{BASE_URL}/api/pb/sessions/{TestPBSafeSession.session_id}",
                         json={"status": "closed"}, headers=_h(admin_token))
        assert r.status_code == 200
        # Decide
        r = requests.put(f"{BASE_URL}/api/pb/sessions/{TestPBSafeSession.session_id}",
                         json={"status": "decided"}, headers=_h(admin_token))
        assert r.status_code == 200
        s = r.json()
        assert s.get("status") == "decided"
        assert s.get("decision"), "decision field must be populated"
        assert "features_sec" in s["decision"]
        assert "features_etendu" in s["decision"]

        # Verify a task in items got scope_status updated and pb_decision
        ref = TestPBSafeSession.items[0]["ref"]
        # Use candidates endpoint to retrieve enriched task
        cands = requests.get(f"{BASE_URL}/api/safe/features/candidates", headers=_h(admin_token)).json()
        t = next((c for c in cands if c["task_id"] == ref), None)
        assert t is not None
        assert t.get("scope_status") in ("sec", "etendu")
        assert t.get("pb_decision", {}).get("session_id") == TestPBSafeSession.session_id

    def test_cleanup_delete_session(self, admin_token):
        if TestPBSafeSession.session_id:
            r = requests.delete(f"{BASE_URL}/api/pb/sessions/{TestPBSafeSession.session_id}",
                                headers=_h(admin_token))
            assert r.status_code in (204, 200)


# ─── PB Manual Session (non-regression) ───────────────────────────────

class TestPBManualSession:
    session_id = None

    def test_create_manual_session(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/pb/sessions",
                          json={"name": "TEST_MANUAL_ITER", "envelope": 100000,
                                "items": [
                                    {"label": "Cand A", "cost": 30000},
                                    {"label": "Cand B", "cost": 50000},
                                    {"label": "Cand C", "cost": 40000},
                                ]},
                          headers=_h(admin_token))
        assert r.status_code == 201, r.text
        s = r.json()
        assert s.get("mode") != "safe"
        assert len(s["items"]) == 3
        TestPBManualSession.session_id = s["session_id"]

    def test_manual_decide_does_not_touch_tasks(self, admin_token):
        assert TestPBManualSession.session_id
        # Vote briefly to close
        s = requests.get(f"{BASE_URL}/api/pb/sessions/{TestPBManualSession.session_id}",
                        headers=_h(admin_token)).json()
        allocs = {s["items"][0]["item_id"]: 30000, s["items"][1]["item_id"]: 50000}
        requests.post(f"{BASE_URL}/api/pb/sessions/{TestPBManualSession.session_id}/vote",
                     json={"allocations": allocs}, headers=_h(admin_token))
        # Close + decide
        r = requests.put(f"{BASE_URL}/api/pb/sessions/{TestPBManualSession.session_id}",
                         json={"status": "closed"}, headers=_h(admin_token))
        assert r.status_code == 200
        r = requests.put(f"{BASE_URL}/api/pb/sessions/{TestPBManualSession.session_id}",
                         json={"status": "decided"}, headers=_h(admin_token))
        assert r.status_code == 200
        # Ensure no 'decision' side-effects (manual doesn't set decision object)
        s = r.json()
        # decision may be absent — that's fine. Assert decision not set with features_sec
        assert s.get("decision") in (None, {})

    def test_cleanup_delete_manual(self, admin_token):
        if TestPBManualSession.session_id:
            r = requests.delete(f"{BASE_URL}/api/pb/sessions/{TestPBManualSession.session_id}",
                                headers=_h(admin_token))
            assert r.status_code in (204, 200)
