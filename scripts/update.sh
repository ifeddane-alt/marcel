#!/usr/bin/env bash
# MARCEL PPM — Mise à jour
set -euo pipefail

INSTALL_DIR="/opt/marcel"
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✔${NC}  $1"; }
info() { echo -e "${CYAN}→${NC}  $1"; }

echo -e "\n${BOLD}MARCEL PPM — Mise à jour${NC}\n"

cd "$INSTALL_DIR"

# Sauvegarde préventive
info "Sauvegarde préventive avant mise à jour..."
/usr/local/bin/marcel-backup && ok "Sauvegarde effectuée"

# Récupérer le code
info "Récupération du code..."
git stash 2>/dev/null || true
git pull origin main
ok "Code mis à jour"

# Rebuild et redémarrage
info "Reconstruction des images (2-3 min)..."
docker compose up -d --build 2>&1 | tail -5
ok "Containers relancés"

# Reload nginx (le conteneur backend change d'IP après rebuild → évite les 502)
sleep 5
docker exec marcel-nginx-http-1 nginx -s reload 2>/dev/null || true
ok "Nginx rechargé"

# Synchro des profils (nouvelles permissions)
sleep 5
info "Synchronisation des permissions..."
docker compose exec -T backend python -c "
import asyncio
from core.database import db
from modules.profiles.service import seed_default_profiles

async def sync():
    tids = await db.tenants.distinct('tenant_id')
    for tid in tids:
        await seed_default_profiles(tid)
    print(f'Permissions synchronisées pour {len(tids)} tenant(s)')

asyncio.run(sync())
" && ok "Permissions à jour" || true

echo -e "\n${GREEN}${BOLD}MARCEL mis à jour avec succès !${NC}"
docker compose ps
