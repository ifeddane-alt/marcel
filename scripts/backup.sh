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

# Dump MongoDB (mongo sans auth, interne au reseau Docker) -> archive gzip dans le container
docker compose exec -T mongo mongodump \
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
