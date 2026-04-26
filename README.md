# Projetenne — PPM SaaS Multi-Tenant

> Solution complète de gestion de portefeuille projets (PPM) pour DSI et PMO.  
> Stack : React 18 · FastAPI · MongoDB · Claude Sonnet 4 · Traefik

---

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Installation rapide](#2-installation-rapide)
3. [Configuration .env](#3-configuration-env)
4. [Démarrage](#4-démarrage)
5. [HTTPS avec Traefik](#5-https-avec-traefik)
6. [Comptes de démonstration](#6-comptes-de-démonstration)
7. [Backup / Restore MongoDB](#7-backup--restore-mongodb)
8. [Mise à jour](#8-mise-à-jour)
9. [Tests](#9-tests)
10. [Test de charge](#10-test-de-charge)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prérequis

| Outil | Version minimale |
|---|---|
| Docker | 24+ |
| Docker Compose | 2.20+ |
| GNU Make | 4.0+ |
| Git | 2.40+ |

**Ports utilisés :** 80 (HTTP), 443 (HTTPS/Traefik), 8001 (API), 27017 (MongoDB)

---

## 2. Installation rapide

```bash
# Cloner le dépôt
git clone https://github.com/votre-org/projetenne.git
cd projetenne

# Copier et éditer les variables d'environnement
cp backend/.env.example backend/.env
# → Éditez backend/.env (voir section 3)

# Démarrer en mode développement (avec seed de démo)
make dev

# OU démarrer en production
make up
```

L'application est accessible sur : **http://localhost**

---

## 3. Configuration .env

### `/backend/.env` (serveur)

```dotenv
# ── Base de données ───────────────────────────────────────────────────────────
MONGO_URL=mongodb://mongodb:27017          # URL MongoDB (modifiez si externe)
DB_NAME=projetenne                         # Nom de la base

# ── Sécurité JWT ──────────────────────────────────────────────────────────────
SECRET_KEY=changez-moi-en-production-32chars-min
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480            # 8 heures

# ── IA — Emergent Universal Key (Claude Sonnet 4) ─────────────────────────────
LLM_API_KEY=votre-cle-emergent             # Obtenir sur app.emergent.ai → Profil → Universal Key
ANTHROPIC_MODEL=claude-sonnet-4-20250514

# ── Seed de démo ──────────────────────────────────────────────────────────────
SEED_DEMO_DATA=true                        # false en production
ADMIN_PASSWORD=Admin2026!                  # Mot de passe admin Altair (démo)

# ── Environnement ─────────────────────────────────────────────────────────────
ENVIRONMENT=development                    # development | production
LOG_LEVEL=INFO
```

### `/frontend/.env`

```dotenv
REACT_APP_BACKEND_URL=https://votre-domaine.com    # URL externe de l'API
# En développement local :
# REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 4. Démarrage

```bash
# Développement (hot reload, seed démo, logs verbose)
make dev

# Production
make up

# Arrêt
make down

# Rebuild complet (après modification Dockerfile)
make rebuild

# Logs en temps réel
make logs

# Logs d'un service spécifique
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb
```

### Commandes Make disponibles

```
make help         Affiche toutes les commandes disponibles
make dev          Démarre en mode développement
make up           Démarre en mode production
make down         Arrête tous les services
make rebuild      Rebuild + redémarre
make logs         Affiche les logs
make test         Lance les tests pytest
make seed         Relance le seed de démo Altair
make seed-beta    Crée le tenant Beta Corp
make load-test    Lance le test de charge (200 projets, 2000 timesheets)
make db-backup    Sauvegarde MongoDB
make db-restore   Restaure MongoDB depuis un backup
make shell-back   Shell interactif dans le conteneur backend
make shell-db     Shell MongoDB
```

---

## 5. HTTPS avec Traefik

Traefik est préconfiguré pour le reverse proxy HTTPS avec Let's Encrypt.

### Configuration

1. **Créer le réseau Traefik** (une seule fois) :
   ```bash
   docker network create traefik-public
   ```

2. **Éditer `docker-compose.yml`** — décommenter les labels Traefik :
   ```yaml
   labels:
     - "traefik.enable=true"
     - "traefik.http.routers.projetenne.rule=Host(`votre-domaine.com`)"
     - "traefik.http.routers.projetenne.tls.certresolver=letsencrypt"
   ```

3. **Configurer le domaine** dans `backend/.env` :
   ```dotenv
   FRONTEND_URL=https://votre-domaine.com
   ```

4. **Démarrer avec Traefik** :
   ```bash
   make up
   ```

> **Note :** HSTS (`Strict-Transport-Security`) est activé automatiquement par Traefik en HTTPS.  
> Le header CSP est également configuré dans `frontend/nginx.conf`.

---

## 6. Comptes de démonstration

Après `make dev`, les comptes suivants sont disponibles :

| Email | Mot de passe | Profil | Accès |
|---|---|---|---|
| `admin@altair.fr` | `Admin2026!` | Administrateur | Tout |
| `pmo@altair.fr` | `Pmo1234!` | PMO Portefeuille | Portfolio + Arbitrage + IA |
| `cp@altair.fr` | `Altair2026!` | Chef de Projet | Projets + Scope + Timesheets |
| `manager@altair.fr` | `Altair2026!` | Manager Portfolio | Portfolio + Roadmap + IA |
| `viewer@altair.fr` | `View1234!` | Direction SI | Lecture seule |
| `user@altair.fr` | `Altair2026!` | Utilisateur | Projets + Timesheets |
| `achats@altair.fr` | `Altair2026!` | Achats / Vendor | Vendors |
| `admin@betacorp.fr` | `Beta2026!` | Admin Beta Corp | Tout (tenant Beta) |

---

## 7. Backup / Restore MongoDB

### Backup

```bash
# Via Make
make db-backup
# Crée : backups/mongodb_YYYYMMDD_HHMMSS.gz

# Manuellement
docker exec projetenne-mongodb-1 mongodump \
  --db=projetenne --gzip --archive \
  > backups/backup_$(date +%Y%m%d).gz
```

### Restore

```bash
# Via Make (choisit le backup le plus récent)
make db-restore BACKUP=backups/mongodb_20260115_120000.gz

# Manuellement
docker exec -i projetenne-mongodb-1 mongorestore \
  --db=projetenne --gzip --archive \
  < backups/backup_20260115.gz
```

### Backup automatique (cron)

```bash
# Ajouter dans crontab (crontab -e)
0 2 * * * cd /opt/projetenne && make db-backup >> /var/log/projetenne-backup.log 2>&1
```

---

## 8. Mise à jour

```bash
# 1. Récupérer les dernières modifications
git pull origin main

# 2. Rebuild les images
make rebuild

# 3. Vérifier les migrations (si applicable)
docker exec projetenne-backend-1 python migrate.py

# 4. Valider
make logs
curl http://localhost/health
```

---

## 9. Tests

```bash
# Via Make
make test

# Directement avec pytest
cd backend
pytest tests/ -v --tb=short

# Tests d'un module spécifique
pytest tests/test_auth_rbac.py -v
pytest tests/test_projects_crud.py -v
pytest tests/test_agent_wf.py -v

# Avec rapport de couverture
pytest tests/ --cov=modules --cov-report=html
```

### Variables d'environnement pour les tests

```bash
TEST_BASE_URL=http://localhost:8001  # Backend URL pour les tests
```

---

## 10. Test de charge

Génère 200 projets, 50 ressources, 1000 tâches, 500 allocations, 2000 timesheets
et mesure les temps de chargement des pages critiques.

```bash
# Via Make
make load-test

# Directement
cd backend
python load_test.py

# Nettoyage après test
python load_test.py --cleanup
```

**Résultat attendu** :

```
Page                  Temps (ms)     Statut
----------------------------------------------
  Dashboard              245.3ms     ✓ OK
  Portfolio              380.7ms     ✓ OK
  Roadmap                412.1ms     ✓ OK
  Timesheets             180.4ms     ✓ OK
```

> Si un temps > 2 secondes est détecté, les indexes MongoDB sont créés automatiquement.

---

## 11. Troubleshooting

### L'application ne démarre pas

```bash
# Vérifier les logs
make logs

# Vérifier les conteneurs
docker compose ps

# Reconstruire
make rebuild
```

### Erreur de connexion MongoDB

```bash
# Vérifier que MongoDB est démarré
docker compose ps mongodb

# Tester la connexion
docker exec projetenne-backend-1 python -c "
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio, os
async def test():
    c = AsyncIOMotorClient(os.environ['MONGO_URL'])
    print(await c.server_info())
asyncio.run(test())
"
```

### L'Agent IA ne répond pas

1. Vérifier `LLM_API_KEY` dans `backend/.env`
2. Vérifier le solde Universal Key : Profil → Universal Key → Add Balance
3. Tester l'endpoint : `curl http://localhost:8001/api/agent/recommendations`

### Erreur 429 à la connexion

Le rate limiter est actif : **5 tentatives par IP par minute**.  
Attendez 60 secondes ou changez d'IP.

### Problème de permissions

```bash
# Corriger les droits
sudo chown -R $USER:$USER .
chmod +x backend/entrypoint.sh
```

### Réinitialiser la base de données

```bash
# Supprimer et recréer la base
docker compose down -v
make dev
```

---

## Architecture technique

```
projetenne/
├── backend/              # FastAPI + Motor + APScheduler
│   ├── modules/          # Modules métier (agent, arbitrage, scope, ...)
│   ├── core/             # Auth JWT, database, permissions
│   ├── tests/            # 50+ tests pytest
│   ├── seed.py           # Seed principal Altair
│   ├── seed_beta_corp.py # Seed tenant Beta Corp
│   ├── load_test.py      # Test de charge
│   └── pptx_generator.py # Génération PPT COPIL
├── frontend/             # React 18 + Shadcn UI + Tailwind
│   ├── src/pages/        # Pages applicatives
│   ├── src/components/   # Composants réutilisables
│   ├── src/locales/      # Traductions FR/EN
│   └── nginx.conf        # Nginx + security headers
├── docker-compose.yml    # Orchestration
├── Makefile              # Commandes développement
└── README.md             # Ce fichier
```

---

## Sécurité

- **Rate limiting** : 5 tentatives/IP/minute sur `/auth/login` (429 Too Many Requests)
- **Headers HTTP** : X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, CSP, Referrer-Policy
- **JWT** : HS256, 8h d'expiration, vérification à chaque requête
- **RBAC** : permissions granulaires par profil (28 permissions distinctes)
- **Multi-tenant** : isolation totale par `tenant_id` sur toutes les collections
- **HTTPS** : Traefik + Let's Encrypt en production (HSTS activé)

---

## Support

- Email : support@projetenne.fr
- Documentation API : `http://localhost:8001/docs`
- Changelog : voir `CHANGELOG.md`
