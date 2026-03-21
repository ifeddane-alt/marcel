# Projetenne — Plateforme SaaS de Pilotage de Portefeuille Projets

Application multi-tenant pour la gestion de portefeuilles projets grands comptes (CAC 40).

## Architecture

| Composant | Technologie |
|-----------|------------|
| Frontend  | React 18 + Tailwind CSS + Recharts |
| Backend   | FastAPI (Python) + Motor (async) |
| Base de données | MongoDB (isolation multi-tenant par `tenant_id`) |
| Authentification | JWT local (simulation Cognito) |

## Configuration

### Variables d'environnement

**Backend** (`backend/.env`) :
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=projetenne_db
CORS_ORIGINS=*
JWT_SECRET=<votre-secret-fort>
```

**Frontend** (`frontend/.env`) :
```
REACT_APP_BACKEND_URL=https://votre-domaine.com
```

## Lancement local

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Seed des données de démonstration
```bash
cd backend
python seed.py
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| admin@altair.fr | Admin1234! | TENANT_ADMIN |
| pmo@altair.fr   | Pmo1234!   | PMO_USER |
| viewer@altair.fr| View1234!  | READ_ONLY |

## Tenant démo

**Groupe Altair Industries** — 8 projets actifs, budget portefeuille 17,3M€

### Projets inclus
- Projet Phoenix — Transformation Digitale Groupe (SAFe, Orange)
- Modernisation SI Finance & Contrôle de Gestion (Waterfall, Vert)
- Déploiement ERP SAP S/4HANA (Waterfall, Rouge)
- Digital Workplace 2025 — Suite Microsoft 365 (Agile, Vert)
- Programme CRM Salesforce — Sales & Service Cloud (SAFe, Orange)
- Migration Infrastructure Cloud Azure (Agile, Vert)
- Refonte Portail RH & Self-Service Collaborateur (Agile, Rouge)
- Programme Conformité DORA & NIS2 (Waterfall, Vert)

## API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/auth/login` | Authentification JWT |
| GET  | `/api/auth/me` | Profil utilisateur courant |
| GET  | `/api/projects` | Liste des projets du tenant |
| GET  | `/api/projects/:id` | Détail d'un projet |
| POST | `/api/projects` | Créer un projet |
| PUT  | `/api/projects/:id` | Modifier un projet |
| GET  | `/api/resources` | Liste des ressources |
| GET  | `/api/allocations?project_id=` | Allocations |
| GET  | `/api/milestones?project_id=` | Jalons |
| GET  | `/api/governance` | Instances de gouvernance |
| GET  | `/api/dashboard/summary` | Synthèse tableau de bord |

## Sécurité multi-tenant

- `tenant_id` extrait du JWT sur chaque appel API
- Toutes les requêtes MongoDB filtrées par `tenant_id`
- Aucun accès cross-tenant possible
- Rôles : TENANT_ADMIN > PMO_USER > READ_ONLY
- Les opérations d'écriture (POST/PUT) sont interdites au rôle READ_ONLY

## Structure du projet

```
/app
├── backend/
│   ├── server.py      # Application FastAPI + tous les endpoints
│   ├── seed.py        # Script de seed données de démo
│   ├── requirements.txt
│   └── .env
└── frontend/
    └── src/
        ├── api/index.js              # Client Axios avec intercepteurs JWT
        ├── contexts/AuthContext.jsx  # Contexte d'authentification
        ├── components/
        │   ├── Layout.jsx            # Sidebar + topbar
        │   └── RAGBadge.jsx          # Badges RAG, méthodo, statuts
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx
        │   ├── Portfolio.jsx
        │   ├── ProjectDetail.jsx
        │   ├── Resources.jsx
        │   └── Governance.jsx
        └── utils/format.js           # Formatage euros, dates, JH
```
