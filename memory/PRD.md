# Projetenne — PRD & Architecture

## Contexte
Application SaaS multi-tenant de pilotage de portefeuille projets pour grandes entreprises (CAC 40 style).
Tenant démo : **Groupe Altair Industries**

## User Personas
- **TENANT_ADMIN** (Sophie Martin) : Accès complet, création/modification de projets
- **PMO_USER** (Thomas Dubois) : Accès lecture + écriture projets, pas d'administration tenant
- **READ_ONLY** (Marie Leclerc) : Lecture seule, ne peut pas créer/modifier

## Architecture Technique
- **Frontend** : React 18 (JSX), Tailwind CSS, Recharts, React Router v7, Axios
- **Backend** : FastAPI (Python 3.x), Motor (async MongoDB driver)
- **Base de données** : MongoDB — isolation multi-tenant par `tenant_id` sur chaque document
- **Auth** : JWT local signé HS256 (simulation AWS Cognito), expiry 24h
- **Design** : Swiss Corporate Navy Blue (#0F172A sidebar, #0052CC accent, #F8F9FA bg)
- **Polices** : Barlow Condensed (titres), Inter (corps), JetBrains Mono (données)

## Architecture Backend (v2.0 — Sprint 0 — 21/04/2026)

```
/app/backend/
├── server.py                  # 50 lignes (app factory + include_router)
├── core/
│   ├── auth.py                # TokenPayload, create_token, get_current_user, require_write
│   └── database.py            # Motor client + db instance
├── shared/
│   ├── rag.py                 # calculate_task_rag, STATUS_PROGRESS, _get_task_rag_settings
│   └── utils.py               # placeholder helpers futurs (keur, etc.)
├── modules/
│   ├── auth/                  # schemas.py, router.py
│   ├── projects/              # schemas.py, service.py, router.py
│   ├── programs/              # schemas.py, service.py, router.py
│   ├── resources/             # schemas.py, service.py, router.py
│   ├── tasks/                 # schemas.py, service.py, router.py
│   ├── allocations/           # service.py, router.py
│   ├── milestones/            # service.py, router.py
│   ├── risks/                 # schemas.py, service.py, router.py
│   ├── decisions/             # schemas.py, service.py, router.py
│   ├── governance/            # service.py, router.py
│   ├── dashboard/             # service.py, router.py
│   ├── export/                # schemas.py, service.py, router.py
│   ├── csv_import/            # schemas.py, service.py, router.py
│   └── tenant/                # router.py
└── pptx_generator.py          # Générateur PowerPoint COPIL (intact)
```

### Principes d'architecture
- **2 couches** : router.py (HTTP, auth deps, request/response) + service.py (logique métier + requêtes Motor)
- **Pas de Repository pattern** : requêtes Motor directes dans service.py
- **Dépendances unidirectionnelles** : Level 3 (dashboard, export) → Level 2 (projects, risks, etc.) → Level 1 (core, shared)
- **Isolation multi-tenant** : filtrage `tenant_id` sur chaque requête

## Collections MongoDB
| Collection | Champs clés |
|-----------|-------------|
| tenants | tenant_id, name, plan, settings |
| users | user_id, tenant_id, email, name, role, password_hash |
| projects | project_id, tenant_id, name, methodology, status_rag, status, budget_*, capex_*, opex_*, eac, budget_revision_history[], jh_*, dates, end_date_actual |
| resources | resource_id, tenant_id, name, role, capacity_jh_month, team |
| allocations | allocation_id, project_id, resource_id, period_month, jh_allocated, jh_consumed |
| milestones | milestone_id, project_id, name, date_baseline, date_forecast, status, is_governance |
| governance | governance_id, tenant_id, name, type, date_scheduled, projects_scope, sanity_check_* |
| risks | risk_id, project_id, tenant_id, title, description, category, probability(1-5), impact(1-5), criticality(P×I), status, mitigation_plan, owner, due_date |
| decisions | decision_id, project_id, tenant_id, title, description, category(8 options), status(6 options), decision_date, due_date, owner, impact, governance_id |

---

## Ce qui est implémenté

### Sprint 0 — Refactoring Backend Modulaire (COMPLET ✅ — 21/04/2026)
- [x] Migration `server.py` (1519 lignes) → architecture modulaire 2-couches
- [x] `core/auth.py` : TokenPayload, create_token, get_current_user, require_write
- [x] `core/database.py` : Motor client + instance db
- [x] `shared/rag.py` : calculate_task_rag, _get_task_rag_settings
- [x] 13 modules avec router.py + service.py + schemas.py
- [x] `server.py` = 50 lignes (app factory)
- [x] Zéro changement fonctionnel — 52/52 tests backend passés
- [x] RBAC intact : READ_ONLY=403, PMO=CRUD sans delete, ADMIN=CRUD complet

### Heatmap Dashboard — Cartographie des risques P × I (COMPLET ✅ — 13/04/2026)
- [x] GET /api/dashboard/heatmap-risks
- [x] `Dashboard.jsx` : section "Cartographie des risques P × I"
- [x] Filtres dropdowns + composant `RiskHeatmap.jsx` partagé

### Chantier 5 — Export PowerPoint COPIL (COMPLET ✅ — 13/04/2026)
- [x] Backend `pptx_generator.py` : 6 slides
- [x] `POST /api/export/copil`
- [x] `ExportCopilModal.jsx`, boutons dans Portfolio/ProjectDetail/ProgramDetail/Governance
- [x] Tests 100% — 6/6 (iteration_12.json)

### Chantier 8 — Registre des décisions (COMPLET ✅ — 13/04/2026)
- [x] Collection `decisions` : 8 catégories, 6 statuts
- [x] CRUD complet GET/POST/PUT/DELETE /api/decisions
- [x] `DecisionModal.jsx`, sections dans ProjectDetail.jsx et Governance.jsx
- [x] Seed : 32 décisions
- [x] Tests 100% — 15/15 (iteration_11.json)

### Chantier 7 — Registre des risques (COMPLET ✅ — 13/04/2026)
- [x] Collection `risks` : criticité auto P×I
- [x] CRUD GET/POST/PUT/DELETE /api/risks
- [x] `RiskModal.jsx`, heatmap 5×5, widget Dashboard top-risques
- [x] Seed : 38 risques
- [x] Tests 100% — 24/24 (iteration_9.json)

### Chantier 6 — Budget CAPEX/OPEX + EAC + Révisions (COMPLET ✅)
- [x] Schema projets enrichi, `_sync_budget_aggregates()`
- [x] `POST /api/projects/:id/budget-revision`
- [x] Tests 100% — 11/11 (iteration_10.json)

### Chantier 4 — Programmes (COMPLET ✅)
- [x] CRUD /api/programs avec agrégation métriques
- [x] Page Programmes + Détail Programme

### Chantier 3 — CRUD depuis UI (COMPLET ✅)
- [x] Modals Projet/Tâche/Ressource/Programme
- [x] Tests 100% — 22/22 (iteration_6.json)

### Chantier 2 — Import CSV (COMPLET ✅)
- [x] Wizard 4 étapes, POST /api/import/preview + commit
- [x] Support projets, tâches, ressources

### Chantier 1 — Tâches (COMPLET ✅)
- [x] CRUD /api/tasks avec mini-RAG calculé
- [x] 46 tâches seedées

### Infrastructure (COMPLET ✅)
- [x] Auth JWT multi-tenant, RBAC 3 rôles
- [x] Dashboard, Portfolio, ProjectDetail, Resources, Governance
- [x] Multi-tenant isolation complète

---

## Roadmap / Backlog priorisé

### P1 — Prochains chantiers (après Sprint 0 validé)
| Chantier | Description |
|---------|-------------|
| **P3 étendu** | Gestion des Ressources : teams, team_id, tjm_eur, work_allocations |
| **P1 Demande** | Collection `demands` et workflow de qualification |
| **P5 Temps** | Collection `timesheets` et validation hiérarchique |
| **Chantier 9a SAFe** | Collections trains, pis, sprints, capabilities |
| **Chantier 9b Tasks** | parent_id, phase sur tasks, vue arbre |

### P2 — Backlog
| Chantier | Description |
|---------|-------------|
| **P2 Arbitrage** | Scoring et enveloppe portefeuille |
| **Module Scope** | Snapshot, capacity vs charge, Gantt recalcul |
| **Notif email** | Alertes risques critiques / budget dépassé |
| **BI / Export** | Export CSV cross-projets depuis Dashboard |
| **Audit trail** | Journal des modifications |

---

## Données de seed (v1.5)
- 1 tenant : Groupe Altair Industries
- 3 utilisateurs (Admin, PMO, Viewer)
- 4 programmes : Transformation Digitale, Modernisation SI, Pilotage Finance, Conformité RH
- 8 projets (2 par programme) avec CAPEX/OPEX, statuts variés
- 10 ressources, 18 allocations, 21 jalons, 5 instances gouvernance
- 46 tâches, 38 risques, 32 décisions

## Fichiers de référence principaux
- `/app/backend/server.py` : 50 lignes — app factory
- `/app/backend/core/` : auth.py, database.py
- `/app/backend/shared/` : rag.py, utils.py
- `/app/backend/modules/` : 13 modules (router + service + schemas)
- `/app/backend/pptx_generator.py` : Générateur PPTX COPIL
- `/app/backend/seed.py` : Données de démo complètes
- `/app/frontend/src/api/index.js` : Client API Axios
- `/app/frontend/src/pages/` : Dashboard, Portfolio, ProjectDetail, Governance, Programs, Resources
