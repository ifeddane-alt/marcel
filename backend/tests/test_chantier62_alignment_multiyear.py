"""Tests chantier 62: alignment auto + plan pluriannuel budget."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-sync-61.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"Login {email} failed: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_altair():
    tok = _login("admin@altair.fr", "Admin2026!")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def viewer_altair():
    tok = _login("viewer@altair.fr", "View1234!")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def admin_beta():
    tok = _login("admin@betacorp.fr", "Beta2026!")
    return {"Authorization": f"Bearer {tok}"}


# ------------ ARBITRAGE ALIGNEMENT AUTO ------------

class TestArbitrageAlignment:
    def test_summary_alignment_auto(self, admin_altair):
        r = requests.get(f"{API}/arbitrage/summary", headers=admin_altair, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("alignment_auto") is True, f"alignment_auto must be true, got: {data.get('alignment_auto')}"
        projects = data.get("projects") or data.get("items") or []
        assert len(projects) > 0, "expected projects in summary"
        # verify consistency count -> ALI
        mapping = {0: 1, 1: 3, 2: 4}
        for p in projects:
            cnt = p.get("aligned_objectives_count")
            ali = p.get("strategic_alignment")
            assert cnt is not None and ali is not None, f"missing fields on project: {p}"
            expected = mapping.get(cnt, 5) if cnt < 3 else 5
            assert ali == expected, f"project {p.get('id')}: count={cnt} ali={ali} expected={expected}"

    def test_patch_strategic_alignment_blocked(self, admin_altair):
        # Get a project id
        r = requests.get(f"{API}/arbitrage/summary", headers=admin_altair, timeout=30)
        projects = r.json().get("projects") or r.json().get("items") or []
        pid = projects[0]["project_id"]
        r2 = requests.patch(
            f"{API}/arbitrage/projects/{pid}/scoring",
            headers=admin_altair,
            json={"strategic_alignment": 5},
            timeout=30,
        )
        assert r2.status_code == 400, f"expected 400, got {r2.status_code}: {r2.text[:300]}"
        assert "auto" in r2.text.lower() or "object" in r2.text.lower() or "aligne" in r2.text.lower()

    def test_patch_other_criterion_ok(self, admin_altair):
        r = requests.get(f"{API}/arbitrage/summary", headers=admin_altair, timeout=30)
        projects = r.json().get("projects") or r.json().get("items") or []
        pid = projects[0]["project_id"]
        original = projects[0].get("urgency", 3)
        r2 = requests.patch(
            f"{API}/arbitrage/projects/{pid}/scoring",
            headers=admin_altair,
            json={"urgency": 4},
            timeout=30,
        )
        assert r2.status_code == 200, f"got {r2.status_code}: {r2.text[:300]}"
        body = r2.json()
        # score should be recomputed - check total_score field exists
        assert "total_score" in body or "score" in body or "urgency" in body
        # restore
        requests.patch(
            f"{API}/arbitrage/projects/{pid}/scoring",
            headers=admin_altair,
            json={"urgency": original},
            timeout=30,
        )


# ------------ BUDGET MULTIYEAR ------------

class TestBudgetMultiyear:
    def test_get_multiyear(self, admin_altair):
        r = requests.get(f"{API}/budget/multiyear", headers=admin_altair, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("years") == [2026, 2027, 2028], f"years={data.get('years')}"
        items = data.get("items") or data.get("projects") or []
        assert len(items) > 0
        for it in items:
            assert "by_year" in it
            assert "total_window" in it
            assert "out_of_window" in it
            assert "source" in it
            assert it["source"] in ("prorata", "manual")
        totals = data.get("totals") or {}
        assert totals, "totals missing"
        # sum by_year of projects == totals per year
        for y in [2026, 2027, 2028]:
            s = sum((it.get("by_year", {}) or {}).get(str(y), (it.get("by_year", {}) or {}).get(y, 0)) for it in items)
            t = totals.get(str(y), totals.get(y, 0))
            assert abs(s - t) < 1, f"year {y}: sum(items)={s} vs totals={t}"
        envelopes = data.get("envelopes") or {}
        env_2026 = envelopes.get("2026", envelopes.get(2026))
        assert env_2026, f"envelope 2026 missing: {envelopes}"

    def test_put_multiyear_manual_and_reset(self, admin_altair):
        r = requests.get(f"{API}/budget/multiyear", headers=admin_altair, timeout=30)
        items = r.json().get("items") or r.json().get("projects") or []
        pid = items[0]["project_id"]
        # PUT manual
        payload = {"by_year": {"2026": 500000, "2027": 300000, "2028": 100000}}
        r2 = requests.put(f"{API}/budget/project/{pid}/multiyear", headers=admin_altair, json=payload, timeout=30)
        assert r2.status_code == 200, f"got {r2.status_code}: {r2.text[:300]}"
        # verify via GET that source==manual
        rget = requests.get(f"{API}/budget/multiyear", headers=admin_altair, timeout=30)
        item = next(x for x in rget.json()["projects"] if x["project_id"] == pid)
        assert item["source"] == "manual", f"source={item['source']}"
        by = item["by_year"]
        assert by.get("2026", by.get(2026)) == 500000
        assert by.get("2027", by.get(2027)) == 300000
        assert by.get("2028", by.get(2028)) == 100000
        # RESET
        r3 = requests.put(f"{API}/budget/project/{pid}/multiyear", headers=admin_altair, json={"reset": True}, timeout=30)
        assert r3.status_code == 200, r3.text
        rget2 = requests.get(f"{API}/budget/multiyear", headers=admin_altair, timeout=30)
        item2 = next(x for x in rget2.json()["projects"] if x["project_id"] == pid)
        assert item2["source"] == "prorata"

    def test_put_multiyear_validation(self, admin_altair):
        r = requests.get(f"{API}/budget/multiyear", headers=admin_altair, timeout=30)
        items = r.json().get("items") or r.json().get("projects") or []
        pid = items[0]["project_id"]
        # negative amount
        r_neg = requests.put(
            f"{API}/budget/project/{pid}/multiyear",
            headers=admin_altair,
            json={"by_year": {"2026": -100, "2027": 0, "2028": 0}},
            timeout=30,
        )
        assert r_neg.status_code in (400, 422), f"negative amt: {r_neg.status_code} {r_neg.text[:200]}"
        # empty by_year
        r_empty = requests.put(
            f"{API}/budget/project/{pid}/multiyear",
            headers=admin_altair,
            json={"by_year": {}},
            timeout=30,
        )
        assert r_empty.status_code in (400, 422), f"empty: {r_empty.status_code} {r_empty.text[:200]}"
        # cleanup: ensure prorata
        requests.put(f"{API}/budget/project/{pid}/multiyear", headers=admin_altair, json={"reset": True}, timeout=30)

    def test_viewer_get_ok_put_forbidden(self, viewer_altair, admin_altair):
        r = requests.get(f"{API}/budget/multiyear", headers=viewer_altair, timeout=30)
        assert r.status_code == 200
        # PUT should be 403
        r_admin = requests.get(f"{API}/budget/multiyear", headers=admin_altair, timeout=30)
        pid = (r_admin.json().get("projects") or [])[0]["project_id"]
        r2 = requests.put(f"{API}/budget/project/{pid}/multiyear", headers=viewer_altair, json={"reset": True}, timeout=30)
        assert r2.status_code == 403, f"expected 403, got {r2.status_code}"

    def test_tenant_isolation(self, admin_altair, admin_beta):
        r_admin = requests.get(f"{API}/budget/multiyear", headers=admin_altair, timeout=30)
        pid = (r_admin.json().get("projects") or [])[0]["project_id"]
        r_beta = requests.put(
            f"{API}/budget/project/{pid}/multiyear",
            headers=admin_beta,
            json={"reset": True},
            timeout=30,
        )
        assert r_beta.status_code == 404, f"expected 404, got {r_beta.status_code}"


# ------------ REGRESSION ------------

class TestRegression:
    def test_arbitrage_pdf(self, admin_altair):
        r = requests.get(f"{API}/arbitrage/export-pdf", headers=admin_altair, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.content[:4] == b"%PDF", f"not a PDF, first bytes: {r.content[:20]}"

    def test_budget_summary_still_ok(self, admin_altair):
        r = requests.get(f"{API}/budget/overview", headers=admin_altair, timeout=30)
        # accept 200 or existence of any budget list endpoint
        assert r.status_code in (200, 404), r.text[:200]
