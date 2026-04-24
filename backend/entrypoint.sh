#!/bin/sh
set -e

echo "======================================================"
echo "  Projetenne — Démarrage du backend"
echo "======================================================"

echo "[1/2] Initialisation de la base de données..."
python seed_docker.py

echo "[2/2] Démarrage de l'API FastAPI..."
exec uvicorn server:app --host 0.0.0.0 --port 8000 --workers 2
