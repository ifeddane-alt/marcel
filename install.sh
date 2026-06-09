#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# MARCEL PPM — Installateur automatique v1.1
# Usage : curl -fsSL https://raw.githubusercontent.com/ifeddane-alt/marcel/main/install.sh | bash
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}✔${NC}  $1"; }
info() { echo -e "${CYAN}→${NC}  $1"; }
warn() { echo -e "${YELLOW}⚠${NC}  $1"; }
err()  { echo -e "${RED}✖${NC}  $1"; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}[$1/8]${NC} $2"; }

INSTALL_DIR="/opt/marcel"
REPO="https://github.com/ifeddane-alt/marcel.git"

# ── Bannière ──────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${BLUE}"
cat << 'EOF'
  __  __    _    ____   ____ _____ _     
 |  \/  |  / \  |  _ \ / ___| ____| |    
 | |\/| | / _ \ | |_) | |   |  _| | |    
 | |  | |/ ___ \|  _ <| |___| |___| |___ 
 |_|  |_/_/   \_\_| \_\\____|_____|_____|
 PPM SaaS — Installateur on-premise v1.1
EOF
echo -e "${NC}"
echo -e "${BOLD}Ce script va installer MARCEL sur ce serveur.${NC}"
echo -e "Durée estimée : ${CYAN}5-10 minutes${NC}\n"

# ── Vérification root ─────────────────────────────────────────────────────────
step 1 "Vérification des prérequis"
[[ $EUID -ne 0 ]] && err "Ce script doit être exécuté en root. Utilisez : sudo bash install.sh"
ok "Exécution en root"

# ── OS check ──────────────────────────────────────────────────────────────────
if ! grep -qi "ubuntu\|debian" /etc/os-release 2>/dev/null; then
  warn "OS non détecté comme Ubuntu/Debian. Continuez à vos risques."
fi

# ── Docker ────────────────────────────────────────────────────────────────────
step 2 "Installation de Docker"
if command -v docker &>/dev/null; then
  ok "Docker déjà installé ($(docker --version | cut -d' ' -f3 | tr -d ','))"
else
  info "Installation de Docker..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  ok "Docker installé"
fi

if ! docker compose version &>/dev/null 2>&1; then
  info "Installation de docker-compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
ok "Docker Compose disponible"

# ── Questions interactives ────────────────────────────────────────────────────
step 3 "Configuration de votre installation"
echo ""

read -rp "  Nom de votre entreprise (ex: Groupe Altair) : " COMPANY_NAME
[[ -z "$COMPANY_NAME" ]] && err "Le nom de l'entreprise est obligatoire"

read -rp "  Email administrateur                        : " ADMIN_EMAIL
[[ -z "$ADMIN_EMAIL" ]] && err "L'email est obligatoire"

while true; do
  read -rsp "  Mot de passe admin (min 8 car.)             : " ADMIN_PASSWORD; echo
  [[ ${#ADMIN_PASSWORD} -ge 8 ]] && break
  warn "Le mot de passe doit faire au moins 8 caractères"
done

read -rp "  Votre domaine (ex: marcel.monentreprise.com): " DOMAIN
[[ -z "$DOMAIN" ]] && err "Le domaine est obligatoire"

read -rp "  Email pour Let's Encrypt (certif SSL)       : " SSL_EMAIL
[[ -z "$SSL_EMAIL" ]] && SSL_EMAIL="$ADMIN_EMAIL"

read -rp "  Clé de licence MARCEL                       : " LICENSE_KEY
[[ -z "$LICENSE_KEY" ]] && err "La clé de licence est obligatoire. Contactez support@marcel-ppm.com"

echo ""
ok "Configuration saisie"

# ── Confirmation ──────────────────────────────────────────────────────────────
echo -e "\n${BOLD}Récapitulatif de l'installation :${NC}"
echo -e "  Entreprise : ${CYAN}$COMPANY_NAME${NC}"
echo -e "  Admin      : ${CYAN}$ADMIN_EMAIL${NC}"
echo -e "  Domaine    : ${CYAN}$DOMAIN${NC}"
echo -e "  Répertoire : ${CYAN}$INSTALL_DIR${NC}"
echo ""
read -rp "Confirmer l'installation ? [O/n] : " CONFIRM
[[ "${CONFIRM,,}" == "n" ]] && { echo "Installation annulée."; exit 0; }

# ── Clonage du code ───────────────────────────────────────────────────────────
step 4 "Téléchargement de MARCEL"
apt-get install -y -qq git curl
if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Mise à jour du code existant..."
  cd "$INSTALL_DIR" && git pull origin main
  ok "Code mis à jour"
else
  info "Clonage du dépôt..."
  git clone --depth=1 "$REPO" "$INSTALL_DIR"
  ok "Code téléchargé dans $INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# ── Génération du .env ────────────────────────────────────────────────────────
step 5 "Génération de la configuration"
JWT_SECRET=$(openssl rand -hex 32)
MONGO_PASS=$(openssl rand -hex 16)

cat > "$INSTALL_DIR/backend/.env" << EOF
MONGO_URL=mongodb://marcel:${MONGO_PASS}@mongo:27017/marcel_db?authSource=admin
DB_NAME=marcel_db
JWT_SECRET=${JWT_SECRET}
TENANT_NAME=${COMPANY_NAME}
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
SEED_DEMO_DATA=false
DOMAIN=${DOMAIN}
MARCEL_LICENSE_KEY=${LICENSE_KEY}
EOF

# Créer le .env racine pour docker-compose
cat > "$INSTALL_DIR/.env" << EOF
MONGO_INITDB_ROOT_USERNAME=marcel
MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASS}
DOMAIN=${DOMAIN}
EOF

ok ".env généré (JWT secret aléatoire, mot de passe MongoDB aléatoire)"

# ── Nginx HTTP (avant SSL) ────────────────────────────────────────────────────
step 6 "Configuration Nginx + démarrage"
cat > "$INSTALL_DIR/nginx.conf" << NGINX
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    location /api/ {
        proxy_pass         http://backend:8001;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300;
    }

    location / {
        root       /usr/share/nginx/html;
        index      index.html;
        try_files  \$uri \$uri/ /index.html;
    }
}
NGINX

# Supprimer l'attribut 'version' obsolète si présent
sed -i '/^version:/d' "$INSTALL_DIR/docker-compose.yml" 2>/dev/null || true

info "Construction et démarrage des containers (3-5 min)..."
docker compose up -d --build 2>&1 | tail -5
ok "Containers démarrés"

# Attendre que le backend soit prêt
info "Attente du backend..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8001/api/health &>/dev/null 2>&1; then
    ok "Backend prêt"
    break
  fi
  sleep 3
done

# ── Seed initial ──────────────────────────────────────────────────────────────
info "Initialisation de la base de données..."
docker compose exec -T backend python seed_docker.py && ok "Base initialisée" || warn "Seed ignoré (déjà fait)"

# ── SSL Let's Encrypt ─────────────────────────────────────────────────────────
step 7 "Certificat SSL (Let's Encrypt)"
if apt-get install -y -qq certbot; then
  info "Obtention du certificat SSL pour $DOMAIN..."
  certbot certonly --standalone --non-interactive --agree-tos \
    -m "$SSL_EMAIL" -d "$DOMAIN" -d "www.$DOMAIN" \
    --pre-hook "docker compose -f $INSTALL_DIR/docker-compose.yml stop frontend" \
    --post-hook "docker compose -f $INSTALL_DIR/docker-compose.yml start frontend" \
    2>/dev/null && SSL_OK=true || SSL_OK=false

  if [[ "$SSL_OK" == "true" ]]; then
    ok "Certificat SSL obtenu"
    # Mettre à jour nginx avec HTTPS
    cat > "$INSTALL_DIR/nginx.conf" << NGINX_SSL
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;

    location /api/ {
        proxy_pass         http://backend:8001;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 300;
    }

    location / {
        root      /usr/share/nginx/html;
        index     index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
NGINX_SSL
    docker compose restart frontend
    # Renouvellement automatique
    echo "0 3 * * * root certbot renew --quiet && docker compose -f $INSTALL_DIR/docker-compose.yml restart frontend" \
      > /etc/cron.d/marcel-ssl
    ok "Renouvellement SSL automatique configuré"
  else
    warn "SSL non configuré (vérifiez que $DOMAIN pointe vers ce serveur). Accès en HTTP pour l'instant."
  fi
else
  warn "Certbot non disponible — SSL non configuré"
fi

# ── Sauvegarde automatique ────────────────────────────────────────────────────
step 8 "Configuration des sauvegardes automatiques"
cp "$INSTALL_DIR/scripts/backup.sh" /usr/local/bin/marcel-backup
chmod +x /usr/local/bin/marcel-backup
echo "0 2 * * * root /usr/local/bin/marcel-backup >> /var/log/marcel-backup.log 2>&1" \
  > /etc/cron.d/marcel-backup
ok "Sauvegarde quotidienne à 2h00 configurée"

# ── Résumé final ──────────────────────────────────────────────────────────────
PROTOCOL="http"
[[ "${SSL_OK:-false}" == "true" ]] && PROTOCOL="https"

echo ""
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  MARCEL PPM installé avec succès !${NC}"
echo -e "${BOLD}${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  URL      : ${CYAN}${PROTOCOL}://${DOMAIN}${NC}"
echo -e "  Admin    : ${CYAN}${ADMIN_EMAIL}${NC}"
echo -e "  Password : ${CYAN}${ADMIN_PASSWORD}${NC}"
echo -e "  Dossier  : ${CYAN}${INSTALL_DIR}${NC}"
echo ""
echo -e "  Commandes utiles :"
echo -e "    ${YELLOW}marcel-status${NC}  — état des containers"
echo -e "    ${YELLOW}marcel-backup${NC}  — lancer une sauvegarde"
echo -e "    ${YELLOW}marcel-update${NC}  — mettre à jour MARCEL"
echo ""
echo -e "  ${BOLD}Connectez-vous sur ${PROTOCOL}://${DOMAIN}${NC}"
echo ""

# Aliases globaux
cp "$INSTALL_DIR/scripts/status.sh" /usr/local/bin/marcel-status
cp "$INSTALL_DIR/scripts/update.sh" /usr/local/bin/marcel-update
chmod +x /usr/local/bin/marcel-status /usr/local/bin/marcel-update
