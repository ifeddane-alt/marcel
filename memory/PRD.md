# PRD — Projetenne (PPM SaaS Multi-Tenant)

## Problème Résolu
Plateforme SaaS de gestion de portefeuilles projets (PPM) pour grandes entreprises.
Multi-tenant avec isolation stricte des données et RBAC granulaire par profils.

## Architecture Technique
- **Frontend** : React 18, TailwindCSS, Recharts, Frappe-Gantt, Lucide-React
- **Backend** : FastAPI (Python 3.11), Motor (MongoDB async)
- **DB** : MongoDB multi-tenant via `tenant_id` sur chaque collection
- **Auth** : JWT custom + profils dynamiques avec `permissions[]` par profil
- **URL** : https://project-sync-61.preview.emergentagent.com

## Utilisateurs Démo
| Email | Mot de passe | Profil | Rôle legacy |
|-------|---|---|---|
| admin@altair.fr | Admin1234! | ADMIN (tous droits) | TENANT_ADMIN |
| pmo@altair.fr | Pmo1234! | PORTFOLIO | PMO_USER |
| viewer@altair.fr | View1234! | CIO | READ_ONLY |
| cp@altair.fr | Altair2026! | CHEF_DE_PROJET | — |
| manager@altair.fr | Altair2026! | MANAGER | — |
| user@altair.fr | Altair2026! | USER | — |
| achats@altair.fr | Altair2026! | ACHATS | — |

---

## Streams Implémentés

### ✅ Stream 1 — Équipes, Ressources & Allocations
### ✅ Stream 2 — Roadmap, Dépendances & Export COPIL
### ✅ Stream 3 Base — Timesheets (saisie & validation simple)
### ✅ Stream 3 Enhancement — Workflow Multi-Acteurs
### ✅ P1 Congés & Absences (2026-02)
### ✅ Tableau de bord réglementaire - Conformité (2026-02 + 2026-04)
- Filtre programme ajouté (Bloc 1)

### ✅ Gestion de la Demande (2026-04)
- Vue Kanban + Table, workflow qualification, drag & drop
- 10 demandes de démo

### ✅ Bloc 2 — Profils & Habilitations (2026-04)

#### 2a. Système de profils dynamiques
- Collection `profiles` : 12 profils système par défaut
- 57 permissions granulaires (format module.action)
- Profils custom : créer, modifier, dupliquer, supprimer
- ADMIN : permissions figées (wildcard `*`)

#### 2b. Middleware permission_required
- Remplace `require_write` sur endpoints critiques
- Lit UNIQUEMENT `permissions[]` du token (jamais le code du profil)
- Fallback automatique vers role legacy (TENANT_ADMIN/PMO_USER/READ_ONLY)
- Permissions incluses dans le JWT au login

#### 2c. Enrichissement Ressources (COMPLET — 2026-04)
- Champs : `resource_type` (interne/externe_regie/externe_forfait)
- `vendor`, `contract_tjm`, `forfait_envelope`, `forfait_consumed`, `contract_start`, `contract_end`
- 5 ressources externes seedées : Capgemini, Accenture, Sopra Steria, IBM France, Atos
- ResourceModal 3 modes : Interne / Régie (champs vendor+TJM contrat) / Forfait (enveloppe+consommé+dates)
- Page Ressources : filtres par type (Tous/Interne/Régie/Forfait) + badges icône+texte dans la table

#### 2d. Pages Admin
- `/admin/profiles` : matrice permissions cochable par module, CRUD custom, duplication
- `/admin/users` : liste 7 users avec dropdown profil, filtre par profil
- AdminRoute guard : seul TENANT_ADMIN peut accéder (redirect → /dashboard sinon)

#### 2e. Suivi Fournisseurs (COMPLET — 2026-04)
- Page `/vendors` : Suivi Fournisseurs complet
  - KPI cards : nb fournisseurs, enveloppe TJM régie, forfait total, alertes actives
  - Cards par fournisseur (expandable) : section Régie (TJM contrat vs facturé, variance %) + section Forfait (barre progression, consommé/reste)
  - Alertes automatiques : variance TJM >10%, forfait >85%, contrats expirant <90j
  - Données démo : Accenture (20% variance TJM), Sopra Steria (91% forfait), Atos (contrat expirant mars 2026)
- Section "Coûts Externes Alloués" dans ProjectDetail (après EAC block)
  - Régie : JH alloués × TJM contractuel
  - Forfait : enveloppe + consommé
  - Pourcentage du budget total
- Sidebar nouvelle section "ACHATS / FINANCES" (visible si `vendors.view` ou `*`)
- API : `/api/vendors/summary`, `/api/vendors/project/{id}`

### ✅ Chantier 3 SAFe Structurel (2026-04)

#### 3a — Collections SAFe + CRUD
- Collections MongoDB : `trains`, `pis`, `sprints`, `capabilities`
- CRUD complet via module `/app/backend/modules/safe/`
- Train : ART Digital Banking · 2 PIs · 4 Sprints · 5 Capabilities
- Endpoint `/safe/trains/{id}/overview` : vue agrégée complète
- Permissions : `trains.create`, `trains.edit`, `trains.view`, `capabilities.create`

#### 3b — Hiérarchie Tasks SAFe
- `parent_id` (FK task→task) + `task_level` (task|feature|user_story) sur les tâches
- `lifecycle_phase` (backlog|review|analysis|implementation|test|hypercare|done|rejected) 
- `phase_estimates` (liste d'estimations par phase)
- Compatibilité ascendante : projets non-SAFe inchangés (task_level="task" par défaut)
- 5 tâches SAFe seedées sur Phoenix (2 features + 3 user stories avec parent_id)

#### 3c — TaskTreeView expandable
- Composant `TaskTreeView.jsx` : affichage hiérarchique feature→user_story
- Toggle 3 vues dans ProjectDetail : Liste | Gantt | **Arbre SAFe** (uniquement si tâches SAFe)
- Badges FEATURE (bleu) / USER STORY (violet) + badge phase lifecycle dans toutes les vues

#### 3d — Cycle de vie par phase + anti-rollback
- Endpoint `POST /tasks/{id}/transition` avec matrice de transitions valides
- Phases terminales (done, rejected) : aucune transition possible
- `phase_history` collection : historique complet horodaté par utilisateur
- Endpoint `GET /tasks/{id}/phase-history`

#### 3e — Estimations par phase
- `phase_estimates[]` sur tâches : [{phase, jh_estimated, jh_actual, notes}]
- Endpoint `PUT /tasks/{id}/phase-estimates`

#### 3f — Page Trains SAFe
- Page `/safe/trains` avec TrainsSafe.jsx
- Header train : vision, équipes, KPI cards (PIs, Sprints, Capabilities, Équipes)
- Répartition capabilities par statut (identifiée/committée/en cours/terminée)
- PI Panels expandables : objectifs, sprint cards avec vélocité, capabilities board (4 colonnes kanban)
- CRUD Capabilities inline (modal) sur chaque PI
- Sidebar : section "SAFE" avec "Trains SAFe" (visible pour `trains.view` ou `*`)

---

### Fournisseurs (Vendors)
| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/vendors/summary` | vendors.view |
| GET | `/api/vendors/project/{project_id}` | Tous authentifiés |

### Profils
| Méthode | Route | Permissions |
|---|---|---|
| GET | `/api/profiles` | Tous authentifiés |
| POST | `/api/profiles` | admin.profiles |
| PUT | `/api/profiles/{id}` | admin.profiles |
| DELETE | `/api/profiles/{id}` | admin.profiles (custom seulement) |
| POST | `/api/profiles/{id}/duplicate` | admin.profiles |
| GET | `/api/profiles/permissions` | Tous |
| POST | `/api/profiles/seed-full` | Tous |
| GET | `/api/admin/users` | admin.profiles |
| PATCH | `/api/admin/users/{id}` | admin.profiles |

### Demands
| Méthode | Route | Permission |
|---|---|---|
| POST | `/api/demands` | demands.submit |
| PATCH | `/api/demands/{id}/transition` | demands.qualify |
| POST | `/api/demands/{id}/convert` | demands.convert |

---

## Schéma DB Clé

```
profiles:      profile_id, tenant_id, name, code, description, permissions[], is_system
users:         user_id, tenant_id, email, name, role (legacy), profile_id (new)
resources:     resource_id, tenant_id, name, role, team_id, resource_type,
               vendor, contract_tjm, forfait_envelope, forfait_consumed,
               contract_start, contract_end, tjm_eur, availability_rate
demands:       demand_id, tenant_id, title, description, requester, urgency,
               status, priority_score, rejection_reason, converted_project_id
allocations:   allocation_id, project_id, resource_id, period_month, jh_allocated, jh_consumed
```

---

## Backlog Priorisé

### ✅ P0 — Chantier 3 SAFe (COMPLET — 2026-02)
- Trains SAFe, PIs, Sprints, Capabilities (CRUD complet)
- Hiérarchie capability → feature → user_story (parent_id + task_level)
- TaskTreeView expandable (bascule flat/tree dans ProjectDetail)
- Phase lifecycle (transitions anti-rollback)
- Phase estimates (JH/budget par phase)
- Page "Trains SAFe" dans sidebar

### ✅ P0 — Lot 4 (5 fonctionnalités — 2026-02) TESTÉ 100%
- **TaskModal SAFe** : task_level (tâche/feature/user_story) + parent_id + sprint_id
- **Sprint assignment** : assigner feature/US à un sprint depuis TaskModal et PI Planning
- **Export CSV contrats fournisseurs** : GET /api/vendors/export/csv
- **PI Planning Board** : kanban features dans sprints (composant PIPlanning)
- **Module OKR + WSJF auto + Dashboard Programme** :
  - CRUD complet OKRs (objectifs, key results, liaisons capabilities)
  - Calcul WSJF auto : (BV + TC + RR) / Job Size sur chaque capability
  - Dashboard Programme : KPIs, répartition caps, vélocité PI, leaderboard WSJF
  - Nouvel onglet "Dashboard Programme" dans Trains SAFe

### ✅ P0 — Chantier 4 Back-office Admin (COMPLET — 2026-02) TESTÉ 100%
- **Page /admin/config** : accès TENANT_ADMIN uniquement (AdminRoute + permission admin.config)
- **Section 1 — Modules** : 7 toggles on/off. Sidebar dynamique + API 403 si module désactivé
- **Section 2 — Workflows** : timesheets (2 ou 3 étapes, timeout CP, auto-validation), demands
- **Section 3 — Référentiels** : enums éditables (catégories risques, natures dépendances, statuts projets, urgences demandes)
- **Section 4 — Jours Fériés** : table CRUD + import prédéfini France 2026 / Maroc 2026
- **Section 5 — Alertes** : 7 seuils dynamiques appliqués dans les calculs d'alerte
- **Section 6 — Export PPT** : couleurs primaire/secondaire/accent, nom entreprise, police, logo base64
- **TenantConfigContext** : chargé au login, distribué dans toute l'app
- **Seed Altair** : POST /api/admin/config/seed

### ✅ P0 — Intégration Admin Config (COMPLET — 2026-02) TESTÉ 100% (Iteration 29)
- **PPT Branding** : `ppt_branding` appliqué dans tous les exports PPTX (couleur primaire dans les headers, `company_name` dans tous les pieds de page, logo sur la slide de garde)
- **MilestoneModal** : merge union des types hardcodés + types tenant pour toutes les familles (epic_lifecycle, epic_milestone, transversal) — déduplication par `value`
- **Workflow Timesheets** : `validation_steps` depuis `tenant_settings.workflows.timesheet`. Si 2 étapes : valideur N+1 → directly `validated` (bypass CP). Si 3 étapes : comportement standard `submitted → cp_reviewed → validated`

### ✅ P0 — Frontend Permissions (COMPLET — 2026-02) TESTÉ 100% (Iteration 30)
- **Hook `usePermissions`** (`/src/hooks/usePermissions.js`) : `hasPermission(perm)` + `hasAnyPermission()` + `canAccessNav()` — source unique de vérité pour tous les contrôles UI
- **Sidebar dynamique** : MAIN_NAV + MODULE_NAV filtrés par permissions. Admins voient tout + section Administration. USER ne voit que Timesheets. ACHATS voit Dashboard + Suivi Fournisseurs.
- **Header profil** : `profile_name` depuis le backend remplace le rôle legacy (`"Administrateur"`, `"PMO Portefeuille"`, `"Direction SI"`, `"Achats / Procurement"`, etc.)
- **DashboardGuard** : redirige automatiquement les profils sans `dashboard.view` vers `/timesheets` (ex: USER/Contributeur)
- **AdminRoute** : basé sur permissions `admin.*` au lieu de `role === TENANT_ADMIN`
- **Boutons d'action conditionnels** : 8 pages mises à jour (`Portfolio`, `ProjectDetail`, `Teams`, `Resources`, `Programs`, `Demands`, `Governance`, `Timesheets`) — `canCreate`, `canEdit`, `canDelete` via permissions granulaires
- **Backend** : `auth/router.py` retourne `profile_name` dans la réponse login
- **ACHATS** : `dashboard.view` ajouté au profil (DB + DEFAULT_PROFILES)

**Comptes de test validés :**
| Email | Mot de passe | Profil | Résultat test |
|-------|-------------|--------|---------------|
| admin@altair.fr | Admin2026! | Administrateur | Tout + Admin ✅ |
| pmo@altair.fr | **Pmo1234!** | PMO Portefeuille | Tout sauf Admin ✅ |
| viewer@altair.fr | View1234! | Direction SI (CIO) | Lecture seule, 0 bouton ✅ |
| cp@altair.fr | Altair2026! | Chef de Projet | Selon permissions ✅ |
| manager@altair.fr | Altair2026! | Manager | Selon permissions ✅ |
| user@altair.fr | Altair2026! | Contributeur | Redirect /timesheets ✅ |
| achats@altair.fr | Altair2026! | Achats / Procurement | Dashboard + Vendors ✅ |

### P1 — Futur
- Notifications temps réel (WebSocket)
- Import/Export Excel complet
- Multi-langue (i18n)

---

## Fichiers Clés
- `/app/backend/modules/profiles/` (service.py, router.py, schemas.py)
- `/app/backend/modules/demands/` (service.py, router.py)
- `/app/backend/modules/resources/` (service.py, router.py, schemas.py) ← vendor functions added
- `/app/backend/modules/safe/` (router.py, service.py, schemas.py) ← SAFe Trains/PIs/Sprints/Capabilities
- `/app/backend/modules/okrs/` (router.py, service.py, schemas.py) ← OKR + WSJF + Dashboard Programme
- `/app/backend/modules/tasks/` ← updated with task_level, parent_id, sprint_id, phase_history
- `/app/backend/core/auth.py` (permission_required, TokenPayload)
- `/app/frontend/src/pages/TrainsSafe.jsx` ← onglets: Vue d'ensemble | PI Planning | Dashboard Programme
- `/app/frontend/src/components/OKRDashboard.jsx` ← NEW: OKR CRUD + WSJF + Programme KPIs
- `/app/frontend/src/components/PIPlanning.jsx` ← NEW: kanban PI Planning board
- `/app/frontend/src/components/TaskTreeView.jsx` ← NEW: arbre hiérarchique tasks
- `/app/frontend/src/components/TaskModal.jsx` ← updated: task_level, parent_id, sprint_id
- `/app/frontend/src/pages/AdminProfiles.jsx`
- `/app/frontend/src/pages/AdminUsers.jsx`
- `/app/frontend/src/pages/Demands.jsx`
- `/app/frontend/src/pages/Vendors.jsx` ← CSV export
- `/app/frontend/src/pages/Resources.jsx` ← type filters + badges
- `/app/frontend/src/components/ResourceModal.jsx` ← 3-type mode
- `/app/frontend/src/pages/ProjectDetail.jsx` ← external costs section
- `/app/frontend/src/components/Layout.jsx` ← ACHATS/FINANCES sidebar section
- `/app/frontend/src/api/index.js` ← safeAPI, okrsAPI, vendorsAPI
