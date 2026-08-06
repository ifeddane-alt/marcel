"""Tests for dashboard extras, preferences, CxO fusion (iteration 48)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://project-sync-61.preview.emergentagent.com").rstrip("/")

DEFAULT_WIDGETS = [
    "metrics", "budget_detail", "capacity", "regulatory", "envelope",
    "ai_recommendations", "upcoming_milestones", "charts", "milestones_gauge",
    "top_projects", "pending_timesheets", "recent_decisions",
    "recent_projects", "top_risks", "heatmap",
]


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "admin@altair.fr", "password": "Admin2026!"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- extras ---
def test_dashboard_extras(headers):
    r = requests.get(f"{BASE_URL}/api/dashboard/extras", headers=headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "upcoming_milestones" in data
    assert "pending_timesheets" in data
    assert "recent_decisions" in data
    ums = data["upcoming_milestones"]
    assert isinstance(ums, list)
    assert len(ums) <= 15
    if ums:
        m = ums[0]
        for k in ("milestone_id", "name", "project_name", "date_forecast", "days_remaining", "late"):
            assert k in m, f"missing key {k}"
    pt = data["pending_timesheets"]
    assert "count" in pt and "total_jh" in pt and "items" in pt
    assert len(pt["items"]) <= 5
    if pt["items"]:
        assert "resource_name" in pt["items"][0]
    rd = data["recent_decisions"]
    assert isinstance(rd, list) and len(rd) <= 5
    if rd:
        for k in ("title", "status", "project_name"):
            assert k in rd[0]
    print(f"extras: milestones={len(ums)}, pending_count={pt['count']}, decisions={len(rd)}")


# --- preferences ---
def test_get_preferences_default(headers):
    # First reset by putting defaults
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     json={"widgets": DEFAULT_WIDGETS}, headers=headers, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert "widgets" in data and "available" in data
    assert set(data["available"]) == set(DEFAULT_WIDGETS)
    assert len(data["available"]) == 15


def test_put_preferences_persists(headers):
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     json={"widgets": ["metrics", "charts"]}, headers=headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["widgets"] == ["metrics", "charts"]
    r = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=headers, timeout=15)
    assert r.json()["widgets"] == ["metrics", "charts"]


def test_put_preferences_filters_invalid(headers):
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     json={"widgets": ["metrics", "bogus_widget", "charts"]},
                     headers=headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["widgets"] == ["metrics", "charts"]


def test_restore_defaults(headers):
    r = requests.put(f"{BASE_URL}/api/dashboard/preferences",
                     json={"widgets": DEFAULT_WIDGETS}, headers=headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["widgets"] == DEFAULT_WIDGETS
    r = requests.get(f"{BASE_URL}/api/dashboard/preferences", headers=headers, timeout=15)
    assert r.json()["widgets"] == DEFAULT_WIDGETS


# --- regression ---
def test_health():
    r = requests.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200


def test_dashboard_summary(headers):
    r = requests.get(f"{BASE_URL}/api/dashboard/summary", headers=headers, timeout=15)
    assert r.status_code == 200
    assert "total_projects" in r.json()


def test_dashboard_cxo_backward_compat(headers):
    r = requests.get(f"{BASE_URL}/api/dashboard/cxo", headers=headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("kpis", "rag", "budget", "milestones", "top_projects"):
        assert k in d
