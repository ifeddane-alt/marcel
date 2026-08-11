"""
Chantier 63 - Trajectoire objectifs + Enveloppes N/N+1/N+2 + Alertes dépassement.

Tests:
1. GET /api/objectives : progress_avg, milestones_done/total, budget_consumed, projet progress
2. POST /api/arbitrage/envelopes : trigger envelope_overrun notification (admin + pmo, not viewer)
3. Anti-spam : re-post enveloppe → no duplicate notif ; enveloppe > plan → flag reset
4. PUT /api/budget/project/{id}/multiyear qui provoque overrun → notif
5. Nettoyage complet
"""
import os
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-sync-61.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

TEST_PROJECT_ID = "21fa6d43-0ce8-4ee7-8e06-114ef3199006"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@altair.fr", "Admin2026!")


@pytest.fixture(scope="module")
def pmo_token():
    return _login("pmo@altair.fr", "Pmo1234!")


@pytest.fixture(scope="module")
def viewer_token():
    return _login("viewer@altair.fr", "View1234!")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_token):
    """Cleanup before + after tests."""
    def _clean():
        # Delete envelope 2027 if exists
        try:
            r = requests.get(f"{API}/arbitrage/envelopes", headers=_h(admin_token), timeout=10)
            if r.status_code == 200:
                for env in r.json():
                    if env.get("year") == 2027:
                        eid = env.get("envelope_id") or env.get("id") or env.get("_id")
                        if eid:
                            requests.delete(f"{API}/arbitrage/envelopes/{eid}", headers=_h(admin_token), timeout=10)
        except Exception as e:
            print(f"envelope cleanup: {e}")
        # Reset multiyear
        try:
            requests.put(f"{API}/budget/project/{TEST_PROJECT_ID}/multiyear",
                         json={"reset": True}, headers=_h(admin_token), timeout=10)
        except Exception as e:
            print(f"multiyear reset: {e}")
        # Purge envelope_overrun notifications directly in DB
        try:
            cli = MongoClient(MONGO_URL)
            db = cli[DB_NAME]
            res = db.notifications.delete_many({"type": "envelope_overrun"})
            print(f"purged {res.deleted_count} envelope_overrun notifs")
            cli.close()
        except Exception as e:
            print(f"mongo purge: {e}")

    _clean()
    yield
    _clean()


# ------- 1. Objectifs trajectoire -------
class TestObjectivesTrajectory:
    def test_objectives_have_trajectory_fields(self, admin_token):
        r = requests.get(f"{API}/objectives", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        objs = r.json()
        assert isinstance(objs, list) and len(objs) >= 3

        for o in objs:
            assert "progress_avg" in o, f"missing progress_avg in {o.get('title')}"
            assert "milestones_done" in o
            assert "milestones_total" in o
            assert "budget_consumed" in o
            assert 0 <= o["progress_avg"] <= 100
            for p in o.get("projects", []):
                assert "progress" in p
                assert "milestones_done" in p
                assert "milestones_total" in p

    def test_expected_demo_data(self, admin_token):
        r = requests.get(f"{API}/objectives", headers=_h(admin_token), timeout=15)
        objs = r.json()
        by_title = {o["title"]: o for o in objs}

        # Réduire le coût de run
        cout = next((o for o in objs if "coût de run" in o["title"].lower() or "cout de run" in o["title"].lower()), None)
        assert cout is not None, f"objectif 'Réduire coût de run' introuvable dans {list(by_title)}"
        assert len(cout.get("projects", [])) == 2, f"expected 2 projects got {len(cout.get('projects', []))}"
        assert cout["milestones_total"] == 43, f"milestones_total={cout['milestones_total']}"
        assert cout["milestones_done"] == 3, f"milestones_done={cout['milestones_done']}"
        # budget_consumed ~ 3 570 000
        assert 3_500_000 <= cout["budget_consumed"] <= 3_650_000, f"budget_consumed={cout['budget_consumed']}"

        # Accélérer la transformation
        acc = next((o for o in objs if "accélérer" in o["title"].lower() or "accelerer" in o["title"].lower()), None)
        assert acc is not None
        assert len(acc.get("projects", [])) == 3
        assert acc["milestones_total"] == 46
        assert acc["milestones_done"] == 4

        # Objectif sans projet
        empty = next((o for o in objs if not o.get("projects")), None)
        if empty:
            assert empty["progress_avg"] == 0
            assert empty["milestones_total"] == 0
            assert empty["milestones_done"] == 0


# ------- 2. Enveloppe overrun -------
def _get_notifs(tok, ntype="envelope_overrun"):
    r = requests.get(f"{API}/notifications", headers=_h(tok), timeout=15)
    assert r.status_code == 200
    return [n for n in r.json() if n.get("type") == ntype]


class TestEnvelopeOverrun:
    def test_create_envelope_below_plan_triggers_notif(self, admin_token, pmo_token, viewer_token):
        # Baseline
        before_admin = len(_get_notifs(admin_token))
        before_pmo = len(_get_notifs(pmo_token))
        before_viewer = len(_get_notifs(viewer_token))

        r = requests.post(f"{API}/arbitrage/envelopes",
                          json={"year": 2027, "capex_envelope": 30000, "opex_envelope": 20000},
                          headers=_h(admin_token), timeout=15)
        assert r.status_code in (200, 201), f"create env failed: {r.status_code} {r.text}"

        after_admin = _get_notifs(admin_token)
        after_pmo = _get_notifs(pmo_token)
        after_viewer = _get_notifs(viewer_token)

        assert len(after_admin) == before_admin + 1, f"admin: {before_admin} → {len(after_admin)}"
        assert len(after_pmo) == before_pmo + 1, f"pmo: {before_pmo} → {len(after_pmo)}"
        assert len(after_viewer) == before_viewer, "viewer should NOT receive envelope_overrun"

        # Message content
        latest = after_admin[0]
        msg = (latest.get("message") or "") + " " + (latest.get("title") or "")
        assert "2027" in msg, f"'2027' missing in notif: {latest}"

    def test_antispam_no_duplicate(self, admin_token):
        before = len(_get_notifs(admin_token))
        r = requests.post(f"{API}/arbitrage/envelopes",
                          json={"year": 2027, "capex_envelope": 30000, "opex_envelope": 20000},
                          headers=_h(admin_token), timeout=15)
        assert r.status_code in (200, 201)
        after = len(_get_notifs(admin_token))
        assert after == before, f"anti-spam broken: {before} → {after}"

    def test_envelope_above_plan_resets_flag(self, admin_token):
        # Set envelope well above plan (200 000 > ~66 667)
        before = len(_get_notifs(admin_token))
        r = requests.post(f"{API}/arbitrage/envelopes",
                          json={"year": 2027, "capex_envelope": 120000, "opex_envelope": 80000},
                          headers=_h(admin_token), timeout=15)
        assert r.status_code in (200, 201)
        after = len(_get_notifs(admin_token))
        assert after == before, "envelope above plan should not trigger notif"

    def test_multiyear_adjustment_triggers_notif(self, admin_token):
        before = len(_get_notifs(admin_token))
        r = requests.put(f"{API}/budget/project/{TEST_PROJECT_ID}/multiyear",
                         json={"by_year": {"2026": 500000, "2027": 300000}},
                         headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, f"multiyear PUT: {r.status_code} {r.text}"
        after = len(_get_notifs(admin_token))
        assert after == before + 1, f"expected new notif: {before} → {after}"
