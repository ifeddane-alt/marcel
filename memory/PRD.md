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

### Chantier 3 — CRUD complet depuis UI (COMPLET — v1.3)
- [x] Bouton "+ Nouveau projet" Portfolio (ADMIN + PMO) · modal création avec tous champs
- [x] Clic ligne Portfolio → modal édition pré-rempli · bouton Supprimer avec confirmation (ADMIN)
- [x] Bouton "Modifier" + "Supprimer" sur Détail Projet (rôles respectés)
- [x] Bouton "+ Nouvelle tâche" sur Détail Projet · clic ligne tâche → édition · suppression (ADMIN)
- [x] Bouton "+ Nouvelle ressource" sur page Ressources · édition · suppression (ADMIN)
- [x] Bouton "+ Nouveau programme" sur page Programmes · édition · suppression (ADMIN)
- [x] Backend : DELETE /api/projects (cascade tasks+milestones), POST/PUT/DELETE /api/resources
- [x] Composants : Modal, ProjectModal, TaskModal, ResourceModal, ProgramModal, ConfirmDialog
- [x] READ_ONLY : 0 bouton d'action · PMO : create/edit sans delete · ADMIN : CRUD complet
- [x] Tests 100% — 22/22 (iteration_6.json)



### Chantier 1 — Tâches (COMPLET)
- [x] GET/POST/PUT/DELETE /api/tasks — isolation tenant, READ_ONLY bloqué
- [x] 46 tâches seedées (5-7 par projet), mini-RAG calculé automatiquement
- [x] Section "Décomposition du projet" complète : tableau 11 colonnes, badges RAG, indicateurs dérive, totaux landing

### Chantier 4 — Programmes (COMPLET — v1.2)
- [x] Collection `programs` : program_id, tenant_id, name, description, owner, dates, budget_keur, status
- [x] Champ `program_id` optionnel sur projets
- [x] GET/POST/PUT/DELETE /api/programs — avec agrégation auto (budget consolidé, RAG worst-case, project_count)
- [x] GET /api/programs/:id — détail avec projects[], milestones[], metrics{}
- [x] Page Programmes (/programmes) — cartes avec RAG, budget, barres de consommation
- [x] Page Détail Programme (/programmes/:id) — table projets, totaux, jalons agrégés, distribution RAG
- [x] Filtre "Programme" sur page Portfolio + sous-titre programme sur chaque ligne projet
- [x] Seed : 3 programmes couvrant les 8 projets Altair Industries
- [x] Tests 100% backend + frontend (iteration_5.json)

- [x] Collection `tasks` avec champs `budget_landing`, `jh_landing`, `task_rag`, `rag_details`
- [x] Calcul RAG automatique côté backend (GET /api/tasks) basé sur seuils configurables/tenant
- [x] GET/PUT /api/tenants/settings — seuils budget_threshold_pct et delay_threshold_days
- [x] Badges RAG colorés par tâche (vert/orange/rouge) dans la table ProjectDetail
- [x] Résumé RAG (compteurs verts/orange/rouges) + couverture budget/JH en en-tête de section
- [x] Footer TOTAUX : Budget landing (taskTotals.budget_landing) et JH landing (taskTotals.jh_landing) **[FIXÉ P0]**
- [x] Footer DONNÉES PROJET : budget forecast projet au lieu de budget consommé **[FIXÉ P0]**
- [x] Coloration conditionnelle rose si landing > prévu, vert sinon
- [x] Tests 100% — frontend validé par testing agent (iteration_3.json)


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

## Ce qui est implémenté (v1.3 — 03/02/2026)

### P0 — En cours
- [x] **Chantier 3** — CRUD complet ✅ (livré v1.3)
- [ ] **Chantier 2** — Import CSV (câblage terminé, en test)
- [ ] **Chantier 6** — Budget CAPEX/OPEX + EAC + historique révisions
- [ ] **Chantier 7** — Registre des risques
- [ ] **Chantier 8** — Registre des décisions
- [ ] **Chantier 5** — Export PowerPoint COPIL (python-pptx)

## Notes architecture importantes
- Stack définitive : FastAPI + MongoDB + React/JSX (pas de migration)
- L'isolation multi-tenant est assurée par filtrage `tenant_id` sur chaque requête
- JWT local sans AWS Cognito réel — signature HS256 avec secret en .env
