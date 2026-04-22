# PRD — Projetenne (PPM SaaS Multi-Tenant)

## Problème Résolu
Plateforme SaaS de gestion de portefeuilles projets (PPM) pour grandes entreprises.
Multi-tenant avec isolation stricte des données et RBAC granulaire.

## Architecture Technique
- **Frontend** : React 18, TailwindCSS, Recharts, Frappe-Gantt, Lucide-React
- **Backend** : FastAPI (Python 3.11), Motor (MongoDB async)
- **DB** : MongoDB multi-tenant via `tenant_id` sur chaque collection
- **Auth** : JWT custom (TENANT_ADMIN, PMO_USER, READ_ONLY)
- **URL** : https://project-sync-61.preview.emergentagent.com

## Rôles Utilisateurs
| Rôle | Email | Mot de passe | Description |
|------|-------|---|---|
| TENANT_ADMIN | admin@altair.fr | Admin1234! | Accès complet + bypass workflow |
| PMO_USER | pmo@altair.fr | Pmo1234! | PMO + bypass workflow timesheets |
| READ_ONLY | viewer@altair.fr | View1234! | Lecture seule |

---

## Streams Implémentés

### ✅ Stream 1 — Équipes, Ressources & Allocations
- Gestion des équipes (CRUD) avec managers
- Gestion des ressources (CRUD) avec `validator_resource_id` pour N+1
- Allocations de travail (WA) par ressource × tâche × phase
- Tableau de bord capacité / disponibilité

### ✅ Stream 2 — Roadmap, Dépendances & Export COPIL
- Roadmap visuelle interactive (Gantt via frappe-gantt)
- Milestones enrichis : 3 familles (`epic_lifecycle`, `epic_milestone`, `transversal`)
  - Attributs : type, family, comment, owner_resource_id, deliverable, is_blocking
- Dépendances inter-projets : CRUD + filtrage + indicateurs Roadmap
- Export PowerPoint COPIL : images milestones + tableau dépendances

### ✅ Stream 3 Base — Timesheets (saisie & validation simple)
- Grille de saisie hebdomadaire (autosave 500ms)
- Soumission par semaine (`draft → submitted`)
- Validation simple (`submitted → validated`)
- Rapports CSV par ressource / équipe / projet

### ✅ Stream 3 Enhancement — Workflow Multi-Acteurs (2026-02)
**Workflow 4 étapes :**
```
draft → submitted → cp_reviewed → validated
                    ↑              ↑
                Valideur N+1    Chef de Projet

PMO/Admin bypass → validated (depuis n'importe quel statut)
Any → draft (rejet avec motif obligatoire)
```

### ✅ P1 Congés & Absences (2026-02)
- Saisie directe des absences (0.5 = demi-journée, 1.0 = journée)
- Jours fériés hardcodés FR + MA 2025-2026
- Ligne "Absences" dans la grille timesheets hebdomadaire
- Onglet "Absences" avec calendrier mensuel interactif + stats

### ✅ Tableau de bord réglementaire - Conformité (2026-02)
- Page Conformité avec milestones regulatory + decomm
- KPIs : total actifs, critiques (J-30), orange (J-31-90), dépassés
- Tableau triable/filtrable par projet, type, statut
- Export CSV

### ✅ Gestion de la Demande (2026-04)
**Workflow de qualification :**
```
nouvelle → qualifiee (PMO/Admin : qualify)
qualifiee → priorisee (PMO/Admin : prioritize, priority_score obligatoire)
priorisee → acceptee (PMO/Admin : accept)
priorisee → refusee (PMO/Admin : refuse, rejection_reason obligatoire)
acceptee → convertie (PMO/Admin : convert → crée un projet)
```

**Fonctionnalités :**
- Vue Kanban (6 colonnes) avec drag & drop HTML5
- Vue Tableau (table sortable)
- KPIs en-tête : total, nouvelles, acceptées, critiques
- Création par tout rôle non READ_ONLY
- CRUD complet (PMO/Admin)
- Modal de conversion en projet pré-remplie (titre, description, budget, dates, programme)
- Seed de 10 demandes de démo via `POST /api/demands/seed`
- Filtres : statut, urgence, recherche texte libre

**Champs DB :**
```
demands: demand_id, tenant_id, title, description, requester, requester_department,
         business_value, estimated_budget, urgency (low/medium/high/critical),
         status (nouvelle/qualifiee/priorisee/acceptee/refusee/convertie),
         priority_score, rejection_reason, qualified_by, qualified_at,
         prioritized_by, prioritized_at, accepted_by, accepted_at,
         refused_by, refused_at, converted_project_id, created_by, created_at, updated_at
```

---

## API Endpoints Clés

### Timesheets
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/timesheets/grid` | Grille hebdomadaire |
| PUT | `/api/timesheets/entry` | Upsert entrée (autosave) |
| POST | `/api/timesheets/submit-week` | Soumettre semaine |
| GET | `/api/timesheets/pending-count` | Badge sidebar contextuel |
| GET | `/api/timesheets/validation?view=valideur\|cp\|pmo` | Vue validation |
| POST | `/api/timesheets/validate` | Transition workflow (RBAC) |
| POST | `/api/timesheets/reject` | Rejet → draft (motif obligatoire) |
| GET | `/api/timesheets/report` | Rapport agrégé |

### Demands
| Méthode | Route | Description |
|---|---|---|
| GET | `/api/demands` | Liste (filtres: status, urgency) |
| POST | `/api/demands` | Créer (non READ_ONLY) |
| GET | `/api/demands/{id}` | Détail |
| PUT | `/api/demands/{id}` | Modifier (PMO/Admin) |
| DELETE | `/api/demands/{id}` | Supprimer (PMO/Admin) |
| PATCH | `/api/demands/{id}/transition` | Transition workflow |
| POST | `/api/demands/{id}/convert` | Convertir en projet |
| POST | `/api/demands/seed` | Seed données démo |

---

## Schéma DB Clé

```
resources:     resource_id, tenant_id, name, role, team_id, validator_resource_id
projects:      project_id, tenant_id, name, owner_resource_id, status_rag
timesheets:    timesheet_id, tenant_id, resource_id, work_allocation_id, date,
               jh_value, status(draft|submitted|cp_reviewed|validated|rejected),
               submitted_at, cp_reviewed_at, validated_at, validated_by,
               rejection_reason, modified_by, modified_at, modification_reason
milestones:    milestone_id, project_id, family(epic_lifecycle|epic_milestone|transversal),
               type, attribute, comment, owner_resource_id, deliverable, is_blocking
project_dependencies: source_project_id, target_project_id, nature, status, impact
demands:       demand_id, tenant_id, title, description, requester, requester_department,
               business_value, estimated_budget, urgency, status, priority_score,
               rejection_reason, qualified_by, converted_project_id, created_at
```

---

## Backlog Priorisé

### P0 (Prochain Sprint)
- **SAFe Structurel (Chantier 3)** — Voir détail ci-dessous

### P1 (Futur)
Rien de défini

### P2 (Backlog)
À définir selon priorités utilisateur

---

## Chantier 3 : SAFe Structurel (PROCHAIN)

### Phase 3a — Collections SAFe
- Collections `trains`, `pis`, `sprints`, `capabilities`
- CRUD pour toutes les collections
- Lier les équipes à `train_id`

### Phase 3b — Hiérarchie tâches
- Ajouter `parent_id` (FK vers tasks) et `task_level` (enum) aux tasks
- Hierarchy : capability → feature → user story
- Les projets non-SAFe restent en liste plate

### Phase 3c — TreeView projet
- Remplacer la vue flat tasks par un TreeView expandable
- Conserver toggle liste plate

### Phase 3d — Cycle de vie par phase
- Phases : backlog, review, analysis, implementation, test, hypercare, done, rejected
- Historique dans `phase_history` collection
- Règles anti-rollback

### Phase 3e — Estimation par phase
- Array `phase_estimates` sur les tasks

### Phase 3f — Page "Trains SAFe"
- Sidebar : lien "Trains SAFe"
- Timelines PI, sprints, capacités

### Seed & Tests SAFe
- 1 train, 2 PIs, 4 sprints, capabilities avec hiérarchie
- Vérifier zéro régression sur projets flat non-SAFe

---

## Fichiers Clés
- Backend : `/app/backend/modules/timesheets/` (service.py, router.py, schemas.py)
- Backend : `/app/backend/modules/demands/` (service.py, router.py, schemas.py) ← NOUVEAU
- Backend : `/app/backend/modules/resources/` (service.py, schemas.py)
- Backend : `/app/backend/seed.py` (données de démo)
- Frontend : `/app/frontend/src/pages/Timesheets.jsx` (saisie + 3 vues validation)
- Frontend : `/app/frontend/src/pages/Demands.jsx` (Kanban + Table + workflow) ← NOUVEAU
- Frontend : `/app/frontend/src/components/DemandModal.jsx` ← NOUVEAU
- Frontend : `/app/frontend/src/components/ConvertProjectModal.jsx` ← NOUVEAU
- Frontend : `/app/frontend/src/api/index.js` (toutes les APIs)
