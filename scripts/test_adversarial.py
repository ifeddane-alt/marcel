"""Campagne adversariale interne — tentatives de CONTOURNEMENT des protections.
SSRF bypass (local), puis CORS/upload/privilege/forged-JWT contre PROD (non destructif).
"""
import os
import requests

PROD = os.environ.get("PROD_URL", "https://marcel-ppm.com").rstrip("/")
API = PROD + "/api"
ADMIN_PW = os.environ.get("PROD_ADMIN_PW", "Admin2026!")
VIEWER_PW = os.environ.get("PROD_VIEWER_PW", "View1234!")

R = []
def check(n, ok, i=""):
    R.append((n, ok, i)); print(f"{'PASS' if ok else 'FAIL'} | {n} | {i}")

# ── 1. SSRF bypass (local, sans réseau) ───────────────────────────────────────
import sys
sys.path.insert(0, "/app/backend")
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "x")
from core.ssrf import validate_public_url  # noqa: E402

SSRF_MUST_BLOCK = [
    "http://169.254.169.254/latest/meta-data/",   # AWS/GCP metadata
    "http://metadata.google.internal/",           # GCP metadata hostname
    "http://[::1]/",                               # IPv6 loopback
    "http://0x7f000001/",                          # 127.0.0.1 hex
    "http://2130706433/",                          # 127.0.0.1 décimal
    "http://127.0.0.1:27017/",                     # mongo local
    "http://0.0.0.0/",                             # unspecified
    "https://10.0.0.1/",                           # RFC1918
    "https://192.168.1.1/",                        # RFC1918
    "https://172.16.0.1/",                         # RFC1918
    "gopher://127.0.0.1/",                         # schéma interdit
    "file:///etc/passwd",                          # schéma interdit
]
blocked = 0
for u in SSRF_MUST_BLOCK:
    try:
        validate_public_url(u); ok = False
    except (ValueError, Exception):
        ok = True
    blocked += ok
    if not ok:
        print("   SSRF NON bloqué:", u)
check(f"SSRF bypass : {blocked}/{len(SSRF_MUST_BLOCK)} cibles internes bloquées", blocked == len(SSRF_MUST_BLOCK))

# ── tokens ───────────────────────────────────────────────────────────────────
def login(email, pw):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)

at = login("admin@altair.fr", ADMIN_PW).json()["access_token"]
AH = {"Authorization": f"Bearer {at}"}
vt = login("viewer@altair.fr", VIEWER_PW).json()["access_token"]
VH = {"Authorization": f"Bearer {vt}"}

# ── 2. CORS : origine leurre (suffixe) refusée ────────────────────────────────
r = requests.get(f"{API}/health", headers={"Origin": "https://marcel-ppm.com.evil.com"}, timeout=20)
acao = r.headers.get("access-control-allow-origin")
check("CORS : origine leurre marcel-ppm.com.evil.com non autorisée", acao != "https://marcel-ppm.com.evil.com", f"acao={acao}")

# ── 3. Upload bypass : double extension + casse ───────────────────────────────
import io
files = {"file": ("evil.csv.exe", io.BytesIO(b"x,y\n1,2\n"), "text/csv")}
r = requests.post(f"{API}/import/preview", headers=AH, data={"entity": "projects"}, files=files, timeout=20)
check("upload double-extension .csv.exe refusé", r.status_code == 400, f"http={r.status_code}")

# ── 4. Privilege escalation : viewer sur endpoints admin ──────────────────────
for label, path in [("monitoring", "/admin/monitoring"), ("users", "/admin/users"),
                    ("rgpd export", "/admin/rgpd/subject/whatever")]:
    r = requests.get(f"{API}{path}", headers=VH, timeout=20)
    check(f"viewer refusé sur {label} (403)", r.status_code == 403, f"http={r.status_code}")

# viewer tente suppression tenant
r = requests.post(f"{API}/admin/rgpd/tenant/delete", headers=VH, json={"confirm_tenant_id": "x"}, timeout=20)
check("viewer refusé sur tenant-delete (403)", r.status_code == 403, f"http={r.status_code}")

# ── 5. Forged JWT (secret deviné) rejeté ──────────────────────────────────────
import jwt as pyjwt
forged = pyjwt.encode({"user_id": "x", "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                       "email": "admin@altair.fr", "role": "TENANT_ADMIN",
                       "permissions": ["*"], "pv": 1}, "guessed-secret-123", algorithm="HS256")
r = requests.get(f"{API}/admin/monitoring", headers={"Authorization": f"Bearer {forged}"}, timeout=20)
check("JWT forgé (secret deviné) rejeté 401", r.status_code == 401, f"http={r.status_code}")

# ── 6. alg=none forgé rejeté ──────────────────────────────────────────────────
none_tok = pyjwt.encode({"user_id": "x", "role": "TENANT_ADMIN", "permissions": ["*"]}, "", algorithm="none")
r = requests.get(f"{API}/admin/monitoring", headers={"Authorization": f"Bearer {none_tok}"}, timeout=20)
check("JWT alg=none rejeté 401", r.status_code == 401, f"http={r.status_code}")

fails = [x for x in R if not x[1]]
print(f"\n=== {len(R)-len(fails)}/{len(R)} PASS ===")
for n, ok, i in fails:
    print("  FAIL:", n, i)
