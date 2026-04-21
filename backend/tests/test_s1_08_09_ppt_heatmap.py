"""Tests S1-08 et S1-09 — PPT Consommation + Heatmap"""
import pytest
import httpx
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")
API = BASE_URL + "/api"


def login(email, password):
    r = httpx.post(f"{API}/auth/login", json={"email": email, "password": password})
    r.raise_for_status()
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return login("admin@altair.fr", "Admin1234!")


@pytest.fixture(scope="module")
def viewer_token():
    return login("viewer@altair.fr", "View1234!")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


# ------------------------------------------------------------------ #
# S1-09 — Heatmap capacité équipe × période
# ------------------------------------------------------------------ #

def test_heatmap_default(admin_token):
    r = httpx.get(f"{API}/teams/capacity-heatmap", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 5, f"Attendu ≥5 équipes, obtenu {len(data)}"


def test_heatmap_structure(admin_token):
    r = httpx.get(f"{API}/teams/capacity-heatmap?months=6", headers=auth(admin_token))
    data = r.json()
    assert len(data) > 0
    row = data[0]
    assert "team_name" in row
    assert "capacity_jh_month" in row
    assert "periods" in row
    assert len(row["periods"]) == 7  # months + 1 (start from -1)
    p = row["periods"][0]
    assert "period" in p
    assert "capacity_jh" in p
    assert "allocated_jh" in p
    assert "utilization_pct" in p
    assert "_id" not in row


def test_heatmap_months_3(admin_token):
    r = httpx.get(f"{API}/teams/capacity-heatmap?months=3", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    if data:
        assert len(data[0]["periods"]) == 4  # months + 1


def test_heatmap_months_12(admin_token):
    r = httpx.get(f"{API}/teams/capacity-heatmap?months=12", headers=auth(admin_token))
    assert r.status_code == 200
    data = r.json()
    if data:
        assert len(data[0]["periods"]) == 13


def test_heatmap_has_utilization(admin_token):
    """Au moins une équipe doit avoir des allocations dans la plage."""
    r = httpx.get(f"{API}/teams/capacity-heatmap?months=6", headers=auth(admin_token))
    data = r.json()
    teams_with_alloc = [
        t for t in data
        if any(p.get("allocated_jh", 0) > 0 for p in t.get("periods", []))
    ]
    assert len(teams_with_alloc) >= 1, "Aucune équipe avec des allocations dans la plage"


def test_heatmap_infra_saturation(admin_token):
    """L'équipe Infra est à 100% pour au moins un mois (DevOps 20 JH / capa 20 JH)."""
    r = httpx.get(f"{API}/teams/capacity-heatmap?months=6", headers=auth(admin_token))
    data = r.json()
    infra = next((t for t in data if t["team_name"] == "Infra"), None)
    assert infra is not None
    max_util = max((p.get("utilization_pct", 0) for p in infra["periods"]), default=0)
    assert max_util >= 90, f"Infra devrait être saturée: {max_util}%"


def test_heatmap_viewer(viewer_token):
    """READ_ONLY peut accéder à la heatmap."""
    r = httpx.get(f"{API}/teams/capacity-heatmap?months=6", headers=auth(viewer_token))
    assert r.status_code == 200


def test_heatmap_invalid_months(admin_token):
    r = httpx.get(f"{API}/teams/capacity-heatmap?months=25", headers=auth(admin_token))
    assert r.status_code == 422


# ------------------------------------------------------------------ #
# S1-08 — PPT Export avec bloc consommation équipe
# ------------------------------------------------------------------ #

def test_ppt_export_with_team_consumption(admin_token):
    """L'export PPT doit générer un fichier valide avec les slides consommation."""
    # Récupérer les IDs des 3 premiers projets
    projects_r = httpx.get(f"{API}/projects", headers=auth(admin_token))
    project_ids = [p["project_id"] for p in projects_r.json()[:2]]

    r = httpx.post(f"{API}/export/copil", json={
        "project_ids": project_ids,
        "instance_name": "Test S1-08",
        "instance_date": "2026-02-15",
    }, headers=auth(admin_token), timeout=30)

    assert r.status_code == 200
    assert "application/vnd" in r.headers.get("content-type", "") or len(r.content) > 10000
    assert len(r.content) > 20000, f"Fichier PPT trop petit: {len(r.content)} bytes"

    # Vérifier que c'est un vrai fichier PPTX (magic bytes)
    assert r.content[:2] == b'PK', "Le fichier n'est pas un ZIP/PPTX valide"


def test_ppt_export_slide_count(admin_token):
    """Vérifier le nombre de slides: standard + (fiche + consommation) × nb projets."""
    from pptx import Presentation
    import io

    projects_r = httpx.get(f"{API}/projects", headers=auth(admin_token))
    project_ids = [p["project_id"] for p in projects_r.json()[:3]]

    r = httpx.post(f"{API}/export/copil", json={
        "project_ids": project_ids,
        "instance_name": "Test Slide Count",
        "instance_date": "2026-02-15",
    }, headers=auth(admin_token), timeout=30)

    prs = Presentation(io.BytesIO(r.content))
    n_slides = len(prs.slides)
    # Attendu: garde(1) + sommaire(1) + heatmap(1) + top_risks(1) + decisions(1) + 3 fiches + 3 consommation = 11
    assert n_slides >= 8, f"Attendu ≥8 slides, obtenu {n_slides}"
    # Les slides consommation doublent le nombre de slides projet
    assert n_slides == 5 + len(project_ids) * 2, f"Attendu {5 + len(project_ids)*2}, obtenu {n_slides}"
