"""
Tests — Scope : snapshots, figeage (freeze), transmission CP.
"""
import pytest
import pytest_asyncio
from datetime import date
from conftest import auth

pytestmark = pytest.mark.asyncio


async def _first_project_id(client, token):
    projects = (await client.get("/api/projects", headers=auth(token))).json()
    assert len(projects) > 0
    return projects[0]["project_id"]


# ══════════════════════════════════════════════════════════════════════════════
# 1. Candidats scope
# ══════════════════════════════════════════════════════════════════════════════

async def test_scope_candidates_returns_list(client, admin_token):
    r = await client.get("/api/scope/candidates", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_scope_candidates_unauthenticated(client):
    r = await client.get("/api/scope/candidates")
    assert r.status_code in (401, 403)


async def test_scope_candidates_by_project(client, admin_token):
    pid = await _first_project_id(client, admin_token)
    r = await client.get(f"/api/scope/candidates?project_id={pid}", headers=auth(admin_token))
    assert r.status_code == 200


# ══════════════════════════════════════════════════════════════════════════════
# 2. Snapshots (figeage)
# ══════════════════════════════════════════════════════════════════════════════

async def test_list_snapshots(client, admin_token):
    r = await client.get("/api/scope/snapshots", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_create_snapshot(client, admin_token):
    payload = {
        "name":       "Snapshot Test pytest",
        "snap_type":  "manual",
        "label":      "Test pytest",
        "period_ref": date.today().isoformat(),
    }
    r = await client.post("/api/scope/snapshots", json=payload, headers=auth(admin_token))
    assert r.status_code in (200, 201), r.text
    body = r.json()
    snap_id = body.get("snapshot_id")
    assert snap_id
    r2 = await client.get(f"/api/scope/snapshots/{snap_id}", headers=auth(admin_token))
    assert r2.status_code == 200


async def test_snapshot_not_found(client, admin_token):
    r = await client.get("/api/scope/snapshots/00000000-0000-0000-0000-000000000000",
                         headers=auth(admin_token))
    assert r.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# 3. Tasks scope (Kanban) via candidates
# ══════════════════════════════════════════════════════════════════════════════

async def test_scope_candidates_list(client, admin_token):
    r = await client.get("/api/scope/candidates", headers=auth(admin_token))
    assert r.status_code == 200
    assert isinstance(r.json(), list)


async def test_scope_task_status_update(client, admin_token):
    tasks = (await client.get("/api/scope/candidates", headers=auth(admin_token))).json()
    if not tasks:
        pytest.skip("Aucune tâche scope disponible")
    tid = tasks[0].get("task_id") or tasks[0].get("id")
    current_status = tasks[0].get("scope_status", "propose")
    r = await client.patch(
        f"/api/scope/tasks/{tid}/status",
        json={"scope_status": current_status},
        headers=auth(admin_token),
    )
    assert r.status_code in (200, 404, 422)


# ══════════════════════════════════════════════════════════════════════════════
# 4. Gantt
# ══════════════════════════════════════════════════════════════════════════════

async def test_scope_gantt_compute(client, admin_token):
    pid = await _first_project_id(client, admin_token)
    snaps = (await client.get("/api/scope/snapshots", headers=auth(admin_token))).json()
    if not snaps:
        pytest.skip("Pas de snapshot disponible")
    snap_id = snaps[0]["snapshot_id"]
    r = await client.post(f"/api/scope/snapshots/{snap_id}/gantt-compute",
                          headers=auth(admin_token))
    assert r.status_code in (200, 404)


# ══════════════════════════════════════════════════════════════════════════════
# 5. Isolation multi-tenant
# ══════════════════════════════════════════════════════════════════════════════

async def test_scope_snapshot_isolation(client, admin_token, beta_token):
    altair_snaps = (await client.get("/api/scope/snapshots", headers=auth(admin_token))).json()
    beta_snaps   = (await client.get("/api/scope/snapshots", headers=auth(beta_token))).json()
    altair_ids = {s.get("snapshot_id") for s in altair_snaps}
    beta_ids   = {s.get("snapshot_id") for s in beta_snaps}
    assert altair_ids.isdisjoint(beta_ids)
