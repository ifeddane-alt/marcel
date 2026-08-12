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

## 2026-06 — Codes projets partout (COPIL / PDF COMEX / Roadmap)
- pptx_copil.py : helper _cname — code affiché sur garde, sommaire, gantt roadmap, fiches projet, conso équipes, arbitrage, décisions
- dashboard/pdf_export.py : code préfixé aux noms (top projets, risques, jalons, décisions) ; project_code ajouté dans dashboard/service.py (get_extras, get_top_risks)
- Roadmap.jsx : code mono gris devant le nom (timeline + Scope vs Réel + tooltips)
- Fix : lignes résiduelles dupliquées dans pdf_export.py (SyntaxError) corrigées
- Auto-testé : 4 codes retrouvés dans le texte PPT, 6 codes dans le PDF, screenshot Roadmap OK

## 2026-06 — Recherche globale par code projet
- Nouveau composant GlobalSearch.jsx dans la topbar (Layout.jsx)
- Recherche par code (priorité : exact > préfixe > contient) puis par nom ; badge code bleu + pastille RAG dans les résultats
- Enter sur un code exact ouvre directement la fiche projet ; navigation clavier (flèches) ; raccourci Ctrl/Cmd+K
- Auto-testé : DATA-001 → fiche ouverte, recherche par nom 'phoenix' OK

## 2026-06 — Recherche globale étendue
- Nouveau module backend modules/search : GET /api/search/global?q= (projets par code/nom scorés, jalons, risques triés par criticité, décisions — max 5 par type, permissions ownership respectées)
- GlobalSearch.jsx : appel debounced 250ms, résultats groupés par type avec en-têtes (Projets/Jalons/Risques/Décisions), métadonnées (date jalon, criticité, code projet), navigation clavier sur liste aplatie
- Clic ou Entrée sur n'importe quel résultat → fiche du projet concerné
- Auto-testé : API (q=migration → 2 projets, 3 jalons, 4 risques) + UI (groupes affichés, clic risque → fiche projet)

## 2026-06 — Historique recherche (récemment consultés)
- utils/recentProjects.js : localStorage par utilisateur (max 6, dédupliqué, plus récent en premier)
- ProjectDetail.jsx : chaque fiche visitée est enregistrée
- GlobalSearch.jsx : au focus champ vide → panneau « Récemment consultés » cliquable avec badge code + RAG, navigation clavier incluse
- Auto-testé : 2 fiches visitées → panneau affiche les 2 dans le bon ordre, clic → navigation

## 2026-06 — DÉPLOIEMENT VPS RÉUSSI (production marcel-ppm.com)
- Accès SSH rétabli : clés ajoutées via Scaleway (reboot) + clé pod 'emergent-marcel-deploy' ajoutée au authorized_keys — le pod peut désormais déployer via ssh root@51.158.110.88
- Topologie prod : nginx HÔTE (ports 80/443, SSL Certbot, server_name marcel-ppm.com) → proxy vers conteneur marcel-nginx-http :8080 → frontend/backend Docker (/opt/marcel, env compose = /opt/marcel/.env, PAS backend/.env)
- Déployé : main @ 8b3deb6 (Excel import/export, .mpp, PDF COMEX, codes projets, recherche globale, SSO, dashboard drag&drop, etc.)
- Incidents résolus pendant le déploiement :
  1. Disque plein pendant build → docker builder/image prune (+ apt-get clean) ; après déploiement disque à 77%
  2. Backend exigeait MARCEL_LICENSE_KEY (core/license.py, check au startup) → licence générée (PPM CONSEILS, expire 2030-12-31, 999 users) et ajoutée à /opt/marcel/.env
  3. nginx-http conteneur 502 après recréation des conteneurs → docker compose restart nginx-http
- Vérifié : https://marcel-ppm.com HTTP 200, /api/health ok, nouvelles routes présentes (403 sans auth), page login avec boutons SSO
- RAPPEL : RESEND_API_KEY et SENTRY_DSN toujours absents de la prod ; codes projets à générer via Admin → Codes Projets en prod

## 2026-06 — Site vitrine V2 déployé en prod
- 14 nouvelles pages (6 modules FR + 6 EN + cas d'usage FR/EN), accueils enrichis (vidéo teaser, bénéfices, personas, témoignages placeholders, FAQ), hub avec liens modules, footer 3 colonnes, nav « Pour qui ? »
- SEO : sitemap 20 URLs + hreflang, llms.txt, JSON-LD (FAQPage, VideoObject, BreadcrumbList), canonical partout
- nginx.conf : 14 locations ajoutées ; teasers MP4 dé-gitignorés et servis en prod ; posters ffmpeg
- Déployé : build frontend VPS OK, 20/20 URLs 200, contact 201, health 200, disque 79%
- À FAIRE plus tard : remplacer les témoignages/chiffres PLACEHOLDER par de vraies références clients

## 2026-06 — Logo MARCEL cliquable dans l'app (déployé prod)
- Le logo « M MARCEL » de la topbar et du drawer mobile (Layout.jsx) est désormais un Link vers /dashboard (homepage app ; DashboardGuard redirige vers /timesheets si pas de permission)
- Testé E2E preview (login → /portfolio → clic logo → /dashboard) puis déployé prod (bundle vérifié, health 200)

## 2026-06 — Homepage in-app (déployé prod)
- Clarification utilisateur (après 2 mauvaises interprétations dashboard puis site web) : il voulait une VRAIE page d'accueil DANS l'application — option (a) validée : page personnalisée
- Backend : nouveau module `modules/home/` — GET /api/home/summary (prénom, contexte portefeuille actif/alerte/programmes, timesheet semaine courante si resource_id, validations en attente via timesheets_service.get_pending_count, jalons en retard + à venir 21j enrichis projet)
- Frontend : `pages/Home.jsx` (route /home) — Bonjour [prénom] + date, 12 tuiles accès rapides filtrées par permissions (canAccessNav), « Mes actions en attente » (feuille de temps avec badge À saisir, timesheets à valider, jalons en retard/à venir cliquables), « Derniers projets consultés » (réutilise getRecentProjects du localStorage déjà alimenté par ProjectDetail)
- Logo MARCEL (topbar + drawer) → Link /home
- Testé E2E preview (login → fiches projets → clic logo → /home avec greeting, actions, 2 projets récents) ; déployé prod (bundle + 403 sans auth sur /api/home/summary, health 200, disque 79%)

## 2026-06 — Atterrissage login → /home (déployé prod)
- Login classique + SSO exchange naviguent vers /home ; route index "/", catch-all "*", /login connecté et fallback AdminGuard → /home (alias legacy /cxo → /dashboard conservé)
- Testé E2E preview (login → /home direct) ; bundle prod vérifié (m("/home") présent, health/site 200)

## 2026-08-11 — Instances COPIL + déploiement prod
- Gouvernance : CRUD instances (COPIL/COPROJ/COMEX/CODIR/Steering/Autre), ordre du jour, participants, compte-rendu, statut, vue calendrier mensuelle, audit. Testé 11/11 (iteration_60).
- Déploiement production marcel-ppm.com (commit 8ef316b) des 5 chantiers : gestion utilisateurs, business case bénéfices, registre dépendances roadmap, journal d'audit, instances COPIL. Health + bundle + login + migration statuts vérifiés. Prune Docker 1,97 Go, disque 80 %.

## 2026-08-11 (2) — Mon Compte + Objectifs Stratégiques + Invitation ODJ
- /account : profil + changement de son propre mot de passe (bcrypt, audit). Footer rail → lien Mon compte.
- /objectifs : référentiel d'objectifs DSI, rattachement projets, KPIs d'alignement portefeuille (projets + budget), non-alignés. Nav « Objectifs ».
- Gouvernance : Invitation PDF (reportlab) + mailto prérempli avec l'ODJ sur chaque instance.
- Tests : curl backend 100 %, testing_agent iteration_61 = 100 % (0 bug). Preview uniquement, pas déployé.

## 2026-08-11 (3) — Score Alignement auto + Plan Pluriannuel N/N+1/N+2
- Arbitrage : le critère ALI (strategic_alignment) est calculé automatiquement depuis les objectifs stratégiques ACTIFS rattachés au projet (0→1, 1→3, 2→4, 3+→5) dès qu'au moins un objectif actif existe sur le tenant (alignment_auto=true dans /api/arbitrage/summary). PATCH du critère refusé (400) en mode auto ; cellule ALI en badge indigo non éditable avec tooltip + badge lien vers /objectifs. Export PDF hérite du calcul (via get_portfolio_summary).
- Budget : onglet « Plan pluriannuel » (tab-pluriannuel) — GET /api/budget/multiyear : répartition pro-rata temporis de l'EAC par exercice N/N+1/N+2, colonne « Hors fenêtre » (passé/futur), totaux portefeuille, comparaison aux enveloppes (marge/dépassement). Ajustement manuel par projet (PUT /api/budget/project/{id}/multiyear, champ budget_by_year, permission budget.edit, audit « plan pluriannuel », reset:true → retour pro-rata). Composant frontend/src/components/MultiYearPlan.jsx.
- Bug corrigé pendant vérification : import Link manquant dans Arbitrage.jsx (aurait cassé la page).
- Tests : curl backend 100 % (mapping ALI, blocage 400, multiyear manual/reset, 422, 403 viewer, 404 cross-tenant) + testing_agent iteration_62 = 100 % backend + 100 % frontend, 0 bug. Preview uniquement, PAS déployé en prod.

## 2026-08-11 (4) — Export Excel pluriannuel + DÉPLOIEMENT PROD
- Export Excel COMEX du plan N/N+1/N+2 : GET /api/budget/multiyear/export/excel (synthèse par exercice + enveloppes/marges colorées + schéma directeur : projet, code, RAG, période, montants par exercice, hors fenêtre, EAC, source). Bouton « Export Excel » (btn-export-multiyear-excel) sur l'onglet Plan pluriannuel. Testé : contenu xlsx vérifié par openpyxl, viewer 200, download E2E playwright.
- PROD marcel-ppm.com déployée (commit a254910) : push GitHub + update.sh VPS (backup, pull, rebuild, sync permissions) + prune 1,97 Go. Inclut score alignement auto, plan pluriannuel, export Excel, et les 3 chantiers 3899508 (Mon Compte, Objectifs, Invitation ODJ — prérequis du score auto). Vérifié : health 200, login 200, bundle main.81ee37c5.js (tous marqueurs), multiyear + export xlsx 200, objectives 200, account 200. alignment_auto=false en prod (aucun objectif actif créé pour l'instant — dès que l'utilisateur crée un objectif actif, l'ALI passe en auto).

## 2026-08-11 (5) — Trajectoire objectifs + Enveloppes N+1/N+2 + Alertes dépassement
- Objectifs : bloc « Trajectoire » sur chaque objectif (/objectifs) — avancement consolidé pondéré budget (convention temps écoulé), jalons atteints/total (statut 'achieved'), budget consommé, barre colorée selon RAG des projets, % individuel sur chaque chip projet. Backend : list_objectives enrichi (agrégation milestones, _elapsed_pct).
- Arbitrage > Enveloppes Budget : boutons rapides N/N+1/N+2 (btn-envelope-year-{y}, créer bleu / modifier neutre, modale préremplie) + section « Plan pluriannuel {année} » sur chaque carte (planifié vs enveloppe, marge/dépassement, lien /budget). Fetch budgetAPI.multiyear dans load().
- Alertes : check_envelope_overruns (budget/service.py) appelé après PUT multiyear, révision budgétaire et upsert enveloppe — notification 'Dépassement d'enveloppe' (type envelope_overrun) aux TENANT_ADMIN + PMO_USER via la cloche (WebSocket + REST), anti-spam par flag overrun_alerted sur l'enveloppe (reseté au retour sous enveloppe).
- Bug corrigé : statut jalon « done » inexistant → 'achieved'.
- Tests : curl backend 100 % + testing_agent iteration_63 = 100 % backend + 100 % frontend (6/6 pytest + UI), zéro bug, nettoyage des données de test vérifié. Preview uniquement, PAS déployé en prod.

## 2026-08-11 (6) — DÉPLOIEMENT PROD trajectoire + enveloppes N+1/N+2 + alertes
- PROD marcel-ppm.com déployée (commit ecfdd98) : push GitHub + update.sh VPS (backup, pull, rebuild, sync permissions) + prune 1,97 Go (disque 80 %). Timeout SSH 120 s pendant le build mais update terminée avec succès (vérifié).
- Vérifié : health 200, login 200, bundle main.dbc0b9b9.js avec tous les marqueurs (objective-trajectory, btn-envelope-year, envelope-plan, envelope_overrun), /api/objectives 200, /api/notifications 200. En prod aucun objectif stratégique créé pour l'instant — la trajectoire apparaîtra dès le premier objectif rattaché.

## 2026-08-11 (7) — Icône Accueil dans la navigation
- Entrée « Accueil » (icône maison, data-testid nav-accueil) ajoutée en tête de la section Pilotage du rail (desktop + drawer mobile), visible pour tous les rôles (perm null), renvoie vers /home. Testé E2E (clic → /home, état actif). Preview uniquement.

## 2026-08-11 (8) — Accueil personnalisé (cockpit)
- Homepage /home enrichie : bloc rouge « Dépassement d'enveloppe — plan pluriannuel » dans Mes actions en attente (exercices en dépassement, montants, lien /budget, visible si budget.view) + carte « Comités à venir » (instances planifiées à venir, badge type coloré, date, lien Gouvernance, visible si governance.view, état vide géré). Backend home/summary : champs committees + envelope_overruns.
- Testé : curl (admin + viewer) + screenshot E2E avec dépassement simulé puis nettoyé. Preview uniquement.

## 2026-08-11 (9) — DÉPLOIEMENT PROD accueil cockpit + icône Accueil
- PROD marcel-ppm.com déployée (commit d5742ef) via update.sh (lancé avec setsid pour éviter le timeout SSH), prune 1,97 Go, disque 80 %.
- Vérifié : health 200, bundle main.8f62d13d.js (home-committees, home-overrun-alerts, entrée nav Accueil → /home), API home/summary retourne committees + envelope_overruns (vides en prod : aucun comité futur planifié, pas de dépassement — normal).

## 2026-08-11 (10) — Import MS Project intelligent (chantier b du comparatif PPM Express)
- Ré-import upsert : POST /api/msproject/import/{id} met à jour tâches/jalons existants (matching par nom normalisé) au lieu de dupliquer ; date_baseline des jalons préservée (seul date_forecast bouge) ; audit tracé.
- Analyse préalable : POST /api/msproject/analyze/{id} → diff sans modification (new/updated avec détail des changements/unchanged/absent).
- Création portefeuille : POST /api/msproject/import-new → crée un projet MARCEL complet depuis un .mpp/.xml (nom, dates min/max, phases, tâches, jalons, code auto).
- Frontend : MsProjectImport.jsx réécrit en wizard 2 étapes (modes update/create, écran de comparaison avec badges + détail avant application) sur /roadmap ; ProjectDetail : flux analyze → confirm → apply, accept .mpp+.xml (bug .xml only corrigé).
- Parsing unifié XML MSPDI + .mpp binaire (MPXJ) dans _parse_any ; service msproject réécrit.
- Tests : curl backend 100 % (création, idempotence, diff, upsert, baseline, nettoyage) + testing_agent iteration_64 = 100 % backend + 100 % frontend, 0 bug. Preview uniquement, PAS déployé en prod.

## 2026-08-12 — DÉPLOIEMENT PROD import MS Project intelligent
- PROD marcel-ppm.com déployée (commit cc99bb9) via update.sh (setsid), prune 1,97 Go, disque 80 %.
- Vérifié : health 200, bundle main.ac85a188.js (msproject-mode-create, msproject-diff, apply, import-new), login 200, POST /api/msproject/analyze testé en réel sur un projet prod (lecture seule, 5 new détectés, rien modifié).

## 2026-08-12 (2) — Cibles mesurables sur les objectifs stratégiques
- Chaque objectif peut porter un indicateur mesurable : unité (%, M€…), valeur de départ, cible, réalisé actuel + historique des mises à jour (target_history) et % de progression vers la cible (target_progress, gère cibles croissantes ET décroissantes via baseline).
- Backend : champs target_* dans create/update objectives, POST /api/objectives/{id}/target-value (mise à jour rapide du réalisé avec historique + audit), 422 valeur invalide, 403 viewer.
- Frontend Objectives.jsx : section « Cible mesurable » dans la modale (4 champs), bloc TargetBlock sur chaque carte (Réalisé/Cible/départ, % de la cible coloré, barre, mise à jour inline du réalisé au crayon, date de dernière màj).
- Édition fantôme détectée et corrigée sur update_objective (search_replace annoncé OK mais non appliqué — re-vérifié par grep + retest).
- Données démo : cible 15 % (réalisé 8 %) posée sur l'objectif « Réduire le coût de run IT de 15 % ».
- Tests : curl backend complet (création, progress, historique, cible décroissante, 422, 403, nettoyage) + E2E playwright du parcours UI (modale + inline update 27 %→53 %). Preview uniquement, PAS déployé en prod.

## 2026-08-12 (3) — Sparkline de tendance sur les cibles d'objectifs
- Composant Sparkline SVG (Objectives.jsx) : courbe d'évolution du réalisé (target_history, ≥2 relevés) avec points datés (tooltip valeur), dernier point accentué, ligne pointillée verte au niveau de la cible, échelle incluant départ/cible, couleur alignée au % de progression. Libellé « Tendance du réalisé (N relevés) ».
- Testé E2E : ajout d'un 3e relevé (11 %) → sparkline affichée, données démo cohérentes (4→8→11, cible 15 %). Preview uniquement.

## 2026-08-12 (4) — DÉPLOIEMENT PROD cibles mesurables + sparkline
- PROD marcel-ppm.com déployée (commit bbe326b) via update.sh, prune 1,97 Go, disque 80 %.
- Vérifié : health 200, bundle main.176a3ddc.js (target-sparkline, champs cible modale, btn-update-target), cycle complet testé en réel en prod (création objectif avec cible → target-value 3→6 → historique 2 → progress 60 % → suppression du test).
