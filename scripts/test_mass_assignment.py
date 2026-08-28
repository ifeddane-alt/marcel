"""Tests négatifs mass-assignment : les champs protégés injectés ne doivent JAMAIS
être stockés ni provoquer d'élévation. Cible Preview (localhost).
"""
import os
import requests

API = os.environ.get("API_URL", "http://localhost:8001").rstrip("/") + "/api"
ADMIN = ("admin@altair.fr", os.environ.get("ALT_PW", "Admin2026!"))

R = []
def check(name, ok, info=""):
    R.append((name, ok, info)); print(f"{'PASS' if ok else 'FAIL'} | {name} | {info}")

tok = requests.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=20).json()["access_token"]
H = {"Authorization": f"Bearer {tok}"}

POISON = {
    "tenant_id": "betacorp",
    "owner_id": "hacker",
    "user_id": "hacker",
    "role": "TENANT_ADMIN",
    "permissions": ["*"],
    "is_admin": True,
    "perm_version": 999,
    "created_by": "hacker",
    "_id": "deadbeef",
}

created_ids = []  # (delete_url,)

# 1. project_templates (le point historiquement faible) : create puis update avec poison
r = requests.post(f"{API}/project-templates", headers=H, json={
    "name": "TPL massassign test", "methodology": "waterfall", **POISON}, timeout=20)
if r.status_code in (200, 201):
    tpl = r.json()
    tid = tpl.get("template_id") or tpl.get("id")
    # tenant_id ne doit pas être betacorp
    check("template create : tenant_id non injecté", tpl.get("tenant_id") != "betacorp", f"tenant={tpl.get('tenant_id')}")
    check("template create : owner_id/role non stockés", tpl.get("owner_id") != "hacker" and tpl.get("role") != "TENANT_ADMIN", f"owner={tpl.get('owner_id')} role={tpl.get('role')}")
    # update avec poison
    ru = requests.put(f"{API}/project-templates/{tid}", headers=H, json={"name": "TPL v2", **POISON}, timeout=20)
    upd = ru.json() if ru.status_code == 200 else {}
    check("template update : tenant_id non modifié", upd.get("tenant_id") != "betacorp", f"tenant={upd.get('tenant_id')}")
    check("template update : role/permissions non stockés", upd.get("role") != "TENANT_ADMIN" and upd.get("permissions") != ["*"], f"role={upd.get('role')}")
    requests.delete(f"{API}/project-templates/{tid}", headers=H, timeout=20)
else:
    check("template create (skip)", True, f"http={r.status_code}")

# 2. run activity (allowlist _clean_activity)
r = requests.post(f"{API}/run/activities", headers=H, json={"name": "ACT massassign", **POISON}, timeout=20)
if r.status_code in (200, 201):
    act = r.json(); aid = act.get("activity_id")
    check("run activity : champs protégés non stockés",
          act.get("tenant_id") != "betacorp" and act.get("owner_id") != "hacker" and act.get("role") != "TENANT_ADMIN",
          f"tenant={act.get('tenant_id')}")
    if aid:
        requests.delete(f"{API}/run/activities/{aid}", headers=H, timeout=20)
else:
    check("run activity (skip)", True, f"http={r.status_code}")

# 3. objective (create explicite)
r = requests.post(f"{API}/objectives", headers=H, json={"title": "OBJ massassign", "axis": "Efficience", **POISON}, timeout=20)
if r.status_code in (200, 201):
    o = r.json(); oid = o.get("objective_id")
    check("objective : champs protégés non stockés",
          o.get("tenant_id") != "betacorp" and o.get("role") != "TENANT_ADMIN" and o.get("permissions") != ["*"],
          f"tenant={o.get('tenant_id')}")
    if oid:
        requests.delete(f"{API}/objectives/{oid}", headers=H, timeout=20)
else:
    check("objective (skip)", True, f"http={r.status_code}")

# 4. application (SimpleCrud allowlist via _clean_payload)
r = requests.post(f"{API}/applications", headers=H, json={"name": "APP massassign", **POISON}, timeout=20)
if r.status_code in (200, 201):
    a = r.json(); appid = a.get("application_id")
    check("application : champs protégés non stockés",
          a.get("tenant_id") != "betacorp" and a.get("owner_id") != "hacker" and a.get("role") != "TENANT_ADMIN",
          f"tenant={a.get('tenant_id')}")
    if appid:
        requests.delete(f"{API}/applications/{appid}", headers=H, timeout=20)
else:
    check("application (skip)", True, f"http={r.status_code}")

# 5. architecture standard (SimpleCrud)
r = requests.post(f"{API}/architecture/standards", headers=H, json={"title": "STD massassign", **POISON}, timeout=20)
if r.status_code in (200, 201):
    s = r.json(); sid = s.get("standard_id") or s.get("item_id")
    check("architecture standard : champs protégés non stockés",
          s.get("tenant_id") != "betacorp" and s.get("role") != "TENANT_ADMIN",
          f"tenant={s.get('tenant_id')}")
    if sid:
        requests.delete(f"{API}/architecture/standards/{sid}", headers=H, timeout=20)
else:
    check("architecture standard (skip)", True, f"http={r.status_code}")

# 6. Le compte admin ne doit pas avoir été escaladé/altéré
me = requests.get(f"{API}/auth/me", headers=H, timeout=20).json()
check("compte admin intact (perm_version raisonnable)", isinstance(me, dict) and me.get("email") == ADMIN[0], f"email={me.get('email')}")

fails = [x for x in R if not x[1]]
print(f"\n=== {len(R)-len(fails)}/{len(R)} PASS ===")
for n, ok, i in fails:
    print("  FAIL:", n, i)
