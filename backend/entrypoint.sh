#!/bin/sh
set -e

echo "======================================================"
echo "  Projetenne — Démarrage du backend"
echo "======================================================"

echo "[1/2] Initialisation de la base de données..."
if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  echo "  SEED_DEMO_DATA=true → chargement des données Altair démo"
  python seed.py
else
  python seed_docker.py
fi

echo "[2/2] Démarrage de l'API FastAPI..."
exec uvicorn server:app --host 0.0.0.0 --port 8000 --workers 2
