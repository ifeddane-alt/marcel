#!/usr/bin/env bash
# MARCEL PPM — Statut des services
INSTALL_DIR="/opt/marcel"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "\n${BOLD}MARCEL PPM — Statut${NC}  $(date)\n"

cd "$INSTALL_DIR"

# Containers
echo -e "${BOLD}Containers :${NC}"
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null

# API health
echo -e "\n${BOLD}API Backend :${NC}"
if curl -sf http://localhost:8001/api/health &>/dev/null; then
  echo -e "  ${GREEN}✔ Backend opérationnel${NC}"
else
  echo -e "  ${RED}✖ Backend ne répond pas${NC}"
fi

# Disque
echo -e "\n${BOLD}Disque :${NC}"
df -h / | awk 'NR==2{printf "  Utilisé: %s / %s (%s)\n", $3, $2, $5}'

# Mémoire
echo -e "\n${BOLD}Mémoire :${NC}"
free -h | awk 'NR==2{printf "  Utilisée: %s / %s\n", $3, $2}'

# MongoDB
echo -e "\n${BOLD}Base de données :${NC}"
MONGO_PASS=$(grep MONGO_INITDB_ROOT_PASSWORD .env 2>/dev/null | cut -d'=' -f2)
COUNT=$(docker compose exec -T mongo mongosh \
  -u marcel -p "$MONGO_PASS" --authenticationDatabase admin \
  --quiet --eval "db.getSiblingDB('marcel_db').projects.countDocuments()" 2>/dev/null || echo "?")
echo -e "  Projets en base : ${CYAN}$COUNT${NC}"

# Sauvegardes
echo -e "\n${BOLD}Dernière sauvegarde :${NC}"
LAST=$(ls -t /var/backups/marcel/*.gz 2>/dev/null | head -1)
if [[ -n "$LAST" ]]; then
  echo -e "  ${GREEN}$(basename $LAST)${NC} — $(du -sh $LAST | cut -f1)"
else
  echo -e "  ${YELLOW}Aucune sauvegarde trouvée${NC}"
fi

# Licence
echo -e "\n${BOLD}Licence :${NC}"
LICENSE=$(grep MARCEL_LICENSE_KEY backend/.env 2>/dev/null | cut -d'=' -f2 | cut -c1-20)
echo -e "  Clé : ${CYAN}${LICENSE}...${NC}"

echo ""
