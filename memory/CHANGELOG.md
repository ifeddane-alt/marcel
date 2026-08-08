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

## 2026-06 — Drag & drop barre → grille étendu à TOUS les blocs
- Dashboard.jsx : tous les blocs de la barre de choix sont désormais glissables (pas seulement les grisés).
- Glisser un bloc déjà affiché le REPOSITIONNE à l'emplacement du dépôt (taille conservée), sans doublon.
- Auto-testé via simulation drag/drop : metric_green déplacé, 22 items avant/après.

## 2026-06 — Export/Import Excel généralisé + import MS Project .mpp
- Nouveau module backend excel_io : /api/excel/{entity}/export, /import/preview, /import/commit
- 10 entités : projects, programs, teams, resources, milestones, risks, decisions, demands, budget (update-only), timesheets
- Export .xlsx stylé (en-têtes FR, formats €/dates, onglet 'Aide import') — ré-importable tel quel
- Import avec aperçu (badges Nouveau/Mise à jour/Erreur) et upsert par nom/clé métier
- Import Microsoft Project .mpp binaire via MPXJ (JRE 17 + JPype subprocess) + XML MSPDI conservé — bouton MS Project sur la Roadmap
- Composants frontend : ExcelToolbar.jsx, MsProjectImport.jsx — boutons sur 9 pages
- Dockerfile : ajout default-jre-headless (nécessaire pour le déploiement VPS)
- Testé : agent iteration_51 = 16/16 backend, frontend 100% (fix import manquant Timesheets.jsx)

## 2026-06 — Export PDF COMEX du dashboard
- Endpoint GET /api/dashboard/export/pdf (reportlab) : KPIs, météo RAG, top 5 projets budget, top risques (criticité colorée), jalons 30j (retards en rouge), charge équipes mois courant, dernières décisions
- Bouton « PDF COMEX » sur le dashboard (data-testid dashboard-export-pdf-btn)
- Fichiers : backend/modules/dashboard/pdf_export.py, router.py, frontend Dashboard.jsx, api/index.js
- Auto-testé : HTTP 200, PDF 2 pages valide (contrôle visuel OK), téléchargement UI vérifié

## 2026-06 — Codification projets (préfixe par programme)
- Admin → Configuration → onglet « Codes Projets » : préfixe par défaut + préfixe par programme (P01, DATA...) + bouton backfill des projets existants
- Génération auto côté serveur au format PREFIX-001, séquentiel par préfixe, verrouillé (non modifiable), anti-doublon garanti
- Modal projet : champ Code en lecture seule, mis à jour en direct quand on change de programme
- Code affiché : table Portefeuille, fiche projet, export Excel (colonne Code, lecture seule) — import Excel génère aussi le code
- Endpoints : GET /api/projects/next-code, PUT /api/admin/config/project-codes, POST /api/admin/config/project-codes/backfill
- Backfill exécuté en Preview : 10/10 projets codifiés (P01-xxx, DATA-xxx, PRJ-xxx)
- Auto-testé backend (séquence, unicité, backfill, Excel) + UI (modal, admin, table)
