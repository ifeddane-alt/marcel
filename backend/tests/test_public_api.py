"""API publique v1 — tests : auth par token, scopes, rate-limit, isolation tenant,
pagination/tri/filtres, audit, lecture seule (aucune écriture), non-régression interne."""
import os
import time

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

frontend_env = dotenv_values("/app/frontend/.env")
backend_env = dotenv_values("/app/backend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    pytest.skip("REACT_APP_BACKEND_URL indisponible (test d'intégration)", allow_module_level=True)
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL") or backend_env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or backend_env.get("DB_NAME")


def _admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": "admin@altair.fr", "password": "Admin2026!"}, timeout=30)
    assert r.status_code == 200, f"admin login: {r.status_code} {r.text[:200]}"
    return r.json()["access_token"]


def _create_token(admin_jwt, scopes, rate=1000):
    r = requests.post(f"{API}/admin/api-tokens", headers={"Authorization": f"Bearer {admin_jwt}"},
                      json={"name": "pytest", "scopes": scopes, "rate_limit_per_min": rate}, timeout=30)
    assert r.status_code == 201, f"create token: {r.status_code} {r.text[:200]}"
    return r.json()


@pytest.fixture(scope="module")
def ctx():
    admin = _admin_token()
    functional = _create_token(admin, ["projects.read", "risks.read", "portfolio.read"], rate=1000)
    return {"admin": admin, "functional": functional}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


def test_valid_token_scope_200(ctx):
    r = requests.get(f"{API}/v1/projects", headers=_h(ctx["functional"]["token"]), timeout=30)
    assert r.status_code == 200, r.text[:200]
    body = r.json()
    assert "data" in body and "pagination" in body
    assert isinstance(body["data"], list)


def test_valid_token_missing_scope_403(ctx):
    # token n'a pas programs.read
    r = requests.get(f"{API}/v1/programs", headers=_h(ctx["functional"]["token"]), timeout=30)
    assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text[:200]}"


def test_invalid_token_401():
    r = requests.get(f"{API}/v1/projects", headers=_h("mrcl_live_deadbeefdeadbeef"), timeout=30)
    assert r.status_code == 401


def test_no_token_401():
    r = requests.get(f"{API}/v1/projects", timeout=30)
    assert r.status_code == 401


def test_revoked_token_401(ctx):
    t = _create_token(ctx["admin"], ["projects.read"])
    # marche avant révocation
    assert requests.get(f"{API}/v1/projects", headers=_h(t["token"]), timeout=30).status_code == 200
    rv = requests.delete(f"{API}/admin/api-tokens/{t['token_id']}", headers=_h(ctx["admin"]), timeout=30)
    assert rv.status_code == 200
    r = requests.get(f"{API}/v1/projects", headers=_h(t["token"]), timeout=30)
    assert r.status_code == 401, f"revoked token should be 401, got {r.status_code}"


def test_cross_tenant_isolation(ctx):
    h = _h(ctx["functional"]["token"])
    base = requests.get(f"{API}/v1/projects?limit=5", headers=h, timeout=30).json()["pagination"]["total"]
    # injecter un tenant_id ne doit rien changer (tenant dérivé du token)
    inj = requests.get(f"{API}/v1/projects?limit=5&tenant_id=someone-else", headers=h, timeout=30)
    assert inj.status_code == 200
    assert inj.json()["pagination"]["total"] == base


def test_pagination(ctx):
    h = _h(ctx["functional"]["token"])
    r = requests.get(f"{API}/v1/projects?page=1&limit=2", headers=h, timeout=30).json()
    assert r["pagination"]["limit"] == 2
    assert len(r["data"]) <= 2
    r2 = requests.get(f"{API}/v1/projects?page=2&limit=2", headers=h, timeout=30).json()
    assert r2["pagination"]["page"] == 2


def test_filter(ctx):
    h = _h(ctx["functional"]["token"])
    r = requests.get(f"{API}/v1/projects?status=actif&limit=20", headers=h, timeout=30).json()
    assert all(p.get("status") == "actif" for p in r["data"])


def test_sort(ctx):
    h = _h(ctx["functional"]["token"])
    r = requests.get(f"{API}/v1/projects?sort=-business_value&limit=10", headers=h, timeout=30).json()
    vals = [p.get("business_value") or 0 for p in r["data"]]
    assert vals == sorted(vals, reverse=True)


def test_rate_limit_429(ctx):
    t = _create_token(ctx["admin"], ["projects.read"], rate=3)
    codes = [requests.get(f"{API}/v1/projects", headers=_h(t["token"]), timeout=30).status_code for _ in range(6)]
    assert 429 in codes, f"expected a 429 within burst, got {codes}"


def test_no_write_routes_under_v1(ctx):
    h = _h(ctx["functional"]["token"])
    for method in ("post", "put", "patch", "delete"):
        r = getattr(requests, method)(f"{API}/v1/projects", headers=h, json={}, timeout=30)
        assert r.status_code in (404, 405), f"{method} /v1/projects should not exist, got {r.status_code}"


def test_internal_api_not_regressed(ctx):
    # les endpoints internes existants restent fonctionnels avec un JWT
    r = requests.get(f"{API}/projects", headers=_h(ctx["admin"]), timeout=30)
    assert r.status_code == 200


@pytest.mark.skipif(not MONGO_URL, reason="MONGO_URL indisponible")
def test_audit_log_created(ctx):
    # déclenche un appel puis vérifie l'audit
    requests.get(f"{API}/v1/projects", headers=_h(ctx["functional"]["token"]), timeout=30)
    time.sleep(1)
    cli = MongoClient(MONGO_URL)
    n = cli[DB_NAME].api_audit_logs.count_documents({"path": "/api/v1/projects"})
    cli.close()
    assert n > 0, "aucun audit log créé pour /api/v1/projects"


def test_capacity_and_portfolio_endpoints(ctx):
    # portfolio.read accordé au token fonctionnel
    r = requests.get(f"{API}/v1/portfolio", headers=_h(ctx["functional"]["token"]), timeout=30)
    assert r.status_code == 200 and "data" in r.json()
    # capacity.read NON accordé -> 403
    rc = requests.get(f"{API}/v1/capacity", headers=_h(ctx["functional"]["token"]), timeout=30)
    assert rc.status_code == 403
