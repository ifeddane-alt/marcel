#!/usr/bin/env bash
# MARCEL PPM — Sauvegarde MongoDB CHIFFRÉE (AES-256) + rétention.
# La clé de chiffrement est lue depuis $BACKUP_KEY_FILE (jamais dans le repo).
set -euo pipefail

INSTALL_DIR="/opt/marcel"
BACKUP_DIR="/var/backups/marcel"
KEY_FILE="${BACKUP_KEY_FILE:-/opt/marcel/secrets/backup.key}"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30
DB_NAME="$(grep -E '^DB_NAME=' "$INSTALL_DIR/.env" | cut -d'=' -f2 | tr -d '"')"
DB_NAME="${DB_NAME:-marcel_db}"

mkdir -p "$BACKUP_DIR"
cd "$INSTALL_DIR"

if [ ! -f "$KEY_FILE" ]; then
  echo "ERREUR : cle de chiffrement absente ($KEY_FILE). Generez-la avec :"
  echo "  install -m 700 -d \$(dirname $KEY_FILE) && openssl rand -base64 48 > $KEY_FILE && chmod 600 $KEY_FILE"
  exit 1
fi

echo "[$(date)] Demarrage sauvegarde MARCEL (db=$DB_NAME)..."

# Auth Mongo optionnelle (activée si MONGO_ROOT_USERNAME présent dans le .env)
MUSER="$(grep -E '^MONGO_ROOT_USERNAME=' "$INSTALL_DIR/.env" | cut -d'=' -f2- | tr -d '"')"
MPASS="$(grep -E '^MONGO_ROOT_PASSWORD=' "$INSTALL_DIR/.env" | cut -d'=' -f2- | tr -d '"')"
AUTH_ARGS=""
[ -n "$MUSER" ] && AUTH_ARGS="-u $MUSER -p $MPASS --authenticationDatabase admin"

# Credentials S3 hors repo (optionnel)
if [ -f /opt/marcel/secrets/s3.env ]; then
  . /opt/marcel/secrets/s3.env
  export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
fi

# Dump MongoDB (archive gzip dans le container)
docker compose exec -T mongo mongodump $AUTH_ARGS \
  --db "$DB_NAME" \
  --archive="/tmp/marcel_backup_${DATE}.gz" \
  --gzip >/dev/null

# Copier hors du container
docker compose cp "mongo:/tmp/marcel_backup_${DATE}.gz" "$BACKUP_DIR/" >/dev/null
docker compose exec -T mongo rm -f "/tmp/marcel_backup_${DATE}.gz" || true

# Chiffrer (AES-256, PBKDF2) puis supprimer le clair
PLAIN="$BACKUP_DIR/marcel_backup_${DATE}.gz"
ENC="${PLAIN}.enc"
openssl enc -aes-256-cbc -salt -pbkdf2 -pass "file:${KEY_FILE}" -in "$PLAIN" -out "$ENC"
rm -f "$PLAIN"

# Retention
find "$BACKUP_DIR" -name "*.gz.enc" -mtime +$KEEP_DAYS -delete

SIZE=$(du -sh "$ENC" 2>/dev/null | cut -f1)
echo "[$(date)] OK Sauvegarde chiffree : $ENC ($SIZE)"
ls -lh "$BACKUP_DIR"/*.gz.enc 2>/dev/null | awk '{print "  "$5, $9}'

# Consigner le statut en base (visible par l'API de monitoring)
ISO=$(date -u +%Y-%m-%dT%H:%M:%S+00:00)
OFFSITE="none"

# ── Upload off-site S3-compatible (OPTIONNEL, activé si configuré) ────────────
# Le fichier est DÉJÀ chiffré (AES-256) avant tout upload. Credentials hors repo.
# Requiert : S3_BACKUP_BUCKET (+ AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY dans l'env),
# optionnel S3_ENDPOINT_URL (ex. Scaleway https://s3.fr-par.scw.cloud).
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    EP_ARG=""
    [ -n "${S3_ENDPOINT_URL:-}" ] && EP_ARG="--endpoint-url ${S3_ENDPOINT_URL}"
    if aws s3 cp "$ENC" "s3://${S3_BACKUP_BUCKET}/$(basename "$ENC")" $EP_ARG >/dev/null 2>&1; then
      # Vérification de présence côté bucket
      if aws s3 ls "s3://${S3_BACKUP_BUCKET}/$(basename "$ENC")" $EP_ARG >/dev/null 2>&1; then
        OFFSITE="ok"
        echo "[$(date)] OK Upload off-site : s3://${S3_BACKUP_BUCKET}/$(basename "$ENC")"
        # Rétention off-site (defaut 90 jours)
        S3_KEEP="${S3_KEEP_DAYS:-90}"
        CUTOFF=$(date -d "-${S3_KEEP} days" +%s)
        aws s3 ls "s3://${S3_BACKUP_BUCKET}/" $EP_ARG 2>/dev/null | while read -r d t _ name; do
          [ -z "${name:-}" ] && continue
          ts=$(date -d "$d $t" +%s 2>/dev/null) || continue
          if [ "$ts" -lt "$CUTOFF" ]; then
            aws s3 rm "s3://${S3_BACKUP_BUCKET}/${name}" $EP_ARG >/dev/null 2>&1 || true
          fi
        done
      else
        OFFSITE="upload_unverified"
        echo "[$(date)] WARN upload off-site non vérifié"
      fi
    else
      OFFSITE="upload_failed"
      echo "[$(date)] WARN échec upload off-site S3"
    fi
  else
    OFFSITE="aws_cli_absent"
    echo "[$(date)] WARN S3_BACKUP_BUCKET défini mais aws CLI absent — upload off-site ignoré"
  fi
fi

docker compose exec -T mongo mongosh --quiet $AUTH_ARGS --eval "
db.getSiblingDB('${DB_NAME}').backup_status.insertOne({
  result:'success', file:'$(basename "$ENC")', size:'${SIZE}',
  offsite:'${OFFSITE}', created_at:'${ISO}'
});" >/dev/null 2>&1 || true
