# Projetenne — Guide de déploiement Docker

## Prérequis

| Logiciel | Version minimale |
|---|---|
| Docker | 24.x |
| Docker Compose | v2.x |
| RAM | 2 Go (4 Go recommandés) |
| Disque | 10 Go libres |

---

## Installation rapide

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-org/projetenne.git
cd projetenne

# 2. Copier et configurer l'environnement
cp .env.example .env
nano .env   # Adapter au minimum : SECRET_KEY, REACT_APP_BACKEND_URL

# 3. Démarrer
make up     # ou : docker compose up -d

# 4. Ouvrir dans le navigateur
# http://localhost  (ou votre domaine)
```

Compte admin par défaut (seed vide) : `admin@example.com` / `Admin2026!`
Compte admin démo Altair (si `SEED_DEMO_DATA=true`) : `admin@altair.fr` / `Admin2026!`

---

## Configuration `.env`

| Variable | Obligatoire | Description |
|---|---|---|
| `MONGO_URL` | ✓ | URL MongoDB (auto-configuré en Docker) |
| `DB_NAME` | ✓ | Nom de la base (défaut : `projetenne`) |
| `SECRET_KEY` | ✓ | Clé JWT — changer en production |
| `REACT_APP_BACKEND_URL` | ✓ | URL publique de l'API (`https://api.exemple.fr`) |
| `CORS_ORIGINS` | — | Origines CORS séparées par virgule |
| `ENCRYPTION_KEY` | ✓ | Clé AES-256 pour les credentials connecteurs |
| `EMERGENT_LLM_KEY` | — | Clé LLM pour l'Agent IA PMO |
| `ANTHROPIC_MODEL` | — | Modèle Claude (défaut : `claude-sonnet-4-20250514`) |
| `SEED_DEMO_DATA` | — | `true` → charge les données démo Altair au démarrage |
| `DOMAIN` | — | Domaine pour HTTPS Traefik (ex : `projetenne.exemple.fr`) |
| `ACME_EMAIL` | — | Email Let's Encrypt |
| `HTTP_PORT` | — | Port HTTP si pas de Traefik (défaut : `80`) |

---

## HTTPS avec Traefik + Let's Encrypt

```bash
# Dans .env
DOMAIN=projetenne.exemple.fr
ACME_EMAIL=ops@exemple.fr

# Démarrer avec le profil HTTPS
make up-https
# ou : docker compose --profile https up -d
```

> Le certificat TLS est automatiquement émis et renouvelé par Let's Encrypt.  
> **Prérequis** : le port 80 et 443 doivent être accessibles depuis Internet, et le DNS `DOMAIN` doit pointer vers le serveur.

---

## Données démo (Altair Industries)

Pour charger le jeu de données démo complet (8 projets, 10 ressources, risques, jalons, etc.) :

```bash
# Option 1 : Lors du premier démarrage
SEED_DEMO_DATA=true docker compose up -d

# Option 2 : Sur une instance déjà démarrée
make seed-demo
```

---

## Backup & Restore

```bash
# Sauvegarder MongoDB → /backups/YYYY-MM-DD/
make backup

# Restaurer depuis une sauvegarde
make restore BACKUP=/backups/2026-04-25

# Réinitialiser complètement la base
make reset-db
```

---

## Mise à jour

```bash
git pull origin main
make build   # Rebuilder les images
make down && make up
```

---

## Troubleshooting

### Port 80 déjà occupé
```bash
# Changer le port d'exposition
HTTP_PORT=8080 docker compose up -d
# ou dans .env : HTTP_PORT=8080
```

### Permission denied sur /var/run/docker.sock (Traefik)
```bash
sudo chmod 666 /var/run/docker.sock
# ou ajouter votre user au groupe docker :
sudo usermod -aG docker $USER
```

### MongoDB ne démarre pas
```bash
# Vérifier les logs
docker compose logs mongo

# Problème de permission sur le volume
sudo chown -R 999:999 /var/lib/docker/volumes/projetenne_mongo_data
```

### Backend en erreur au démarrage
```bash
docker compose logs backend

# Erreur "ENCRYPTION_KEY invalid" → regénérer la clé
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Copier la valeur dans .env → ENCRYPTION_KEY=...

# Erreur JWT → regénérer SECRET_KEY
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend affiche "Erreur de connexion"
- Vérifier que `REACT_APP_BACKEND_URL` pointe vers l'API accessible (avec `/api` en suffixe non inclus)
- Vérifier que `CORS_ORIGINS` inclut l'URL du frontend

### Connecteur SAP RFC (optionnel)
Pour utiliser PyRFC au lieu d'OData :
1. Installer le SAP NW RFC SDK : https://support.sap.com/en/product/connectors/nwrfcsdk.html
2. Installer pyrfc : `pip install pyrfc`
3. Dans la config du connecteur SAP, sélectionner `auth_type = "rfc"` et renseigner `SAP_ASHOST`, `SAP_SYSNR`, `SAP_CLIENT` dans `.env`

---

## Architecture des services

```
Internet
    │
    ▼
[Traefik / Nginx]  ──────── :80 / :443
    │
    ├── /api/*   →  [Backend FastAPI :8000]
    │                    │
    │                    └── [MongoDB :27017]
    │
    └── /*       →  [Frontend React / Nginx :80]
```
