#!/usr/bin/env bash
# MARCEL PPM — Sauvegarde MongoDB
set -euo pipefail

INSTALL_DIR="/opt/marcel"
BACKUP_DIR="/var/backups/marcel"
DATE=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"
cd "$INSTALL_DIR"

echo "[$(date)] Démarrage sauvegarde MARCEL..."

# Dump MongoDB
docker compose exec -T mongo mongodump \
  --username marcel \
  --password "$(grep MONGO_INITDB_ROOT_PASSWORD .env | cut -d'=' -f2)" \
  --authenticationDatabase admin \
  --db marcel_db \
  --archive="/tmp/marcel_backup_${DATE}.gz" \
  --gzip

# Copier hors du container
docker compose cp "mongo:/tmp/marcel_backup_${DATE}.gz" "$BACKUP_DIR/"

# Nettoyer les anciennes sauvegardes
find "$BACKUP_DIR" -name "*.gz" -mtime +$KEEP_DAYS -delete

SIZE=$(du -sh "$BACKUP_DIR/marcel_backup_${DATE}.gz" 2>/dev/null | cut -f1)
echo "[$(date)] ✔ Sauvegarde créée : $BACKUP_DIR/marcel_backup_${DATE}.gz ($SIZE)"
echo "[$(date)] Sauvegardes conservées :"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | awk '{print "  "$5, $9}'
