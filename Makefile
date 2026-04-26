# Projetenne — Makefile
# Usage : make <target>

.PHONY: up down logs build backup restore reset-db seed-demo test help

COMPOSE = docker compose
BACKUP_DIR = /backups/$(shell date +%Y-%m-%d)

## Démarrage / arrêt
up:
	$(COMPOSE) up -d

up-https:
	$(COMPOSE) --profile https up -d

down:
	$(COMPOSE) down

## Logs en temps réel
logs:
	$(COMPOSE) logs -f

## Build (sans cache)
build:
	$(COMPOSE) build --no-cache

## Backup MongoDB → /backups/YYYY-MM-DD/
backup:
	mkdir -p $(BACKUP_DIR)
	$(COMPOSE) exec -T mongo mongodump --out /tmp/backup
	docker cp $$($(COMPOSE) ps -q mongo):/tmp/backup $(BACKUP_DIR)
	@echo "Backup stocké dans $(BACKUP_DIR)"

## Restauration — make restore BACKUP=/backups/2026-04-25
restore:
ifndef BACKUP
	$(error Spécifiez BACKUP=<chemin>, ex: make restore BACKUP=/backups/2026-04-25)
endif
	docker cp $(BACKUP) $$($(COMPOSE) ps -q mongo):/tmp/restore
	$(COMPOSE) exec -T mongo mongorestore --drop /tmp/restore
	@echo "Restauration depuis $(BACKUP) terminée"

## Réinitialisation complète (drop DB + seed vide)
reset-db:
	$(COMPOSE) exec -T mongo mongosh projetenne --eval "db.dropDatabase()"
	$(COMPOSE) restart backend
	@echo "Base réinitialisée + seed vide rechargé"

## Chargement des données démo Altair
seed-demo:
	$(COMPOSE) exec -T backend python seed.py
	@echo "Données démo Altair chargées"

## Tests backend
test:
	$(COMPOSE) exec -T backend python -m pytest /app/tests/ -v 2>/dev/null || \
	$(COMPOSE) exec -T backend python -m pytest tests/ -v

## Statut des services
status:
	$(COMPOSE) ps

## Aide
help:
	@echo ""
	@echo "  make up          → Démarrer les services"
	@echo "  make up-https    → Démarrer avec Traefik HTTPS"
	@echo "  make down        → Arrêter les services"
	@echo "  make logs        → Voir les logs en temps réel"
	@echo "  make build       → Rebuilder les images (--no-cache)"
	@echo "  make backup      → Sauvegarder MongoDB dans /backups/YYYY-MM-DD/"
	@echo "  make restore BACKUP=<path>  → Restaurer une sauvegarde"
	@echo "  make reset-db    → Réinitialiser la base de données"
	@echo "  make seed-demo   → Charger les données démo Altair"
	@echo "  make test        → Lancer les tests backend"
	@echo ""
