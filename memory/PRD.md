# Projetenne — PRD & Architecture

## Problème original
Build a multi-tenant SaaS PPM (Project Portfolio Management) web app called **Projetenne**.

## Architecture technique
- **Backend**: FastAPI (Python) + MongoDB (Motor async)
- **Frontend**: React + Tailwind CSS
- **Auth**: JWT HS256 multi-tenant
- **Architecture**: 2-layer modulaire (router + service) dans `modules/`

### Structure backend
```
/app/backend/
├── server.py             (~50 lignes, app factory)
├── pptx_generator.py     (Export PPT)
├── core/                 (auth.py, database.py)
├── shared/               (utils.py, rag.py)
├── modules/
│   ├── auth/, projects/, programs/, resources/, tasks/
│   ├── allocations/, milestones/, risks/, decisions/
│   ├── governance/, dashboard/, export/, csv_import/, tenant/
│   ├── teams/            (S1-01 — NOUVEAU)
│   └── work_allocations/ (S1-05 — NOUVEAU)
```

## Personas
- **TENANT_ADMIN**: Admin complet (CRUD tout)
- **PMO_USER**: Créer/modifier (pas supprimer équipes/ressources)
- **READ_ONLY**: Lecture seule

## Comptes de démo
- `admin@altair.fr` / `Admin1234!` (TENANT_ADMIN)
- `pmo@altair.fr` / `Pmo1234!` (PMO_USER)
- `viewer@altair.fr` / `View1234!` (READ_ONLY)

---

## Chantiers complétés

### Sprint 0 — Refactoring architecture modulaire (DONE)
- server.py décomposé en modules/ sans régression fonctionnelle

### Stream 1 — P3 étendu : Équipes + TJM + Allocations (DONE — 2025-04)

#### S1-01 — Collection `teams` + CRUD + page Équipes ✅
- Module: `modules/teams/` (router, service, schemas)
- RBAC: ADMIN CRUD, PMO create/update, READ_ONLY lecture
- Seed: 5 équipes (Dev A, Dev B, Infra, QA, Support)
- Frontend: page `/teams` dans sidebar, TeamModal
- Tests: 14/14 ✅

#### S1-02 — `team_id` sur resources + dropdown ResourceModal ✅
- Champ `team_id: Optional[str]` ajouté aux ressources
- Dropdown équipe dans ResourceModal (charge les équipes dynamiquement)
- Seed: 10 ressources affectées aux 5 équipes
- CSV import mis à jour pour accepter `team_id` + résolution par nom d'équipe

#### S1-03 — `tjm_eur` sur resources ✅
- Champ `tjm_eur: Optional[float]` (TJM €/jour)
- Champ numérique dans ResourceModal
- Seed: Dev=600, TL=800, PO=700, QA=550, Archi=900, Support=500

#### S1-04 — `availability_rate` sur resources ✅
- Champ `availability_rate: Optional[float]` (0-100, défaut 100)
- Input % dans ResourceModal avec affichage capacité effective
- Formule: capacité effective = capacity_jh_month × availability_rate / 100

#### S1-05 — Collection `work_allocations` + module + UI ✅
- Module: `modules/work_allocations/` (router, service, schemas)
- Schema: task_id, resource_id, phase (analyse/conception/implementation/review/test/hypercare), planned_md, consumed_md
- Calcul à la lecture: planned_cost_eur = planned_md × tjm_eur
- UI: Section "Allocations de travail" dans ProjectDetail + WorkAllocationModal
- Seed: 23 allocations sur 8 projets
- Tests: 13/13 ✅

#### S1-06 — Consommation par équipe ✅
- Endpoint: `GET /api/projects/{id}/team-consumption`
- Agrégation: SUM(work_allocations.md × tjm_eur) GROUP BY team_id
- UI: Section "Consommation par équipe" dans ProjectDetail
- Tableau: Équipe | JH prévus | JH consommés | Coût prévu | Coût consommé | RAF JH | RAF €

#### S1-07 — RAF valorisé ✅
- Endpoint: `GET /api/projects/{id}/raf`
- Calcul: SUM((planned_md - consumed_md) × tjm_eur)
- Atterrissage = consommé total + RAF valorisé
- UI: Bloc "RAF & Atterrissage valorisé" dans colonne droite ProjectDetail

### Chantiers précédents (C1-C8) — DONE
Voir CHANGELOG.md pour l'historique complet.

---

## Backlog priorisé

### P0 — En attente de validation utilisateur
- **PPT COPIL Export** — URL: `https://project-sync-61.preview.emergentagent.com/copil_test.pptx`
  Le fichier PPT a été généré avec les 6 correctifs visuels (fond blanc, headers pleine largeur, etc.)
  **L'utilisateur doit valider visuellement avant de débloquer S1-08**

### P1 — Prochaines features
- **S1-08**: Enrichissement PPT fiche projet (BLOQUÉ sur validation PPT)
- **S1-09**: Heatmap capacité équipe × période (BLOQUÉ sur S1-08)
- **P1 Gestion de la Demande**: Collection `demands` + workflow qualification
- **P5 Gestion des Temps**: Collection `timesheets` + validation hiérarchique

### P1 — SAFe
- **Chantier 9a SAFe structurel**: Collections `trains`, `pis`, `sprints`, `capabilities`
- **Chantier 9b Tasks extension**: Ajouter `parent_id`, `phase` aux tasks + UI tree view

### P2 — Future
- **P2 Arbitrage Portefeuille**: Scoring + enveloppe budgétaire
- **Module Scope**: Snapshot, capacité vs charge, recalcul Gantt

---

## Endpoints clés
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/teams | Liste équipes |
| POST | /api/teams | Créer équipe |
| PUT | /api/teams/{id} | Modifier équipe |
| DELETE | /api/teams/{id} | Supprimer équipe (ADMIN only) |
| GET | /api/projects/{id}/work-allocations | Allocations de travail |
| POST | /api/work-allocations | Créer allocation |
| PUT | /api/work-allocations/{id} | Modifier allocation |
| DELETE | /api/work-allocations/{id} | Supprimer allocation |
| GET | /api/projects/{id}/team-consumption | Consommation par équipe (S1-06) |
| GET | /api/projects/{id}/raf | RAF valorisé (S1-07) |
| POST | /api/export/copil | Export PPT COPIL |

## Schémas DB nouveaux (Stream 1)
- `teams`: team_id, tenant_id, name, manager_resource_id, train_id, created_at
- `work_allocations`: work_allocation_id, tenant_id, task_id, resource_id, phase, planned_md, consumed_md, created_at
- `resources` (enrichi): + team_id, tjm_eur, availability_rate
