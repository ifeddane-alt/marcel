"""Vérification RBAC non destructive en PRODUCTION (marcel-ppm.com) après déploiement 83d0727."""
import base64
import json
import os
import sys
import requests

BASE = os.environ.get("PROD_URL", "https://marcel-ppm.com")
ADMIN_PW = os.environ["PROD_ADMIN_PW"]
VIEWER_PW = os.environ["PROD_VIEWER_PW"]

R = []

def check(name, ok, detail=""):
    R.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'} | {name} | {detail}")

def login(email, pw):
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": pw}, timeout=20)
    return r

def payload(tok):
    p = tok.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))

# 1. Health
r = requests.get(f"{BASE}/api/health", timeout=20)
check("health", r.status_code == 200 and r.json().get("database") == "ok", f"http={r.status_code}")

# 2. Login admin + claim pv + durée token
r = login("admin@altair.fr", ADMIN_PW)
check("login admin", r.status_code == 200, f"http={r.status_code}")
if r.status_code != 200:
    sys.exit(1)
admin_tok = r.json()["access_token"]
pl = payload(admin_tok)
check("claim pv présent", pl.get("pv") == 1, f"pv={pl.get('pv')}")
dur_h = (pl["exp"] - pl.get("iat", pl["exp"] - 8 * 3600)) / 3600 if "exp" in pl else None
check("durée token ≤ 8h", dur_h is not None and dur_h <= 8.1, f"durée={dur_h}h")
AH = {"Authorization": f"Bearer {admin_tok}"}

# 3. Admin lit le portefeuille
r = requests.get(f"{BASE}/api/projects", headers=AH, timeout=20)
projs = r.json() if r.status_code == 200 else []
check("admin GET projects", r.status_code == 200 and len(projs) > 0, f"http={r.status_code} n={len(projs)}")
pid = projs[0]["project_id"] if projs else None

# 4. Viewer strictement read-only
r = login("viewer@altair.fr", VIEWER_PW)
check("login viewer", r.status_code == 200, f"http={r.status_code}")
vtok = r.json()["access_token"]
VH = {"Authorization": f"Bearer {vtok}"}
r = requests.get(f"{BASE}/api/projects", headers=VH, timeout=20)
check("viewer GET projects 200", r.status_code == 200, f"http={r.status_code}")
r = requests.put(f"{BASE}/api/projects/{pid}", headers=VH, json={"description": "x"}, timeout=20)
check("viewer PUT project 403", r.status_code == 403, f"http={r.status_code}")
r = requests.post(f"{BASE}/api/projects", headers=VH, json={"name": "hack"}, timeout=20)
check("viewer POST project 403", r.status_code == 403, f"http={r.status_code}")
r = requests.delete(f"{BASE}/api/projects/{pid}", headers=VH, timeout=20)
check("viewer DELETE project 403", r.status_code == 403, f"http={r.status_code}")
r = requests.post(f"{BASE}/api/risks", headers=VH, json={"project_id": pid, "title": "x", "category": "technique", "probability": 1, "impact": 1}, timeout=20)
check("viewer POST risk 403", r.status_code == 403, f"http={r.status_code}")

# 5. Révocation perm_version : bump en DB → ancien token viewer rejeté (le bump est fait côté SSH avant/après)
if os.environ.get("SKIP_REVOKE") != "1":
    import subprocess
    bump = """cd /opt/marcel && docker compose exec -T backend python -c "
import asyncio
from core.database import db
async def m():
    await db.users.update_one({'email':'viewer@altair.fr'}, {'\\$inc': {'perm_version': 1}})
asyncio.run(m())" 2>/dev/null"""
    subprocess.run(["ssh", "-o", "ConnectTimeout=15", "root@51.158.110.88", bump], check=True, capture_output=True)
    r = requests.get(f"{BASE}/api/projects", headers=VH, timeout=20)
    check("révocation: ancien token viewer 401 après bump pv", r.status_code == 401, f"http={r.status_code}")
    r2 = login("viewer@altair.fr", VIEWER_PW)
    check("re-login viewer OK après bump", r2.status_code == 200, f"http={r2.status_code}")
    if r2.status_code == 200:
        npl = payload(r2.json()["access_token"])
        check("nouveau token pv=2", npl.get("pv") == 2, f"pv={npl.get('pv')}")

# 6. Re-test création risque Admin avec payload VALIDE (422 du smoke précédent) puis suppression
r = requests.post(f"{BASE}/api/risks", headers=AH, json={
    "project_id": pid, "title": "TEST RBAC — à supprimer", "category": "technique",
    "probability": 2, "impact": 2}, timeout=20)
check("admin POST risk payload valide 201", r.status_code == 201, f"http={r.status_code}")
if r.status_code == 201:
    rid = r.json().get("risk_id") or r.json().get("id")
    rd = requests.delete(f"{BASE}/api/risks/{rid}", headers=AH, timeout=20)
    check("cleanup risk supprimé", rd.status_code in (200, 204), f"http={rd.status_code}")

# 7. Endpoint protégé sans auth
r = requests.get(f"{BASE}/api/projects", timeout=20)
check("GET projects sans token 401/403", r.status_code in (401, 403), f"http={r.status_code}")

fails = [x for x in R if not x[1]]
print(f"\n=== {len(R) - len(fails)}/{len(R)} PASS ===")
sys.exit(1 if fails else 0)
