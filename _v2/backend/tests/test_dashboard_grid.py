"""Tests for dashboard grid preferences with 22 individual blocks (post iter-50 refactor)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

DEFAULT_WIDGETS_22 = [
    "metric_projects", "metric_green", "metric_at_risk", "metric_budget",
    "budget_consumed", "budget_forecast", "jh_progress",
    "capacity", "regulatory", "envelope", "ai_recommendations",
    "upcoming_milestones", "team_load", "chart_budget", "chart_rag",
    "milestones_gauge", "top_projects", "pending_timesheets", "recent_decisions",
    "recent_projects", "top_risks", "heatmap",
]

LEGACY_WIDGETS = ["metrics", "budget_detail", "charts", "heatmap"]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@altair.fr", "password": "Admin2026!"})
    assert r.status_code == 200, r.text
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok
    return tok


@pytest.fixture(scope="module")
def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_health():
    r = requests.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200


def test_login_returns_access_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@altair.fr", "password": "Admin2026!"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_available_has_22_ids(hdr):
    r = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr)
    assert r.status_code == 200
    d = r.json()
    assert "widgets" in d and "layouts" in d and "available" in d
    assert len(d["available"]) == 22, f"Expected 22 available ids, got {len(d['available'])}: {d['available']}"
    assert set(d["available"]) == set(DEFAULT_WIDGETS_22)


def test_put_22_widgets_persists(hdr):
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": DEFAULT_WIDGETS_22, "layouts": None})
    assert r.status_code == 200
    body = r.json()
    assert set(body["widgets"]) == set(DEFAULT_WIDGETS_22)
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    assert set(g["widgets"]) == set(DEFAULT_WIDGETS_22)


def test_put_with_layouts_persists(hdr):
    layouts = {"lg": [{"i": "metric_budget", "x": 0, "y": 0, "w": 3, "h": 2}]}
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": DEFAULT_WIDGETS_22, "layouts": layouts})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    assert g["layouts"] == layouts


def test_put_legacy_widgets_are_filtered_out(hdr):
    """Backend filters out unknown ids ('metrics', 'budget_detail', 'charts').
    Only 'heatmap' should remain since it's a valid id in the new schema."""
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": LEGACY_WIDGETS, "layouts": None})
    assert r.status_code == 200
    body = r.json()
    # Legacy composite ids MUST be filtered out (not in DEFAULT_WIDGETS_22)
    assert "metrics" not in body["widgets"]
    assert "budget_detail" not in body["widgets"]
    assert "charts" not in body["widgets"]
    # Heatmap survives
    assert "heatmap" in body["widgets"]


def test_hide_single_block_persists(hdr):
    reduced = [w for w in DEFAULT_WIDGETS_22 if w != "metric_green"]
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": reduced, "layouts": None})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    assert "metric_green" not in g["widgets"]
    assert len(g["widgets"]) == 21


def test_cleanup_restore_22_defaults(hdr):
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": DEFAULT_WIDGETS_22, "layouts": {}})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    assert set(g["widgets"]) == set(DEFAULT_WIDGETS_22)
