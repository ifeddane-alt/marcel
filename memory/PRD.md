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

#### 2c. Enrichissement Ressources
- Champs : `resource_type` (interne/externe_regie/externe_forfait)
- `vendor`, `contract_tjm`, `forfait_envelope`, `forfait_consumed`
- `contract_start`, `contract_end`
- 3 ressources externes seedées (Capgemini ×2, Accenture ×1)

#### 2d. Pages Admin
- `/admin/profiles` : matrice permissions cochable par module, CRUD custom, duplication
- `/admin/users` : liste 7 users avec dropdown profil, filtre par profil
- AdminRoute guard : seul TENANT_ADMIN peut accéder (redirect → /dashboard sinon)

---

## API Endpoints Clés

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
```

---

## Backlog Priorisé

### P0 (Prochain Sprint)
- **Chantier 3 : SAFe Structurel** (trains, PIs, sprints, capabilities)

### Bloc 2 Restant (à faire avant ou pendant SAFe)
- Page "Suivi Fournisseurs" (`/vendors`) — vue groupée par fournisseur (régie vs forfait, alertes 80%/100%, écart TJM)
- ResourceModal enrichi (3 modes : Interne / Régie / Forfait)
- Page Ressources enrichie (filtre resource_type + badge type)
- Impact projets : coûts externes dans section Budget de ProjectDetail

---

## Chantier 3 : SAFe Structurel

### Phase 3a — Collections SAFe
- Collections `trains`, `pis`, `sprints`, `capabilities` CRUD
- Lier les équipes à `train_id`

### Phase 3b — Hiérarchie tâches
- `parent_id` + `task_level` sur tasks
- capability → feature → user story

### Phase 3c — TreeView projet
### Phase 3d — Cycle de vie par phase (phase_history)
### Phase 3e — Estimations par phase
### Phase 3f — Page "Trains SAFe" dans sidebar

---

## Fichiers Clés
- `/app/backend/modules/profiles/` (service.py, router.py, schemas.py)
- `/app/backend/modules/demands/` (service.py, router.py)
- `/app/backend/core/auth.py` (permission_required, TokenPayload)
- `/app/frontend/src/pages/AdminProfiles.jsx`
- `/app/frontend/src/pages/AdminUsers.jsx`
- `/app/frontend/src/pages/Demands.jsx`
- `/app/frontend/src/api/index.js`
