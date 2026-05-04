# Projetenne — PRD Exhaustif
> État complet au 04 Mai 2026 — Version livrée en production

---

## 1. Vue d'ensemble

**Projetenne** est une application SaaS multi-tenant de gestion de portefeuille de projets (PPM).
- **Architecture** : React 18 (Tailwind CSS + Shadcn/UI) + FastAPI (Python 3.11) + MongoDB Atlas
- **Auth** : JWT HS256, rate-limiting par email (10/min), RBAC par profil
- **Multi-tenant** : Isolation stricte par `tenant_id` sur toutes les collections MongoDB
- **Modules activables** : Par tenant via `/admin/config` (modules ON/OFF)
- **IA embarquée** : Claude Sonnet (Anthropic) via Emergent LLM Key
- **Responsive** : Mobile (<768px), Tablette (768–1279px), Desktop (≥1280px)

---

## 2. Pages Frontend (28 pages)

| Route | Composant | Description | Permission minimale |
|---|---|---|---|
| `/login` | `Login.jsx` | Authentification (email+mdp, rate-limit) | — |
| `/dashboard` | `Dashboard.jsx` | KPIs portefeuille, charts RAG, budget, heatmap risques | `dashboard.view` |
| `/portfolio` | `Portfolio.jsx` | Liste projets avec filtres RAG/statut/programme | `portfolio.view` |
| `/projects/:id` | `ProjectDetail.jsx` | Détail projet : budget, risques, tâches, jalons, scope, équipe | `portfolio.view` |
| `/programs` | `Programs.jsx` | Gestion des programmes | `portfolio.view` |
| `/programs/:id` | `ProgramDetail.jsx` | Détail programme avec OKRs et dashboard | `portfolio.view` |
| `/roadmap` | `Roadmap.jsx` | Gantt portfolio + timeline projets | `roadmap.view` |
| `/scope` | `Scope.jsx` | Arbitrage scope : Kanban par statut, snapshots, GRC, transmission | `scope.*` |
| `/budget` | `Budget.jsx` | Budget consolidé : KPIs CAPEX/OPEX, graphiques, révisions, export | `budget.view` |
| `/arbitrage` | `Arbitrage.jsx` | Arbitrage portefeuille : scoring, scénarios, chart radar | `arbitrage.view` |
| `/timesheets` | `Timesheets.jsx` | Saisie/validation des imputations de temps | `timesheets.*` |
| `/demands` | `Demands.jsx` | Workflow demandes de projet (4 états) | `demands.*` |
| `/governance` | `Governance.jsx` | Décisions de gouvernance + jalons réglementaires | `governance.view` |
| `/teams` | `Teams.jsx` | Gestion équipes + alertes capacité | `teams.view` |
| `/teams/:id` | `TeamDetail.jsx` | Détail équipe : membres, allocations, capacité | `teams.view` |
| `/resources` | `Resources.jsx` | Référentiel ressources (internes + prestataires) | `portfolio.view` |
| `/safe/trains` | `TrainsSafe.jsx` | SAFe ART : trains, PIs, sprints, capacités | `trains.view` |
| `/vendors` | `Vendors.jsx` | Suivi fournisseurs : contrats, consommation | `vendors.view` |
| `/conformite` | `Conformite.jsx` | Tableau de bord conformité réglementaire | `compliance.view` |
| `/import` | `Import.jsx` | Import CSV projets/ressources avec prévisualisation | `import.csv` |
| `/admin/config` | `AdminConfig.jsx` | Configuration tenant : modules, enums, seuils, workflows | `admin.config` |
| `/admin/users` | `AdminUsers.jsx` | Gestion utilisateurs (CRUD, reset mdp) | `admin.users` |
| `/admin/profiles` | `AdminProfiles.jsx` | Gestion profils RBAC (permissions granulaires) | `admin.profiles` |
| `/admin/powerbi` | `AdminPowerBI.jsx` | Connecteur Power BI : clé API, endpoints, tutoriel | `admin.config` |
| `/admin/connectors` | `Connectors.jsx` | Connecteurs externes : SAP, Jira, ServiceNow | `admin.config` |
| `/admin/agent-analytics` | `AgentAnalytics.jsx` | Statistiques d'usage de l'Agent IA | `admin.config` |
| `/agent/recommandations` | `Recommandations.jsx` | Recommandations IA du portefeuille | `agent.recommend` |
| `/agent/alertes` | `MesAlertes.jsx` | Règles d'alertes personnalisées (Agent IA) | `agent.alerts` |

---

## 3. Composants réutilisables (26 composants)

| Composant | Rôle |
|---|---|
| `Layout.jsx` | Shell principal : sidebar responsive (drawer mobile, hover tablette, fixe desktop), header, AgentDrawer |
| `AgentDrawer.jsx` | Drawer IA flottant (chat multi-sessions, contexte projet) |
| `RAGBadge.jsx` | Badge statut Rouge/Ambre/Vert |
| `RiskHeatmap.jsx` | Heatmap 5×5 probabilité × impact |
| `ProjectGantt.jsx` | Gantt SVG personnalisé (jalons, tâches, dépendances) |
| `TaskTreeView.jsx` | Vue arborescente des tâches (WBS) |
| `OKRDashboard.jsx` | Tableau OKRs avec WSJF scoring |
| `PIPlanning.jsx` | Interface PI Planning SAFe |
| `CapacityHeatmap.jsx` | Heatmap capacité équipes |
| `CapacityAlertBanner.jsx` | Bannière alertes dépassement capacité |
| `ExportCopilModal.jsx` | Export PPT/PDF COPIL |
| `BudgetRevisionModal.jsx` | Révision EAC avec historique |
| `ConvertProjectModal.jsx` | Conversion demande → projet |
| `ProjectModal.jsx` | CRUD projet (formulaire complet) |
| `RiskModal.jsx` | CRUD risque |
| `MilestoneModal.jsx` | CRUD jalon |
| `TaskModal.jsx` | CRUD tâche |
| `TeamModal.jsx` | CRUD équipe |
| `ResourceModal.jsx` | CRUD ressource |
| `ProgramModal.jsx` | CRUD programme |
| `DemandModal.jsx` | CRUD demande de projet |
| `DecisionModal.jsx` | CRUD décision de gouvernance |
| `DependencyModal.jsx` | Gestion dépendances inter-projets |
| `WorkAllocationModal.jsx` | Allocation temps ressource/projet |
| `NotificationBell.jsx` | Cloche notifications temps réel (WebSocket) |
| `ConfirmDialog.jsx` | Dialog de confirmation générique |

---

## 4. Modules Backend (33 modules)

| Module | Préfixe | Rôle |
|---|---|---|
| `auth` | `/api/auth` | Login JWT, profil courant |
| `projects` | `/api/projects` | CRUD projets + révision budget + RAF |
| `programs` | `/api/programs` | CRUD programmes |
| `dashboard` | `/api/dashboard` | KPIs consolidés, heatmap risques, top risques |
| `risks` | `/api/risks` | CRUD risques |
| `milestones` | `/api/milestones` | CRUD jalons + jalons réglementaires + export CSV |
| `tasks` | `/api/tasks` | CRUD tâches + workflow phase + historique |
| `scope` | `/api/scope` | Kanban scope, snapshots, transmission, Gantt, export Excel |
| `timesheets` | `/api/timesheets` | Saisie, soumission, validation, rapport CSV |
| `teams` | `/api/teams` | CRUD équipes, alertes capacité, heatmap |
| `resources` | `/api/resources` | CRUD ressources |
| `allocations` | `/api/allocations` | Vue globale allocations ressources |
| `work_allocations` | `/api/work-allocations` | Allocations temps par projet |
| `leaves` | `/api/leaves`, `/api/holidays` | Congés, jours fériés |
| `demands` | `/api/demands` | Workflow demandes (draft→submitted→approved→converted) |
| `decisions` | `/api/decisions` | CRUD décisions de gouvernance |
| `governance` | `/api/governance` | Vue synthèse gouvernance |
| `notifications` | `/api/notifications` | CRUD notifs + WebSocket unread count |
| `export` | `/api/export` | Export COPIL PPT/PDF |
| `csv_import` | `/api/import` | Import CSV preview + commit |
| `arbitrage` | `/api/arbitrage` | Scoring, scénarios, enveloppes CAPEX/OPEX, export PDF |
| `budget` | `/api/budget` | Budget consolidé : KPIs, par programme, révisions, export Excel/PDF |
| `okrs` | `/api/okrs`, `/api/capabilities` | OKRs, WSJF, dashboard programme |
| `safe` | `/api/safe` | Trains ART, PIs, sprints, capacités SAFe |
| `connectors` | `/api/connectors` | SAP/Jira/ServiceNow (config, test, sync, logs) |
| `profiles` | `/api/profiles`, `/api/admin/users` | Profils RBAC (17 profils), gestion utilisateurs |
| `admin_config` | `/api/admin/config` | Config tenant : modules, enums, workflows, seuils, PPT branding |
| `tenant` | `/api/tenant` | Paramètres tenant |
| `agent` | `/api/agent` | Chat IA (Claude Sonnet), recommandations, règles alertes, analytics |
| `project_dependencies` | `/api/project-dependencies` | Dépendances inter-projets |
| `powerbi` | `/api/powerbi`, `/api/admin/powerbi` | Connecteur Power BI (6 endpoints + gestion clé API) |
| `dashboard` | `/api/programme/dashboard` | Dashboard programme/OKR |

---

## 5. Endpoints Power BI (9 endpoints)

| Méthode | Endpoint | Champs retournés | Filtre date |
|---|---|---|---|
| GET | `/api/powerbi/projects` | id, name, program, methodology, status, rag, capex_budget, opex_budget, capex_consumed, opex_consumed, eac, raf, start_date, end_date, owner | `from_date` / `to_date` → filtre chevauchement start/end |
| GET | `/api/powerbi/resources` | id, name, role, team, type, vendor, tjm, availability_rate, capacity_jh | Non (référentiel stable) |
| GET | `/api/powerbi/timesheets` | resource_name, project_name, date, jh, status | `from_date` / `to_date` → filtre sur date entrée. Ligne synthétique jh=0 si non saisi |
| GET | `/api/powerbi/budget` | project_name, program, capex_prev, capex_cons, opex_prev, opex_cons, eac, raf, ecart_pct | Même que projects |
| GET | `/api/powerbi/risks` | project_name, name, probability, impact, criticality, category, status | `from_date` / `to_date` → filtre updated_at |
| GET | `/api/powerbi/milestones` | project_name, name, family, type, date, days_remaining, attribute, status | `from_date` / `to_date` → filtre date jalon |
| GET | `/api/admin/powerbi/key` | has_key, masked_key | — |
| POST | `/api/admin/powerbi/generate-key` | api_key | — |
| DELETE | `/api/admin/powerbi/revoke-key` | revoked | — |

**Auth** : `Authorization: Bearer <JWT>` (permission `export.powerbi`) **OU** `X-API-Key: pbi-xxx`

---

## 6. Tous les endpoints (195 routes)

### auth (2)
- `POST /api/auth/login`
- `GET /api/auth/me`

### projects (8)
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{id}`
- `PUT /api/projects/{id}`
- `DELETE /api/projects/{id}`
- `GET /api/projects/{id}/raf`
- `GET /api/projects/{id}/team-consumption`
- `POST /api/projects/{id}/budget-revision`

### programs (5)
- `GET /api/programs`
- `POST /api/programs`
- `GET /api/programs/{id}`
- `PUT /api/programs/{id}`
- `DELETE /api/programs/{id}`

### dashboard (3)
- `GET /api/dashboard/summary`
- `GET /api/dashboard/heatmap-risks`
- `GET /api/dashboard/top-risks`

### risks (4)
- `GET /api/risks`
- `POST /api/risks`
- `PUT /api/risks/{id}`
- `DELETE /api/risks/{id}`

### milestones (7)
- `GET /api/milestones`
- `POST /api/milestones`
- `PUT /api/milestones/{id}`
- `DELETE /api/milestones/{id}`
- `GET /api/milestones/regulatory`
- `GET /api/milestones/regulatory/kpis`
- `GET /api/milestones/regulatory/csv`

### tasks (7)
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/{id}`
- `DELETE /api/tasks/{id}`
- `POST /api/tasks/{id}/transition`
- `PUT /api/tasks/{id}/phase-estimates`
- `GET /api/tasks/{id}/phase-history`

### scope (10)
- `GET /api/scope/candidates`
- `GET /api/scope/capacity`
- `GET /api/scope/export-excel`
- `PATCH /api/scope/tasks/{id}/status`
- `GET /api/scope/snapshots`
- `POST /api/scope/snapshots`
- `GET /api/scope/snapshots/{id}`
- `POST /api/scope/snapshots/{id}/gantt-compute`
- `POST /api/scope/snapshots/{id}/transmit`
- `GET /api/scope/snapshots/{id}/export-excel`

### timesheets (9)
- `GET /api/timesheets/grid`
- `PUT /api/timesheets/entry`
- `POST /api/timesheets/submit-week`
- `GET /api/timesheets/validation`
- `POST /api/timesheets/validate`
- `POST /api/timesheets/reject`
- `GET /api/timesheets/pending-count`
- `GET /api/timesheets/report`
- `GET /api/timesheets/report/csv`

### teams (7)
- `GET /api/teams`
- `POST /api/teams`
- `GET /api/teams/{id}`
- `PUT /api/teams/{id}`
- `DELETE /api/teams/{id}`
- `GET /api/teams/capacity-alerts`
- `GET /api/teams/capacity-heatmap`

### resources (3)
- `GET /api/resources`
- `POST /api/resources`
- `PUT /api/resources/{id}`
- `DELETE /api/resources/{id}` _(4 routes)_
- `GET /api/vendors/summary`
- `GET /api/vendors/project/{id}`
- `GET /api/vendors/export/csv`

### allocations + work-allocations (5)
- `GET /api/allocations`
- `GET /api/projects/{id}/work-allocations`
- `POST /api/work-allocations`
- `PUT /api/work-allocations/{id}`
- `DELETE /api/work-allocations/{id}`

### leaves (3)
- `GET /api/leaves/month`
- `PUT /api/leaves/entry`
- `GET /api/holidays`

### demands (7)
- `GET /api/demands`
- `POST /api/demands`
- `GET /api/demands/{id}`
- `PUT /api/demands/{id}`
- `DELETE /api/demands/{id}`
- `PATCH /api/demands/{id}/transition`
- `POST /api/demands/{id}/convert`
- `POST /api/demands/seed`

### decisions (4)
- `GET /api/decisions`
- `POST /api/decisions`
- `PUT /api/decisions/{id}`
- `DELETE /api/decisions/{id}`

### governance (1)
- `GET /api/governance`

### notifications (5)
- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/{id}/read`
- `POST /api/notifications/read-all`

### export (1)
- `POST /api/export/copil` (PPT + PDF via python-pptx)

### csv_import (3)
- `GET /api/import/template/{entity}`
- `POST /api/import/preview`
- `POST /api/import/commit`

### arbitrage (13)
- `GET /api/arbitrage/summary`
- `GET /api/arbitrage/weights`
- `PUT /api/arbitrage/weights`
- `PATCH /api/arbitrage/projects/{id}/scoring`
- `GET /api/arbitrage/scenarios`
- `POST /api/arbitrage/scenarios`
- `GET /api/arbitrage/scenarios/{id}`
- `DELETE /api/arbitrage/scenarios/{id}`
- `POST /api/arbitrage/scenarios/{id}/apply`
- `GET /api/arbitrage/envelopes`
- `POST /api/arbitrage/envelopes`
- `DELETE /api/arbitrage/envelopes/{id}`
- `GET /api/arbitrage/export-pdf`

### budget (6)
- `GET /api/budget/consolidated`
- `GET /api/budget/by-program`
- `GET /api/budget/project/{id}/revisions`
- `POST /api/budget/project/{id}/revise`
- `GET /api/budget/export/excel`
- `GET /api/budget/export/pdf`

### okrs (6)
- `GET /api/okrs`
- `POST /api/okrs`
- `PUT /api/okrs/{id}`
- `DELETE /api/okrs/{id}`
- `PUT /api/capabilities/{id}/wsjf`
- `GET /api/programme/dashboard`

### safe (16)
- `GET /api/safe/trains` + `POST` + `GET {id}` + `PUT {id}` + `DELETE {id}` + `GET {id}/overview`
- `GET /api/safe/pis` + `POST` + `PUT {id}` + `DELETE {id}`
- `GET /api/safe/sprints` + `POST` + `PUT {id}` + `DELETE {id}`
- `GET /api/safe/capabilities` + `POST` + `PUT {id}` + `DELETE {id}`

### connectors (7)
- `GET /api/connectors`
- `GET /api/connectors/{type}/config`
- `PUT /api/connectors/{type}/config`
- `PUT /api/connectors/{type}/mapping`
- `POST /api/connectors/{type}/test`
- `POST /api/connectors/{type}/sync`
- `GET /api/connectors/{type}/logs`
- `GET /api/connectors/{type}/status`

### profiles + admin-users (11)
- `GET /api/profiles`
- `POST /api/profiles`
- `GET /api/profiles/{id}`
- `PUT /api/profiles/{id}`
- `DELETE /api/profiles/{id}`
- `POST /api/profiles/{id}/duplicate`
- `POST /api/profiles/seed`
- `POST /api/profiles/seed-full`
- `GET /api/profiles/permissions`
- `GET /api/admin/users`
- `PATCH /api/admin/users/{id}`

### admin_config (8)
- `GET /api/admin/config`
- `POST /api/admin/config/seed`
- `PUT /api/admin/config/modules`
- `PUT /api/admin/config/enums`
- `PUT /api/admin/config/thresholds`
- `PUT /api/admin/config/workflows`
- `PUT /api/admin/config/holidays`
- `PUT /api/admin/config/ppt-branding`

### tenant (2)
- `GET /api/tenant/settings`
- `PUT /api/tenant/settings`

### agent (9)
- `POST /api/agent/chat`
- `GET /api/agent/sessions`
- `GET /api/agent/sessions/{id}/history`
- `GET /api/agent/recommendations`
- `GET /api/agent/recommendations/export-excel`
- `GET /api/agent/recommendations/export-pdf`
- `GET /api/agent/alert-rules`
- `POST /api/agent/alert-rules`
- `PUT /api/agent/alert-rules/{id}`
- `DELETE /api/agent/alert-rules/{id}`
- `GET /api/admin/agent-analytics`

### project_dependencies (5)
- `GET /api/project-dependencies`
- `GET /api/project-dependencies/all`
- `POST /api/project-dependencies`
- `PUT /api/project-dependencies/{id}`
- `DELETE /api/project-dependencies/{id}`

### powerbi (9)
- `GET /api/powerbi/projects?from_date=&to_date=`
- `GET /api/powerbi/resources`
- `GET /api/powerbi/timesheets?from_date=&to_date=`
- `GET /api/powerbi/budget?from_date=&to_date=`
- `GET /api/powerbi/risks?from_date=&to_date=`
- `GET /api/powerbi/milestones?from_date=&to_date=`
- `GET /api/admin/powerbi/key`
- `POST /api/admin/powerbi/generate-key`
- `DELETE /api/admin/powerbi/revoke-key`

---

## 7. Profils RBAC (17 profils système + profils custom)

| Code | Nom | Permissions clés |
|---|---|---|
| `ADMIN` | Administrateur Système | `*` (toutes) |
| `CIO` | Direction SI | portfolio, roadmap, budget, arbitrage, agent, **export.powerbi** |
| `PORTFOLIO` | PMO Portefeuille | portfolio, roadmap, arbitrage, budget, scope, **export.powerbi** |
| `CHEF_DE_PROJET` | Chef de Projet | projects.write, risks, tasks, milestones |
| `TEAM_LEAD` | Team Leader | teams, timesheets, allocations |
| `CONTRIBUTEUR` | Contributeur | timesheets.own, tasks.view |
| `FINANCE` | Finance / Contrôle de gestion | budget, arbitrage, vendors, **export.powerbi** |
| `RH` | Ressources Humaines | resources, teams, leaves |
| `ACHETEUR` | Achats | vendors |
| `ARCHITECTE` | Architecte SI | tasks, scope, dependencies |
| `SCRUM_MASTER` | Scrum Master | safe, tasks, timesheets |
| `CONSULTANT` | Consultant Externe | timesheets.own, tasks.view |
| `CONFORMITE` | Conformité / Audit | compliance, milestones, decisions |
| `SPONSOR` | Sponsor Projet | portfolio.view, budget.view, agent.view |
| `VIEWER` | Lecteur seul | dashboard.view, portfolio.view |
| `SUPPORT` | Support IT | admin.users |
| `OBSERVATEUR` | Observateur Externe | dashboard.view |

---

## 8. Fichiers de tests (42 fichiers, ~80 tests unitaires)

| Fichier | Couverture |
|---|---|
| `test_projects_crud.py` | CRUD projets, filtres, pagination |
| `test_auth_rbac.py` | Login, JWT, RBAC, permissions |
| `test_profiles_rbac.py` | Profils, seed, permissions, isolation tenant |
| `test_projetenne.py` | Tests d'intégration généraux (suite principale) |
| `test_sprint0_modular.py` | Modularisation, routing |
| `test_s1_01_teams.py` | Équipes, membres, capacité |
| `test_s1_05_07_work_allocations.py` | Allocations temps |
| `test_s1_08_09_ppt_heatmap.py` | Export PPT, heatmap |
| `test_s2_roadmap.py` | Roadmap, Gantt |
| `test_s3_timesheets.py` | Timesheets saisie/soumission |
| `test_timesheets_wf.py` | Workflow validation/rejet timesheets |
| `test_timesheets_workflow.py` | Workflow complet timesheets |
| `test_safe_chantier3.py` | SAFe trains, PIs, sprints |
| `test_scope_module.py` | Scope candidates, snapshots |
| `test_scope_new_features.py` | Scope Kanban, transmission |
| `test_scope_wf.py` | Workflow scope complet |
| `test_permissions_chantier.py` | Permissions granulaires |
| `test_chantier6.py` | Module arbitrage |
| `test_chantier6_bugfix.py` | Bugfixes arbitrage |
| `test_chantier7.py` | Agent IA, recommandations |
| `test_chantier8_decisions.py` | Décisions de gouvernance |
| `test_demands.py` | Workflow demandes |
| `test_export_copil.py` | Export COPIL PPT/PDF |
| `test_items_13_19.py` | Améliorations MARCEL items 13-19 |
| `test_iteration29_branding_timesheet.py` | Branding PPT, timesheets rapports |
| `test_agent.py` | Chat Agent IA sessions |
| `test_agent_wf.py` | Workflow alertes Agent IA |
| `test_okr_wsjf_lot5.py` | OKRs, WSJF, dashboard programme |
| `test_ownership_filtering.py` | Filtrage par propriétaire |
| `test_milestones_deps.py` | Jalons, dépendances |
| `test_regulatory.py` | Jalons réglementaires |
| `test_leaves_p1.py` | Congés, jours fériés |
| `test_stream2.py` | Features stream 2 |
| `test_admin_config.py` | Configuration admin, modules |
| `test_connectors.py` | Connecteurs SAP/Jira/ServiceNow |
| `test_vendors_bloc2.py` | Suivi fournisseurs |
| `test_tasks.py` | Tâches CRUD + workflow phase |
| `test_team_detail.py` | Détail équipe |
| `test_misc_modules.py` | Notifications, feuilles, divers |
| `test_budget_module.py` | Module budget consolidé |
| `test_arbitrage.py` | Arbitrage scores, scénarios |
| `test_powerbi_connector.py` | Connecteur Power BI (endpoints + auth) |

---

## 9. Collections MongoDB (20 collections)

| Collection | Contenu |
|---|---|
| `users` | Comptes utilisateurs (email, role, tenant_id, hashed_password) |
| `projects` | Projets (budget CAPEX/OPEX, RAG, métadonnées) |
| `programs` | Programmes portefeuille |
| `risks` | Risques (probabilité, impact, criticité) |
| `milestones` | Jalons (famille, type, date, statut) |
| `tasks` | Tâches (phases, workflow, charges) |
| `teams` | Équipes et membres |
| `resources` | Ressources (TJM, disponibilité, type) |
| `work_allocations` | Allocations temps ressource/projet |
| `timesheets` | Saisies de temps (entries par semaine) |
| `leaves` | Congés et absences |
| `demands` | Demandes de projet (workflow 4 états) |
| `decisions` | Décisions de gouvernance |
| `notifications` | Notifications utilisateurs |
| `agent_sessions` | Sessions de chat IA |
| `agent_alert_rules` | Règles d'alertes personnalisées |
| `scope_snapshots` | Snapshots d'arbitrage scope |
| `arbitrage_scenarios` | Scénarios d'arbitrage portefeuille |
| `portfolio_envelopes` | Enveloppes CAPEX/OPEX |
| `tenant_config` | Config tenant (modules, enums, workflows, powerbi_api_key) |

---

## 10. Responsive Design

| Viewport | Sidebar | KPIs | Modals | Padding |
|---|---|---|---|---|
| Mobile (<768px) | Drawer overlay (hamburger) | 1 colonne | `rounded-none`, fullscreen | `p-4` |
| Tablette (768–1279px) | 60px icônes, hover→240px | 2×2 | `rounded-none sm:rounded-xl` | `p-4 md:p-6` |
| Desktop (≥1280px) | Toujours 240px avec labels | 4 colonnes | `rounded-xl` | `p-4 md:p-6 lg:p-8` |

---

## 11. Intégrations 3rd Party

| Service | Usage | Status |
|---|---|---|
| **Anthropic Claude Sonnet** | Agent IA PMO (chat, recommandations, alertes) | ✅ Actif (Emergent LLM Key) |
| **SAP BAPI RFC** | Synchronisation budgets SAP | ⚠️ Mocké (pyrfc absent) |
| **Jira Cloud** | Sync tâches et sprints | ⚠️ Mocké |
| **ServiceNow** | Sync demandes | ⚠️ Mocké |
| **python-pptx** | Export COPIL PPT | ✅ Actif |
| **openpyxl/xlsxwriter** | Export Excel | ✅ Actif |
| **ReportLab/WeasyPrint** | Export PDF | ✅ Actif |
| **Power BI Desktop** | Connecteur Web (JSON flat arrays) | ✅ Actif |

---

## 12. Backlog Priorisé

### P1 — Court terme
- [ ] Template Power BI Desktop (.pbix) pré-câblé avec les 6 tables et relations
- [ ] Filtre `?program_id=` sur les endpoints Power BI (segmentation par programme)
- [ ] Webhook `/api/webhooks/project-updated` pour actualisation Power BI en push
- [ ] Installer `pyrfc` + SAP NW RFC SDK pour connectivité RFC native

### P2 — Moyen terme
- [ ] CI/CD pipeline GitHub Actions (pytest + lint)
- [ ] Module "Tableau de bord CxO" personnalisable (drag & drop widgets)
- [ ] Connecteur Microsoft Project (.mpp import/export)
- [ ] API REST publique documentée (Swagger/OpenAPI exposé)
- [ ] Notifications email (Resend) pour alertes critiques

### P3 — Long terme
- [ ] Mobile app React Native (vue PMO légère)
- [ ] Module BI intégré (remplace Power BI pour les PME sans licence)
- [ ] AI Planning Assistant (prévision charge + recommandation allocation)

---

*Document généré automatiquement le 04 Mai 2026*
