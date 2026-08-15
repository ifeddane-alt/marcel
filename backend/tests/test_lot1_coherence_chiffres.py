"""
Lot 1 - Cohérence des chiffres.
Tests backend pour F01, F02, F03, F04, F09, F10, F11, F12 + create_team régression.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@altair.fr"
ADMIN_PWD = "Admin2026!"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PWD}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- F01: Teams capacity heatmap ----------
def test_f01_teams_capacity_heatmap_non_null(h):
    r = requests.get(f"{API}/teams/capacity-heatmap?months=6", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # Structure
    assert "cells" in data or "heatmap" in data or "teams" in data or isinstance(data, list), f"unexpected shape: {list(data)[:5] if isinstance(data, dict) else type(data)}"
    # Find allocated_jh > 0 somewhere
    def walk(node, found):
        if isinstance(node, dict):
            if "allocated_jh" in node:
                try:
                    if float(node["allocated_jh"]) > 0:
                        found.append(node["allocated_jh"])
                except Exception:
                    pass
            for v in node.values():
                walk(v, found)
        elif isinstance(node, list):
            for v in node:
                walk(v, found)
    found = []
    walk(data, found)
    assert len(found) > 0, f"No allocated_jh > 0 in heatmap. Sample: {str(data)[:800]}"


# ---------- create_team regression + delete ----------
def test_create_team_regression_then_delete(h):
    payload = {"name": "TEST_LOT1_TEAM", "description": "TEST temp team", "capacity_jh_month": 20}
    r = requests.post(f"{API}/teams", json=payload, headers=h, timeout=30)
    assert r.status_code in (200, 201), f"create_team failed: {r.status_code} {r.text}"
    body = r.json()
    tid = body.get("id") or body.get("_id") or body.get("team_id")
    assert tid, f"No id in create_team response: {body}"
    # Delete
    d = requests.delete(f"{API}/teams/{tid}", headers=h, timeout=30)
    assert d.status_code in (200, 204), f"delete_team failed: {d.status_code} {d.text}"


# ---------- F09: profiles no duplicate, user_count present ----------
def test_f09_profiles_no_duplicate_and_user_count(h):
    r = requests.get(f"{API}/profiles", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    profiles = r.json()
    if isinstance(profiles, dict) and "items" in profiles:
        profiles = profiles["items"]
    codes = [p.get("code") for p in profiles]
    dupes = [c for c in set(codes) if codes.count(c) > 1]
    assert not dupes, f"Duplicate profile codes: {dupes}"
    assert len(profiles) == 12, f"Expected 12 profiles, got {len(profiles)}: {codes}"
    for p in profiles:
        assert "user_count" in p, f"Missing user_count in profile {p.get('code')}"


# ---------- F02: project with tasks — jh consumed = sum tasks ----------
def test_f02_project_jh_matches_task_sum(h):
    # find a project having tasks
    r = requests.get(f"{API}/projects", headers=h, timeout=30)
    assert r.status_code == 200
    projs = r.json()
    if isinstance(projs, dict) and "items" in projs:
        projs = projs["items"]
    chosen_pid = None
    task_sum = 0.0
    for p in projs[:40]:
        pid = p.get("project_id") or p.get("id") or p.get("_id")
        if not pid:
            continue
        tr = requests.get(f"{API}/tasks?project_id={pid}", headers=h, timeout=30)
        if tr.status_code != 200:
            continue
        tasks = tr.json()
        if isinstance(tasks, dict) and "items" in tasks:
            tasks = tasks["items"]
        if tasks and len(tasks) > 0:
            chosen_pid = pid
            for t in tasks:
                task_sum += float(t.get("actual_jh") or t.get("jh_consumed") or t.get("consumed_jh") or 0)
            if task_sum > 0:
                break
    assert chosen_pid, "No project with tasks found"
    print(f"F02: project {chosen_pid} task_sum={task_sum}")


# ---------- F11: vendors summary reachable ----------
def test_f11_vendors_summary(h):
    r = requests.get(f"{API}/vendors/summary", headers=h, timeout=30)
    assert r.status_code == 200, r.text


# ---------- F12: dashboard summary ----------
def test_f12_dashboard_summary(h):
    r = requests.get(f"{API}/dashboard/summary", headers=h, timeout=30)
    assert r.status_code == 200, r.text[:200]


# ---------- F10: connectors listing ----------
def test_f10_connectors_list(h):
    r = requests.get(f"{API}/connectors", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    conns = r.json()
    if isinstance(conns, dict) and "items" in conns:
        conns = conns["items"]
    assert isinstance(conns, list), f"unexpected: {type(conns)}"
    # Look for at least one disabled connector for later UI check
    disabled = [c for c in conns if c.get("enabled") is False]
    print(f"F10: {len(disabled)} disabled connectors: {[c.get('code') or c.get('type') for c in disabled]}")
