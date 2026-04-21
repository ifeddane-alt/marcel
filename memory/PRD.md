# Projetenne — Product Requirements Document

## Problème original
Construire et étendre en continu une application web SaaS multi-tenant appelée `Projetenne`  
(PPM SaaS — gestion de portefeuille de projets).

## Personas / Utilisateurs cibles
- **TENANT_ADMIN** : Administrateur de compte (`admin@altair.fr / Admin1234!`)
- **PMO_USER** : Gestionnaire de portefeuille
- **VIEWER** : Lecteur seul

---

## Architecture technique
```
/app/backend/
├── server.py
├── pptx_generator.py          # Génère les PPTs avec matplotlib
├── core/ (auth, database)
├── shared/
├── modules/
│   ├── teams/        (router, schemas, service)
│   ├── projects/     (router, schemas, service)
│   ├── programs/     (router, schemas, service)
│   ├── resources/    (router, schemas, service)
│   ├── tasks/        (router, schemas, service)  ← dependencies, cycle DFS
│   ├── allocations/  (router, schemas, service)
│   ├── work_allocations/ (router, schemas, service)
│   ├── milestones/   (router, schemas, service)
│   ├── governance/   (router, schemas, service)
│   ├── export/       (router, schemas, service)  ← include_roadmap
│   └── ...

/app/frontend/src/
├── App.js               ← routes: dashboard, portfolio, projects/:id, roadmap, teams, ...
├── pages/
│   ├── Dashboard.jsx
│   ├── Portfolio.jsx
│   ├── ProjectDetail.jsx ← Gantt tab (S2-02), task dependencies (S2-01)
│   ├── Teams.jsx
│   ├── Roadmap.jsx       ← NOUVEAU S2-03
│   └── ...
├── components/
│   ├── ProjectGantt.jsx        ← frappe-gantt wrapper
│   ├── TaskModal.jsx           ← dependency multi-select (S2-01)
│   ├── CapacityAlertBanner.jsx ← alertes capacité
│   ├── ExportCopilModal.jsx    ← checkbox include_roadmap (S2-04)
│   └── Layout.jsx
└── api/index.js
```

---

## Ce qui a été implémenté

### Stream 1 — Teams & Allocations (100% COMPLET — validé iteration_14)
| ID     | Feature                              | Date       |
|--------|--------------------------------------|------------|
| S1-01  | CRUD Équipes + mapping ressources    | 2025-12    |
| S1-02  | TJM par ressource                    | 2025-12    |
| S1-03  | Taux de disponibilité ressource      | 2025-12    |
| S1-04  | Allocation équipes ↔ projets          | 2025-12    |
| S1-05  | Work Allocations CRUD                | 2025-12    |
| S1-06  | Consommation équipe par projet (RAF) | 2025-12    |
| S1-07  | RAF valorisé (€ et JH)               | 2025-12    |
| S1-08  | Slide PPT "Consommation par équipe"  | 2025-12    |
| S1-09  | Heatmap capacité équipe × période    | 2025-12    |

### Alertes capacité — 100% COMPLET (validé iteration_15)
| Feature                                            | Status |
|----------------------------------------------------|--------|
| Backend `GET /api/teams/capacity-alerts`           | ✅     |
| Frontend Banner + sidebar badge + Dashboard widget | ✅     |

### Stream 2 — Roadmap & Interdépendances (100% COMPLET — validé iterations 15-16)
| ID     | Feature                                              | Date       |
|--------|------------------------------------------------------|------------|
| S2-01  | Dépendances inter-tâches (anti-cycle DFS)            | 2026-04    |
| S2-02  | Vue Gantt / Timeline projet (frappe-gantt)           | 2026-04    |
| S2-03  | Roadmap consolidée multi-projets (page /roadmap)     | 2026-04    |
| S2-04  | Slide Roadmap dans PPT COPIL (matplotlib)            | 2026-04    |
| UX-01  | Page Détail Équipe /teams/{id} (membres, allocs, heatmap) | 2026-04 |

### Stream 3 — Timesheets & Validation (100% COMPLET — validé iteration_18)
| ID     | Feature                                              | Date       |
|--------|------------------------------------------------------|------------|
| S3-01  | Grille de saisie JH (draft + auto-save debounce)     | 2026-04    |
| S3-02  | Soumission semaine + Validation hiérarchique         | 2026-04    |
| S3-03  | Auto-update consumed_md sur work_allocations         | 2026-04    |
| S3-04  | Rapport croisé (ressource/équipe/projet) + CSV       | 2026-04    |
| UX-02  | Badge sidebar Timesheets (en attente de validation)  | 2026-04    |

### Améliorations démo (validé iteration_18)
| Fix    | Description                                          | Date       |
|--------|------------------------------------------------------|------------|
| DX-01  | Noms ressources réalistes (Sophie Martin, Thomas Dubois, etc.) | 2026-04 |
| DX-02  | Widget Alertes capacité remonté dans Dashboard (position haute) | 2026-04 |
| DX-03  | Allocations Thomas Dubois + Alexandre Moreau (Dev A) | 2026-04    |
| DX-04  | Nettoyage équipes parasites + protection seed        | 2026-04    |

---

## Backlog priorisé

### P0 — Critique
*(Tout le P0 est complété)*

### P1 — Important
*(Tout le P1 Stream 2 + Stream 3 est complété)*

### P2 — Futur
| ID   | Feature                              | Description                                              |
|------|--------------------------------------|----------------------------------------------------------|
| P2-1 | Gestion de la Demande                | Collection `demands` + workflow de qualification         |
| P2-2 | SAFe structurel                      | Collections `trains`, `pis`, `sprints`, `capabilities`   |

### Stream 4 — Enrichissement Roadmap (100% COMPLET — validé iteration_19)
| S4-01 à S4-11 | Modèle jalons 3 familles, CRUD jalons ADMIN+PMO, module project_dependencies, Roadmap filtres+flèches SVG, PPT coloré | 2026-04 |

---

## Points techniques critiques
- **Multi-tenancy** : Isolation stricte par `tenant_id` dans tous les modèles DB
- **JWT Auth** : Custom (non Google Auth), rôles TENANT_ADMIN / PMO_USER / VIEWER
- **Timesheets** : Grille saisie (debounce 500ms auto-save), soumission semaine, validation hiérarchique, rapport pivot CSV
- **Ressources** : Noms réalistes (Sophie Martin=admin, Thomas Dubois=PMO, etc.) liés au JWT via `resource_id`
- **frappe-gantt** : CSS importé via `src/index.css @import` (pas d'import JS direct à cause webpack 5 exports)
- **Dates seed** : Toujours générées dynamiquement (`datetime.now(timezone.utc)`) — PAS de dates 2025 hardcodées
- **ObjectId MongoDB** : Toujours exclu via `{"_id": 0}` dans les projections

---

## Credentials de test
- Admin : `admin@altair.fr` / `Admin1234!` (TENANT_ADMIN)
- PMO : `pmo@altair.fr` / `Pmo1234!` (PMO_USER)
- URL : `https://project-sync-61.preview.emergentagent.com`
