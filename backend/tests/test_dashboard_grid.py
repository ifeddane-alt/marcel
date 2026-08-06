"""Tests for dashboard grid preferences (layouts + widgets)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-sync-61.preview.emergentagent.com").rstrip("/")

DEFAULT_WIDGETS = [
    "metrics", "budget_detail", "capacity", "regulatory", "envelope",
    "ai_recommendations", "upcoming_milestones", "team_load", "charts",
    "milestones_gauge", "top_projects", "pending_timesheets", "recent_decisions",
    "recent_projects", "top_risks", "heatmap",
]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@altair.fr", "password": "Admin2026!"})
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


def test_get_preferences_shape(hdr):
    r = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr)
    assert r.status_code == 200
    d = r.json()
    assert "widgets" in d and "layouts" in d and "available" in d
    assert len(d["available"]) == 16
    assert set(d["available"]) == set(DEFAULT_WIDGETS)


def test_put_with_layouts_persists(hdr):
    layouts = {"lg": [{"i": "metrics", "x": 0, "y": 0, "w": 6, "h": 4}]}
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": DEFAULT_WIDGETS, "layouts": layouts})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    assert g["layouts"] == layouts


def test_put_without_layouts_preserves(hdr):
    # first set layouts
    layouts = {"lg": [{"i": "charts", "x": 2, "y": 2, "w": 4, "h": 3}]}
    requests.put(f"{BASE_URL}/api/dashboard/preferences",
                 headers=hdr, json={"widgets": DEFAULT_WIDGETS, "layouts": layouts})
    # now PUT with layouts=null
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": DEFAULT_WIDGETS, "layouts": None})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    # existing layouts must not be overwritten
    assert g["layouts"] == layouts


def test_widget_toggle_persists(hdr):
    reduced = [w for w in DEFAULT_WIDGETS if w != "top_risks"]
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": reduced, "layouts": None})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    assert "top_risks" not in g["widgets"]


def test_portfolio_regression(hdr):
    r = requests.get(f"{BASE_URL}/api/portfolio", headers=hdr)
    assert r.status_code in (200, 404)  # accept if endpoint exists


def test_cleanup_restore_defaults(hdr):
    # restore defaults + explicit empty layouts to reset positions
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     headers=hdr, json={"widgets": DEFAULT_WIDGETS, "layouts": {}})
    assert r.status_code == 200
    g = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=hdr).json()
    assert set(g["widgets"]) == set(DEFAULT_WIDGETS)
