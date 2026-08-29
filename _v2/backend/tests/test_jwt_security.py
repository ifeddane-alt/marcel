"""Tests de non-régression sécurité JWT — Phase 1 P0."""
import os, sys, subprocess, importlib
from datetime import datetime, timezone, timedelta

BACKEND = "/app/backend"
results = []
def check(name, cond, info=""):
    results.append((name, cond)); print(("PASS" if cond else "FAIL"), name, info)

def run_import(env_extra):
    """Tente d'importer core.auth dans un sous-process avec un env donné. Retourne (rc, stderr)."""
    env = dict(os.environ); env.update(env_extra); env["PYTHONPATH"] = BACKEND
    code = "import core.auth; print('IMPORT_OK', len(core.auth.JWT_SECRET))"
    p = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=env,
                       capture_output=True, text=True)
    return p.returncode, (p.stdout + p.stderr)

# 1. Secret absent → refuse de démarrer
rc, out = run_import({"JWT_SECRET": ""})
check("secret absent → import échoue", rc != 0 and "JWT_SECRET manquant" in out, out.strip().splitlines()[-1] if out else "")

# 2. Secret trop court → refuse
rc, out = run_import({"JWT_SECRET": "tooshort"})
check("secret <32 → import échoue", rc != 0 and "trop court" in out)

# 3. Secret par défaut compromis → refuse
rc, out = run_import({"JWT_SECRET": "projetenne-secret-key-2025-altair"})
check("secret compromis connu → import échoue", rc != 0 and "compromise" in out)

# 4. Secret valide → OK
rc, out = run_import({"JWT_SECRET": "x" * 40})
check("secret valide ≥32 → import OK", rc == 0 and "IMPORT_OK" in out)

# 5-8. Vérifs de décodage avec un vrai secret chargé
os.environ["JWT_SECRET"] = "a" * 48
sys.path.insert(0, BACKEND)
import core.auth as auth
importlib.reload(auth)
from jose import jwt

valid = auth.create_token({"tenant_id": "t1", "user_id": "u1", "email": "a@b.fr", "role": "X", "name": "N"})
# token valide accepté
try:
    p = auth.decode_token(valid); check("token valide → accepté", p.tenant_id == "t1")
except Exception as e:
    check("token valide → accepté", False, str(e))

# token signé avec ANCIEN secret → rejeté
old = jwt.encode({"tenant_id": "t1", "user_id": "u1", "email": "a@b.fr", "role": "X", "name": "N",
                  "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
                 "projetenne-secret-key-2025-altair", algorithm="HS256")
try:
    auth.decode_token(old); check("token ancien secret → rejeté", False)
except ValueError:
    check("token ancien secret → rejeté", True)

# token falsifié (payload modifié) → rejeté
tampered = valid[:-4] + ("AAAA" if valid[-4:] != "AAAA" else "BBBB")
try:
    auth.decode_token(tampered); check("token falsifié → rejeté", False)
except ValueError:
    check("token falsifié → rejeté", True)

# token expiré → rejeté
expired = jwt.encode({"tenant_id": "t1", "user_id": "u1", "email": "a@b.fr", "role": "X", "name": "N",
                      "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
                     auth.JWT_SECRET, algorithm="HS256")
try:
    auth.decode_token(expired); check("token expiré → rejeté", False)
except ValueError:
    check("token expiré → rejeté", True)

fails = [x for x in results if not x[1]]
print(f"\n{len(results)-len(fails)}/{len(results)} PASS")
sys.exit(1 if fails else 0)
