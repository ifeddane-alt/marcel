#!/usr/bin/env bash
# MARCEL PPM — Test de restauration d'une sauvegarde chiffrée dans une DB scratch.
# NON DESTRUCTIF : restaure dans $SCRATCH_DB puis compare les comptes et supprime la scratch.
set -euo pipefail

INSTALL_DIR="/opt/marcel"
BACKUP_DIR="/var/backups/marcel"
KEY_FILE="${BACKUP_KEY_FILE:-/opt/marcel/secrets/backup.key}"
SCRATCH_DB="marcel_restore_test"
SRC_DB="$(grep -E '^DB_NAME=' "$INSTALL_DIR/.env" | cut -d'=' -f2 | tr -d '"')"
SRC_DB="${SRC_DB:-marcel_db}"
cd "$INSTALL_DIR"

# Auth Mongo optionnelle (activée si MONGO_ROOT_USERNAME présent dans le .env)
MUSER="$(grep -E '^MONGO_ROOT_USERNAME=' "$INSTALL_DIR/.env" | cut -d'=' -f2- | tr -d '"')"
MPASS="$(grep -E '^MONGO_ROOT_PASSWORD=' "$INSTALL_DIR/.env" | cut -d'=' -f2- | tr -d '"')"
AUTH_ARGS=""
[ -n "$MUSER" ] && AUTH_ARGS="-u $MUSER -p $MPASS --authenticationDatabase admin"

LATEST="$(ls -t "$BACKUP_DIR"/*.gz.enc 2>/dev/null | head -1)"
[ -z "$LATEST" ] && { echo "Aucune sauvegarde chiffree trouvee dans $BACKUP_DIR"; exit 1; }
echo "[restore-test] Sauvegarde utilisee : $LATEST"

# Dechiffrer
TMP=$(mktemp /tmp/marcel_restore_XXXX.gz)
openssl enc -d -aes-256-cbc -pbkdf2 -pass "file:${KEY_FILE}" -in "$LATEST" -out "$TMP"

# Copier dans le container et restaurer dans la DB scratch (renommage via nsFrom/nsTo)
docker compose cp "$TMP" mongo:/tmp/restore_test.gz >/dev/null
docker compose exec -T mongo mongorestore $AUTH_ARGS \
  --gzip --archive=/tmp/restore_test.gz \
  --nsFrom="${SRC_DB}.*" --nsTo="${SCRATCH_DB}.*" \
  --drop >/dev/null 2>&1
docker compose exec -T mongo rm -f /tmp/restore_test.gz || true
rm -f "$TMP"

# Comparer quelques comptes cle
echo "[restore-test] Comparaison des comptes (source vs restauree) :"
docker compose exec -T mongo mongosh --quiet $AUTH_ARGS --eval "
const cols=['projects','users','tenants','risks','tasks'];
const a=db.getSiblingDB('${SRC_DB}'); const b=db.getSiblingDB('${SCRATCH_DB}');
let ok=true;
cols.forEach(c=>{const x=a[c].countDocuments(),y=b[c].countDocuments();const m=(x===y)?'OK':'MISMATCH';if(x!==y)ok=false;print('  '+c+': src='+x+' restore='+y+' '+m);});
print(ok?'RESTORE_TEST_PASS':'RESTORE_TEST_FAIL');
b.dropDatabase();
print('[restore-test] DB scratch supprimee');
"
