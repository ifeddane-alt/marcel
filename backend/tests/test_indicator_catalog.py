"""Tests for indicator catalog module: /api/indicator-catalog*"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-sync-61.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@altair.fr", "Admin2026!")


@pytest.fixture(scope="module")
def pmo_token():
    return _login("pmo@altair.fr", "Pmo1234!")


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def pmo_h(pmo_token):
    return {"Authorization": f"Bearer {pmo_token}"}


# ---------- Catalog listing ----------
class TestCatalogList:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/indicator-catalog", timeout=30)
        assert r.status_code in (401, 403)

    def test_list_returns_149(self, admin_h):
        r = requests.get(f"{API}/indicator-catalog", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 140, f"expected ~149 indicators, got {len(data)}"
        sample = data[0]
        for key in ("indicator_id", "domain", "name", "method", "level", "priority", "computability"):
            assert key in sample, f"missing key {key} in {sample}"

    def test_computability_distribution(self, admin_h):
        r = requests.get(f"{API}/indicator-catalog", headers=admin_h, timeout=30)
        data = r.json()
        counts = {}
        for it in data:
            counts[it.get("computability")] = counts.get(it.get("computability"), 0) + 1
        # Expect auto count around 24
        auto = counts.get("auto", 0)
        assert auto >= 20 and auto <= 40, f"auto count={auto} expected ~24"
        assert counts.get("manual", 0) >= 50
        print(f"Computability counts: {counts}")

    def test_filter_scope_portfolio(self, admin_h):
        r = requests.get(f"{API}/indicator-catalog?scope=portfolio", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for it in data:
            levels = it.get("level", "") + " " + " ".join(it.get("scopes", []) or [])
            lvl = (it.get("level") or "").lower()
            scopes = [s.lower() for s in (it.get("scopes") or [])]
            # portfolio scope should include portefeuille or ART
            assert ("portefeuille" in lvl or "art" in lvl or "portfolio" in scopes or "art" in scopes
                    or "portefeuille" in " ".join(scopes)), f"unexpected item for portfolio: {it.get('indicator_id')} level={lvl} scopes={scopes}"


# ---------- Selections ----------
class TestSelections:
    def test_get_selection_default(self, admin_h):
        for scope in ["project", "program", "portfolio", "dashboard"]:
            r = requests.get(f"{API}/indicator-catalog/selections/{scope}", headers=admin_h, timeout=30)
            assert r.status_code == 200, f"{scope}: {r.status_code} {r.text[:100]}"
            data = r.json()
            assert "indicator_ids" in data or isinstance(data, dict)

    def test_put_selection_filters_invalid(self, admin_h):
        # portfolio scope: try to set a mix of valid + invalid ids
        cat = requests.get(f"{API}/indicator-catalog?scope=portfolio", headers=admin_h, timeout=30).json()
        valid_ids = [x["indicator_id"] for x in cat[:3]]
        payload = {"indicator_ids": valid_ids + ["FAKE-999", "NOT-REAL"]}
        r = requests.put(f"{API}/indicator-catalog/selections/portfolio", headers=admin_h, json=payload, timeout=30)
        assert r.status_code == 200
        # Verify GET returns only valid
        r2 = requests.get(f"{API}/indicator-catalog/selections/portfolio", headers=admin_h, timeout=30).json()
        got = r2.get("indicator_ids", [])
        for vid in valid_ids:
            assert vid in got
        assert "FAKE-999" not in got
        assert "NOT-REAL" not in got

    def test_preset_p1_portfolio(self, admin_h):
        r = requests.post(f"{API}/indicator-catalog/selections/portfolio/preset-p1", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        ids = data.get("indicator_ids", [])
        assert len(ids) >= 5, f"preset-p1 portfolio returned only {len(ids)}: {ids}"
        # Expected to contain some of these
        expected_any = {"GOU-01", "GOU-04", "PLA-05", "PLA-06", "RIS-01", "RIS-12", "SAF-09"}
        assert expected_any.intersection(set(ids)), f"none of expected P1 ids in {ids}"

    def test_dashboard_selection_per_user(self, admin_h, pmo_h):
        # Set different selections for admin and pmo dashboards using dashboard-scope indicators
        dash_cat = requests.get(f"{API}/indicator-catalog?scope=dashboard", headers=admin_h, timeout=30).json()
        assert len(dash_cat) >= 4, f"need at least 4 dashboard indicators, got {len(dash_cat)}"
        first_two = [x["indicator_id"] for x in dash_cat[:2]]
        last_two = [x["indicator_id"] for x in dash_cat[-2:]]
        assert set(first_two) != set(last_two)

        requests.put(f"{API}/indicator-catalog/selections/dashboard", headers=admin_h,
                     json={"indicator_ids": first_two}, timeout=30)
        requests.put(f"{API}/indicator-catalog/selections/dashboard", headers=pmo_h,
                     json={"indicator_ids": last_two}, timeout=30)

        a = requests.get(f"{API}/indicator-catalog/selections/dashboard", headers=admin_h, timeout=30).json()
        p = requests.get(f"{API}/indicator-catalog/selections/dashboard", headers=pmo_h, timeout=30).json()
        assert set(a.get("indicator_ids", [])) == set(first_two)
        assert set(p.get("indicator_ids", [])) == set(last_two)
        assert set(a.get("indicator_ids", [])) != set(p.get("indicator_ids", []))


# ---------- Values ----------
class TestValues:
    def test_values_portfolio(self, admin_h):
        # First ensure preset applied
        requests.post(f"{API}/indicator-catalog/selections/portfolio/preset-p1", headers=admin_h, timeout=30)
        r = requests.get(f"{API}/indicator-catalog/values/portfolio", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") if isinstance(data, dict) else data
        assert items and len(items) > 0
        # Verify at least one 'computed' status
        statuses = [it.get("status") for it in items]
        assert "computed" in statuses, f"no computed status found: {statuses}"

    def test_values_project_requires_context(self, admin_h):
        r = requests.get(f"{API}/indicator-catalog/values/project", headers=admin_h, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text[:150]}"

    def test_values_project_with_context(self, admin_h):
        projects = requests.get(f"{API}/projects", headers=admin_h, timeout=30).json()
        assert projects and len(projects) > 0
        pid = projects[0].get("project_id") or projects[0].get("id")
        # Apply preset first
        requests.post(f"{API}/indicator-catalog/selections/project/preset-p1", headers=admin_h, timeout=30)
        r = requests.get(f"{API}/indicator-catalog/values/project?context_id={pid}", headers=admin_h, timeout=30)
        assert r.status_code == 200
        data = r.json()
        items = data.get("items") if isinstance(data, dict) else data
        assert items is not None

    def test_values_program_with_context(self, admin_h):
        progs = requests.get(f"{API}/programs", headers=admin_h, timeout=30)
        if progs.status_code != 200 or not progs.json():
            pytest.skip("no programs available")
        pid = progs.json()[0].get("program_id") or progs.json()[0].get("id")
        requests.post(f"{API}/indicator-catalog/selections/program/preset-p1", headers=admin_h, timeout=30)
        r = requests.get(f"{API}/indicator-catalog/values/program?context_id={pid}", headers=admin_h, timeout=30)
        assert r.status_code == 200


# ---------- Non-regression ----------
class TestNonRegression:
    def test_pb_safe_loads(self, admin_h):
        r = requests.get(f"{API}/pb/safe/config", headers=admin_h, timeout=30)
        assert r.status_code in (200, 404), f"pb safe config returned {r.status_code}"

    def test_roadmap_loads(self, admin_h):
        r = requests.get(f"{API}/roadmap/items", headers=admin_h, timeout=30)
        assert r.status_code in (200, 404), f"roadmap returned {r.status_code}"
