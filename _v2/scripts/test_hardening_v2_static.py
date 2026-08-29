"""Static security regression gates for hardening v2. Run from repository root."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def text(path): return (ROOT / path).read_text(encoding="utf-8")

def assert_not(path, needle):
    assert needle not in text(path), f"Forbidden pattern remains in {path}: {needle}"

def assert_has(path, needle):
    assert needle in text(path), f"Expected hardening missing in {path}: {needle}"

traj = text("backend/modules/architecture/trajectory.py")
for route in ("set_disposition", "create_milestone", "update_milestone", "delete_milestone"):
    pos = traj.index(f"def {route}")
    block = traj[pos:pos+500]
    assert 'permission_required("architecture.manage")' in block, route

assert_not("backend/core/auth.py", "logger.warning(\"perm_version check indisponible")
assert_has("backend/core/auth.py", 'status_code=503')
assert_has("backend/modules/connectors/encryption.py", 'ENCRYPTION_KEY manquante ou invalide en production')
assert_has("backend/modules/auth/router.py", 'expires_delta=timedelta(minutes=5)')
assert_has("backend/modules/auth/mfa.py", '@limiter.limit("10/minute")')
assert_has("backend/modules/auth/mfa.py", 'secrets.token_urlsafe(16)')
assert_has("backend/modules/sso/service.py", '_verify_oidc_id_token')
assert_has("backend/modules/sso/service.py", 'jwk.construct')
assert_has("backend/modules/sso/service.py", 'if claims.get("nonce") != st.get("nonce")')
assert_has("backend/modules/public_site/router.py", '@limiter.limit("5/minute")')
assert_has("backend/modules/public_site/router.py", 'html.escape')
assert_has("docker-compose.yml", 'MONGO_INITDB_ROOT_PASSWORD')
assert_has("backend/modules/demands/router.py", 'permission_required("admin.config")')

# Generic DSI CRUD must be explicit-permission based, never role based.
sc = text("backend/core/simple_crud.py")
assert 'user.role not in' not in sc
assert 'write_permission' in sc

print("HARDENING_V2_STATIC_GATE=PASS")
