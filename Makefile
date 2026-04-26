# Projetenne — Makefile
# Usage : make <target>

.PHONY: up dev down logs build rebuild db-backup db-restore reset-db seed seed-beta load-test test shell-back shell-db status help

COMPOSE    = docker compose
BACKUP_DIR = backups/mongodb_$(shell date +%Y%m%d_%H%M%S)

## ── Démarrage / arrêt ────────────────────────────────────────────────────────
up:
	$(COMPOSE) up -d

dev:
	SEED_DEMO_DATA=true $(COMPOSE) up -d

up-https:
	$(COMPOSE) --profile https up -d

down:
	$(COMPOSE) down

rebuild:
	$(COMPOSE) down && $(COMPOSE) build --no-cache && $(COMPOSE) up -d

## ── Logs ─────────────────────────────────────────────────────────────────────
logs:
	$(COMPOSE) logs -f

## ── Build ────────────────────────────────────────────────────────────────────
build:
	$(COMPOSE) build --no-cache

## ── Backup / Restore MongoDB ─────────────────────────────────────────────────
db-backup:
	mkdir -p backups
	$(COMPOSE) exec -T mongodb mongodump --db=projetenne --gzip --archive > $(BACKUP_DIR).gz
	@echo "Backup : $(BACKUP_DIR).gz"

backup: db-backup

db-restore:
ifndef BACKUP
	$(error Spécifiez BACKUP=<chemin>, ex: make db-restore BACKUP=backups/mongodb_xxx.gz)
endif
	$(COMPOSE) exec -T mongodb mongorestore --db=projetenne --gzip --archive < $(BACKUP)
	@echo "Restauration depuis $(BACKUP) terminée"

restore: db-restore

## ── Base de données ──────────────────────────────────────────────────────────
reset-db:
	$(COMPOSE) exec -T mongodb mongosh projetenne --eval "db.dropDatabase()"
	$(COMPOSE) restart backend
	@echo "Base réinitialisée"

## ── Seeds ────────────────────────────────────────────────────────────────────
seed:
	$(COMPOSE) exec -T backend python seed.py
	@echo "Données démo Altair chargées"

seed-demo: seed

seed-beta:
	$(COMPOSE) exec -T backend python seed_beta_corp.py
	@echo "Tenant Beta Corp créé"

## ── Tests et charge ──────────────────────────────────────────────────────────
test:
	cd backend && python -m pytest tests/ -v --tb=short

load-test:
	cd backend && python load_test.py

## ── Shells interactifs ───────────────────────────────────────────────────────
shell-back:
	$(COMPOSE) exec backend /bin/bash

shell-db:
	$(COMPOSE) exec mongodb mongosh projetenne

## ── Statut ───────────────────────────────────────────────────────────────────
status:
	$(COMPOSE) ps

## ── Aide ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Démarrage"
	@echo "    make dev            → Développement (seed démo activé)"
	@echo "    make up             → Production"
	@echo "    make up-https       → Traefik + HTTPS"
	@echo "    make down           → Arrêter"
	@echo "    make rebuild        → Rebuild + redémarrage complet"
	@echo "    make logs           → Logs en temps réel"
	@echo ""
	@echo "  Données"
	@echo "    make seed           → Seed Altair Industries"
	@echo "    make seed-beta      → Créer tenant Beta Corp"
	@echo "    make db-backup      → Sauvegarder MongoDB"
	@echo "    make db-restore BACKUP=<path>  → Restaurer"
	@echo "    make reset-db       → Réinitialiser la base"
	@echo ""
	@echo "  Qualité"
	@echo "    make test           → Tests pytest (50+ tests)"
	@echo "    make load-test      → Test de charge"
	@echo ""
	@echo "  Debug"
	@echo "    make shell-back     → Shell backend"
	@echo "    make shell-db       → Shell MongoDB"
	@echo "    make status         → Statut des services"
	@echo ""
