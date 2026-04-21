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

### ✅ Stream 3 Enhancement — Workflow Multi-Acteurs (NOUVEAU - 2026-02)
**Workflow 4 étapes :**
```
draft → submitted → cp_reviewed → validated
                    ↑              ↑
                Valideur N+1    Chef de Projet
                
PMO/Admin bypass → validated (depuis n'importe quel statut)
Any → draft (rejet avec motif obligatoire)
```

**RBAC du workflow :**
| Transition | Acteur | Condition |
|---|---|---|
| draft → submitted | Ressource | jh_value > 0 |
| submitted → cp_reviewed | Valideur | `resource.validator_resource_id` ou manager d'équipe |
| cp_reviewed → validated | Chef de Projet | `project.owner_resource_id` |
| any → validated (bypass) | TENANT_ADMIN ou PMO_USER | Accès direct |
| any → draft (reject) | Valideur, CP, ou PMO/Admin | Motif obligatoire |

**Timeout CP :** Badge d'alerte si `cp_reviewed` depuis > 3 jours ouvrés

**3 sous-vues dans l'onglet Validation :**
- **Valideur N+1** : timesheets `submitted` où je suis le valideur explicite ou manager d'équipe
- **Chef de Projet** : timesheets `cp_reviewed` pour mes projets (`owner_resource_id`)
- **PMO/Admin** (TENANT_ADMIN/PMO_USER uniquement) : tout voir + bypass

**Champs DB ajoutés :**
- `resources.validator_resource_id` (override N+1, sinon manager d'équipe par défaut)
- `projects.owner_resource_id` (CP du projet pour validation finale)
- `timesheets.status` : ajout de `cp_reviewed`
- `timesheets.cp_reviewed_at`, `modified_by`, `modified_at`, `modification_reason`

**Données de démo :**
- Sophie Martin (admin) = valideur de Thomas Dubois et Alexandre Moreau
- Thomas Dubois (PMO) = valideur de Sophie Martin
- Projects 0,2,5,7 (Finance/SAP/Azure/DORA) → CP : Sophie Martin
- Projects 1,3,4,6 (Phoenix/DW/CRM/RH) → CP : Thomas Dubois

### ✅ Stream 4 — Enrichissement Roadmap
- Milestones familles 3 types + filtres + PPT
- Dépendances inter-projets avec nature/statut/impact

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
```

---

## Backlog Priorisé

### P0 (Prêt pour implémentation)
- Rien de bloquant actuellement

### P1 (Prochain Sprint)
- **Congés & Planification des absences** : vue calendrier par ressource, intégration dans la capacité

### P2 (Futur)
1. **Vue Tableau de bord réglementaire** : milestones regulatory/decomm + alerte J-90
2. **Gestion de la Demande** : collection `demands`, workflow qualification
3. **SAFe Structurel (Chantier 9a)** : collections `trains`, `pis`, `sprints`, `capabilities`

---

## Fichiers Clés
- Backend : `/app/backend/modules/timesheets/` (service.py, router.py, schemas.py)
- Backend : `/app/backend/modules/resources/` (service.py, schemas.py)
- Backend : `/app/backend/seed.py` (données de démo)
- Backend : `/app/backend/migrate_workflow.py` (migration Stream 3 Enhancement)
- Frontend : `/app/frontend/src/pages/Timesheets.jsx` (saisie + 3 vues validation)
- Frontend : `/app/frontend/src/components/ResourceModal.jsx` (validator_resource_id)
- Frontend : `/app/frontend/src/api/index.js`
