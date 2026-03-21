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

## Collections MongoDB
| Collection | Champs clés |
|-----------|-------------|
| tenants | tenant_id, name, plan, settings |
| users | user_id, tenant_id, email, name, role, password_hash |
| projects | project_id, tenant_id, name, methodology, status_rag, budget_*, jh_*, dates |
| resources | resource_id, tenant_id, name, role, capacity_jh_month, team |
| allocations | allocation_id, project_id, resource_id, period_month, jh_allocated, jh_consumed |
| milestones | milestone_id, project_id, name, date_baseline, date_forecast, status, is_governance |
| governance | governance_id, tenant_id, name, type, date_scheduled, projects_scope, sanity_check_* |

## Ce qui est implémenté (v1.0 — 21/03/2025)

### Backend API (FastAPI + MongoDB)
- [x] POST /api/auth/login — JWT avec rôles
- [x] GET /api/auth/me
- [x] GET/POST /api/projects
- [x] GET/PUT /api/projects/:id
- [x] GET/POST /api/tasks (avec project_id obligatoire + validation tenant)
- [x] PUT /api/tasks/:id
- [x] 46 tâches seedées (5-7 par projet, types variés, données cohérentes)
- [x] GET /api/allocations?project_id=
- [x] GET /api/milestones?project_id=
- [x] GET /api/governance
- [x] GET /api/dashboard/summary
- [x] Multi-tenant isolation (tenant_id filtering)
- [x] Role-based access (READ_ONLY bloqué sur POST/PUT)

### Frontend (React)
- [x] Page Login — dark navy, comptes démo pré-remplis
- [x] Layout — sidebar dark, topbar, navigation
- [x] Dashboard — 4 metric cards, bar chart budgets, pie chart RAG, projets récents
- [x] Portfolio — table sortable + filtres (RAG, méthodo, recherche), badges visuels
- [x] ProjectDetail — alertes dépassement, budget avec barres, jalons, allocations
- [x] Resources — table avec taux de charge calculé
- [x] Gouvernance — cards expandables avec rapport sanity check

### Données de seed
- [x] 1 tenant : Groupe Altair Industries
- [x] 3 utilisateurs (Admin, PMO, Viewer)
- [x] 8 projets CAC 40 style (mix waterfall/agile/safe, mix green/orange/red)
- [x] 10 ressources (Ressource_01 à Ressource_10)
- [x] 18 allocations
- [x] 21 jalons (mix planned/at_risk/delayed/achieved)
- [x] 5 instances de gouvernance

## Tests
- Backend : 16/16 tests passés (100%)
- Frontend : 90% — tous les flows principaux vérifiés

## Backlog prioritaire

### P0 — Critique
- [ ] Aucun élément bloquant

### P1 — Important pour prochaine version
- [ ] Création/édition de projet via formulaire UI (modal)
- [ ] Filtrage portfolio par date/sponsor/programme
- [ ] Export PDF/Excel du rapport de portefeuille
- [ ] Notifications temps réel (milestones en retard)

### P2 — Améliorations
- [ ] Gestion multi-tenant admin panel
- [ ] Timeline Gantt pour les jalons
- [ ] Module d'import depuis Clarity PPM / Jira via CSV
- [ ] Historique des modifications (audit log)
- [ ] Dashboard personnalisable par utilisateur
- [ ] Support de plusieurs tenants avec routing par sous-domaine

## Notes architecture importantes
- La solution utilise MongoDB (au lieu de PostgreSQL demandé) pour respecter les contraintes d'environnement
- L'isolation multi-tenant est assurée par filtrage `tenant_id` sur chaque requête (vs séparation de schémas PostgreSQL)
- JWT local sans AWS Cognito réel — signature HS256 avec secret en .env
