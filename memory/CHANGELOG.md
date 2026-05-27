# CHANGELOG — MARCEL PPM

## V1.1 — 27 mai 2026

### Feature 1 — Status Report PPT par Projet
- Nouveau module `/app/backend/modules/status_report/`
  - `GET /api/projects/{id}/weather` — calcul auto 4 météos (périmètre, budget, calendrier, scope_change)
  - `POST /api/projects/{id}/status-report` — génération PPT 6 slides + sauvegarde DB
  - `GET /api/projects/{id}/status-reports` — historique
- Nouveau générateur PPT dans `pptx_generator.py` → `generate_status_report_pptx()`
  - Slide 1 : Garde (nom projet, programme, CP, date, branding tenant)
  - Slide 2 : Météo 2×2 avec icônes colorées et commentaires CP
  - Slide 3 : Jalons livrés (triés par date réelle décroissante)
  - Slide 4 : Jalons à venir (triés par date forecast)
  - Slide 5 : Jalons métiers (critical/strategic/transversal)
  - Slide 6 : Risques ouverts (triés par criticité P×I)
- Collection MongoDB `project_weather_reports` (historique)
- Permission `export.status_report` → ADMIN, PORTFOLIO, CHEF_DE_PROJET
- Frontend `StatusReportModal.jsx` — 4 indicateurs, override cliquable (cycle 5 niveaux), commentaire par indicateur
- Bouton "Status Report" dans `ProjectDetail.jsx` (à côté d'Export COPIL)

### Feature 2 — Templates Projets par Méthodologie
- Nouveau module `/app/backend/modules/project_templates/`
  - `GET /api/project-templates` — liste les templates du tenant (auto-seed si vides)
  - `POST /api/project-templates` — créer template custom
  - `PUT /api/project-templates/{id}` — modifier
  - `DELETE /api/project-templates/{id}` — supprimer (custom seulement)
  - `POST /api/project-templates/{id}/duplicate` — dupliquer
  - `POST /api/projects/{id}/apply-template` — applique template (crée tâches + jalons)
- 3 templates par défaut en base :
  - Waterfall (6 phases : Cadrage, Conception, Développement, Recette, MEP, Hypercare — 12 jalons, 17 tâches)
  - Agile (5 phases : Discovery, Sprint 0, Delivery, Release, Run)
  - SAFe (4 phases : PI Planning, Execution, System Demo, Release)
- Permission `admin.templates` → ADMIN uniquement
- Collection MongoDB `project_templates`
- Frontend `AdminTemplates.jsx` — page `/admin/templates` avec CRUD complet
- `ProjectModal.jsx` — section template pré-chargée selon méthodologie, phases décochables

### Fix — Synchronisation permissions profils
- `seed_default_profiles()` — upsert par code au lieu de skip si count >= 12
- Startup hook `server.py` — synchro permissions pour tous les tenants existants au démarrage

---

## V1.0 — 04 mai 2026 (Freeze)

### Responsive Design Complet
- Refactoring `Layout.jsx`, `Dashboard.jsx`, `Gantt`, `Kanban`, Recharts — Desktop/Tablette/Mobile

### Connecteur Power BI
- 6 endpoints (`/api/powerbi/projects|resources|timesheets|budget|risks|milestones`)
- Authentification API Key par tenant (machine-to-machine)
- Filtres `from_date`, `to_date`, `program_id`
- Page `/admin/powerbi` avec génération clé et scripts M-Query copiables

### Renommage Projetenne → MARCEL
- Tous les éléments UI, exports PPT/PDF, Agent IA, README, docker-compose

### Infrastructure
- Déploiement Docker VPS Scaleway (51.158.110.88)
- Domaine : marcel-ppm.com
- Repo GitHub : github.com/ifeddane-alt/marcel
