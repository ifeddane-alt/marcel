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
| projects | project_id, tenant_id, name, methodology, status_rag, status, budget_*, capex_*, opex_*, eac, budget_revision_history[], jh_*, dates, end_date_actual |
| resources | resource_id, tenant_id, name, role, capacity_jh_month, team |
| allocations | allocation_id, project_id, resource_id, period_month, jh_allocated, jh_consumed |
| milestones | milestone_id, project_id, name, date_baseline, date_forecast, status, is_governance |
| governance | governance_id, tenant_id, name, type, date_scheduled, projects_scope, sanity_check_* |

---

## Ce qui est implémenté (v1.4 — 13/04/2026)

### Chantier 6 — Budget CAPEX/OPEX + EAC + Révisions (COMPLET ✅)
- [x] Schema `projects` enrichi : `capex_planned`, `capex_consumed`, `opex_planned`, `opex_consumed`, `eac`, `budget_revision_history[]`, `end_date_actual`, `status`
- [x] `_sync_budget_aggregates()` : calcul auto `budget_total/consumed/forecast` depuis CAPEX+OPEX
- [x] `POST /api/projects/:id/budget-revision` : création entrée historique + mise à jour EAC
- [x] `ProjectDetail.jsx` : section "BUDGET CAPEX / OPEX & EAC" avec 2 cartes (CAPEX bleu / OPEX orange), bloc EAC + écart %, historique révisions timeline
- [x] `BudgetRevisionModal.jsx` : formulaire EAC + motif + auteur, bouton visible ADMIN+PMO, absent READ_ONLY
- [x] `ProjectModal.jsx` : champs CAPEX/OPEX en K€ (total auto-calculé live), dates renommées ("Fin prévue initiale (baseline)", "Fin prévue actuelle (forecast)", "Fin réelle"), dropdown Statut projet
- [x] `Portfolio.jsx` : filtre "Tous statuts" + badge ProjectStatusBadge sous le nom du projet
- [x] `RAGBadge.jsx` : export `ProjectStatusBadge` (en_preparation/actif/en_pause/cloture/archive)
- [x] Seed : 8 projets avec CAPEX/OPEX, statuts variés, historiques révisions réels
- [x] Tests 100% — 25/25 (iteration_8.json)

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

### Chantier 2 — Import CSV (COMPLET — v1.3)
- [x] Page Import (/import) — wizard 4 étapes drag-and-drop
- [x] POST /api/import/preview + POST /api/import/commit
- [x] Support projets, tâches, ressources
- [x] Mapping intelligent des colonnes
- [x] Tests 14/14 UI + 11 Chrome (validé user)

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

### Chantier 1 — Tâches (COMPLET)
- [x] GET/POST/PUT/DELETE /api/tasks — isolation tenant, READ_ONLY bloqué
- [x] 46 tâches seedées (5-7 par projet), mini-RAG calculé automatiquement
- [x] Section "Décomposition du projet" complète : tableau 11 colonnes, badges RAG, indicateurs dérive, totaux landing
- [x] Tests 100% — frontend validé (iteration_3.json)

### Infrastructure (COMPLET)
- [x] POST /api/auth/login — JWT avec rôles
- [x] Full CRUD projects, tasks, resources, programs, milestones, allocations
- [x] Dashboard — 4 metric cards, bar chart budgets, pie chart RAG
- [x] Portfolio — table sortable + filtres (RAG, méthodo, programme, statut)
- [x] ProjectDetail — alertes dépassement, budget CAPEX/OPEX/EAC, jalons, allocations, tâches
- [x] Resources — table avec taux de charge calculé
- [x] Gouvernance — cards expandables avec rapport sanity check
- [x] Multi-tenant isolation (tenant_id filtering)
- [x] Role-based access (READ_ONLY bloqué sur POST/PUT)

---

## Roadmap (Chantiers restants)

### P0 — En attente validation user
- [ ] **Chantier 6** ← LIVRÉ le 13/04/2026, en attente validation user

### P1 — Prochains chantiers
- [ ] **Chantier 7** — Registre des risques
  - Collection `risks` : probabilité × impact = criticité, catégories
  - CRUD dans ProjectDetail.jsx
  - Widget top 10 risques sur Dashboard
- [ ] **Chantier 8** — Registre des décisions
  - Collection `decisions` : date, statut, responsable
  - CRUD dans ProjectDetail.jsx et Governance.jsx
- [ ] **Chantier 5** — Export PowerPoint COPIL (python-pptx)
  - POST /api/export/copil
  - Slides : portfolio summary, RAG chart, budget, top risques

## Notes architecture importantes
- Stack définitive : FastAPI + MongoDB + React/JSX (pas de migration)
- L'isolation multi-tenant est assurée par filtrage `tenant_id` sur chaque requête
- JWT local sans AWS Cognito réel — signature HS256 avec secret en .env
- server.py > 1100 lignes — envisager split en routers/ si Chantier 7 ou 8 grossit significativement

## Données de seed (v1.4)
- 1 tenant : Groupe Altair Industries
- 3 utilisateurs (Admin, PMO, Viewer)
- 8 projets avec CAPEX/OPEX, statuts variés (actif/en_pause/en_preparation), révisions EAC
- 10 ressources (Ressource_01 à Ressource_10)
- 18 allocations, 21 jalons, 5 instances de gouvernance, 46 tâches
