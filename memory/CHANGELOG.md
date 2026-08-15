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

## 2026-08-12 (5) — Rapport Statut IA + Connecteur Jira lecture seule + Cibles en dérive sur l'accueil
- RAPPORT IA : POST /api/projects/{id}/ai-report — rapport hebdo rédigé par GPT-5.4 (emergentintegrations, EMERGENT_LLM_KEY) depuis les données réelles (budget, jalons retard/à venir, risques par criticité, tâches) → JSON {synthese, faits_marquants, alertes, prochaines_etapes, tendance}, historisé (db.ai_status_reports), PDF reportlab stylé (GET .../ai-report/{rid}/pdf), permission export.status_report (même modèle que le Status Report PPTX — le viewer Altair l'a par seed, choix produit existant). UI : bouton violet « Rapport IA » sur la fiche projet (AiStatusReport.jsx) — génération, sections, tendance, historique, PDF, envoi email via mailto (PAS d'envoi serveur, pas de clé Resend — choix utilisateur 1b).
- JIRA LECTURE SEULE : connectors/jira.py réécrit — vrai client REST v3 (Basic email+token, /myself, /project/search paginé, /search/jql avec nextPageToken + statusCategory, retry 429/5xx), suppression du pattern démo « .atlassian.net » (les vraies instances Cloud passent en réel). Liaisons projets (field_mapping.project_links) ; run_sync remonte issues done/total + epics + % sur db.projects.jira_sync. GET /connectors/jira/remote-projects. UI : onglet « Projets liés » (Connectors.jsx, JiraLinksTab), badge Jira sur les tuiles portefeuille (ProjectTile). Testé contre serveur Jira SIMULÉ /tmp/mock_jira.py sur 127.0.0.1:9876 (à relancer si pod redémarré : nohup python3 /tmp/mock_jira.py &) — chemin HTTP réel validé (Phoenix→WEB : 34/50 = 68 %). Config tenant Altair pointe sur ce mock (démo).
- CIBLES EN DÉRIVE : home/summary retourne objectives_drift (2 derniers relevés s'éloignant de la cible) ; bloc ambre « Objectifs qui s'éloignent de leur cible » sur /home, cliquable vers /objectifs.
- Bug corrigé : useState links manquant dans ConnectorModal (édition fantôme détectée par testing_agent, réappliquée + vérifiée par grep).
- Tests : curl complet + testing_agent iteration_65 (11/15 backend — 4 « échecs » = modèle de permissions existant, pas des bugs ; frontend 80 % → 100 % après le fix links retesté E2E). Preview uniquement, PAS déployé en prod.

## 2026-08-12 (6) — DÉPLOIEMENT PROD rapport IA + connecteur Jira + dérives objectifs
- EMERGENT_LLM_KEY ajoutée à /opt/marcel/.env (env_file du backend prod) — sans exposition.
- PROD marcel-ppm.com déployée (commit 71c046c) via update.sh, prune 1,97 Go, disque 80 %.
- Vérifié : health 200, bundle main.1b1eede3.js (btn-ai-report, ai-report-modal, tile-jira, jira-links-tab, home-objectives-drift), génération IA RÉELLE en prod sur Phoenix (tendance degradation, PDF valide), home objectives_drift présent, jira/status répond (connecteur désactivé par défaut — chaque tenant configure sa propre instance).

## 2026-08-12 (7) — Pack fiabilisation (suite audit externe fait sur la prod)
- Agent IA PMO réparé : modèle claude-sonnet-4-20250514 obsolète (NotFoundError) → openai gpt-5.4 (env AGENT_MODEL). Testé : répond correctement.
- Sélecteur FR/EN retiré (i18n non traduite — fonctionnalité trompeuse). Infra i18n conservée.
- Gantt projet : scroll_to today si dans la plage, sinon 1re tâche (frappe-gantt 1.2.2) — plus d'ouverture sur 2021.
- Création utilisateur : profil par défaut assigné selon rôle (TENANT_ADMIN→Administrateur, PMO_USER→PMO Portefeuille, READ_ONLY→Direction SI) si aucun choisi.
- Business case : badge d'unité (€/%/JH) à côté du libellé pour lever l'ambiguïté des colonnes.
- Données préview : allocations étendues 2026-07→12 (66 lignes, modèle avril), user test.audit backfillé. Heatmap/équipes affichent une utilisation réelle (61 %, 59 %…).
- Données prod (script /tmp/fix_prod_data.js) : dédup profil Administrateur, backfill profile_id des 7 users, allocations étendues, 3 objectifs démo avec cible 15 % (active aussi l'ALI auto en prod).

## 2026-06 (fork) — Clôture pack fiabilisation : vérifications finales
- Gantt vérifié visuellement (projet SAP S/4HANA) : ouverture sur aujourd'hui/2026 avec bouton Today, plus de 2021.
- Doublons profils Preview dédupliqués : betacorp Administrateur ×2 et Chef de Projet ×2 → conservé le profil système avec code (ADMIN, CHEF_DE_PROJET), users remappés, légacy sans code supprimés. 0 doublon restant, 0 user sans profile_id. Logins betacorp OK post-remap (admin: perms *, pm: 32 perms).
- Régression : heatmap 30/42 cellules non nulles (max 100 %) ; agent IA PMO répond en 1,7 s (10 projets actifs).
- Business case : formatage par unité (fmtValue €/%/JH) confirmé dans BenefitsSection.jsx (colonnes Attendu/Réalisé + badge unité).
- Preview uniquement — PAS déployé en prod (dédup prod déjà faite via fix_prod_data.js le 2026-08-12).

## 2026-06 (fork) — Lot A + Lot B livrés et DÉPLOYÉS EN PROD (commit 013e6f6)
### Lot A (agent-testé, iteration_67 sans bug bloquant)
- Cycle de vie projets & gates intégrés à la gouvernance : demandes de passage de phase, livrables par gate, validations Architecte/Sécurité (403 croisés testés), décisions Go/No-Go/Go avec réserves, dérogations, ODJ, page « Mes validations », onglet Cycle de vie sur la fiche projet.
- Skills ressources, champs personnalisés projets, vues/filtres sauvegardés, snapshots mensuels portefeuille, seuils RAG configurables, capacités métiers↔applications, pondération des votes PB par rôle (moyenne pondérée testée : 600k/400k).
### Lot B (backend MFA : 15/15 assertions curl+pyotp ; frontend : testing_agent iteration_68 — 6/6 features PASS)
- MFA TOTP : setup QR + clé manuelle, activation avec code, 8 codes de secours (consommation testée), login en 2 étapes (ticket JWT type mfa), désactivation, section MFA dans Mon compte, formulaire MFA sur /login. Comptes SSO exclus.
- Dark mode : bouton theme-toggle-btn dans le header, classe .dark sur <html>, persistance localStorage marcel_theme, overrides CSS (variables shadcn + sélecteurs [class~=] sur la palette Clarity).
- i18n FR/EN : sélecteur lang-toggle-btn réintroduit, navigation latérale + titres de sections traduits (tKey, data-testid canoniques français conservés), locales fr/en enrichies (nav/sections/theme).
- Onboarding : visite guidée 4 étapes à la 1re connexion (localStorage marcel_onboarded_<user_id>), skip/next/prev.
- Mode Présentation COMEX : page /presentation (5 slides, navigation clavier + boutons), bouton depuis le Dashboard.
- Favoris projets : étoile tile-favorite-{id} sur les tuiles du portefeuille, persistance API /favorites.
- Correctifs post-test : mfa-cancel-btn (bouton Annuler du setup MFA) + testid mfa-secret.
### Déploiement production marcel-ppm.com
- Push GitHub 741eb08→013e6f6, update.sh VPS (pull, rebuild, sync permissions 2 tenants), prune 1,97 Go → disque 81 %.
- Vérifié : /api/health 200, backend healthy sans erreur logs, bundle main.3054b24c.js contient les 7 marqueurs Lot A+B (theme-toggle, lang-toggle, onboarding, mfa, favoris, presentation, lifecycle-tab), routes /api/auth/mfa/* et /api/lifecycle/* présentes et protégées (403 sans auth).
### Exclusions confirmées par l'utilisateur : collaboration (2), emails réels (3), connecteurs Jira/SAP (4), lot C.

## 2026-06 (fork) — Suite : correctifs + onglet Informations projet (déployés en prod)
- Backfill codes projets PROD : les 9 projets prod n'avaient aucun code (backfill jamais exécuté en prod) → PRJ-001 à PRJ-009. Recherche par code (Ctrl+K) désormais opérationnelle en prod. Données uniquement, pas de redéploiement.
- Fix bouton « Présentation » du Dashboard : useNavigate non initialisé (ReferenceError: navigate is not defined) → clic sans effet en prod. Corrigé, testé Preview (clic → slides → sortie), déployé (commit 2787fe6, bundle main.d237662d.js).
- Onglet « Informations » sur la fiche projet, en 1re position avant Aperçu (commit 406a9f5) : direction, programme (select), description, leading indicators, outcome, income (€), expected result, produits/apps impactés (multi-sélection référentiel APM), ART (select trains SAFe), Epic Owner (select ressources). Backend : 8 nouveaux champs dans ProjectCreate/ProjectUpdate (model_dump → aucune autre modif service). Testé : curl PUT champs persistés + screenshot (onglet en 1re position, sauvegarde OK). Déployé prod, bundle vérifié (marqueur project-info-tab), health 200, prune, disque 81 %.

## 2026-06 (fork) — Lot Événements & Pilotage : 8 features livrées + DÉPLOYÉES EN PROD (commit be07d04)
### Fonctionnel (backend 28/29 curl PASS + testing_agent iteration_69 : 18/20, 2 faux positifs re-vérifiés OK)
1. Calendrier des instances (/calendrier) : référentiel de 22 types validés avec l'utilisateur (5 niveaux stratégique→run, avec Portfolio Sync, comité d'investissement rattaché gouvernance), génération idempotente du planning annuel (272 événements 2026), filtres par niveau, statuts tenu/annulé, ajout de types custom.
2. Reforecast trimestriel (Budget → Reforecast) : scope trimestre valorisé en € (JH alloués × TJM réel, TJM moyen en fallback), validation par cellule avec ajustement, écarts budget/forecast/consommé.
3. Transferts budgétaires (Budget → Transferts) : X→Y avec motif, contrôles (même projet, budget insuffisant → 400), impact immédiat budget_total, journal.
4. Console budget cible (Budget → Budget cible) : leviers valorisés (features scope sec/étendu × TJM, pause projet = reste à faire), simulation avec barre de progression, application réelle (scope_status=out, status=pause), historique des coupes.
5. Console capacitaire (/capacite) : charge vs capacité 3/6 mois, axes équipe/ressource/compétence, heatmap taux (vert<85/ambre/rouge>100).
6. Enveloppes stratégiques (Budget → Enveloppes) : par programme ou thème stratégique (CRUD thèmes), consommation engagé/consommé vs enveloppe. Champ strategic_theme_id ajouté aux projets.
7. Trajectoire SI (Architecture → Trajectoire SI) : board TIME (conserver/moderniser/remplacer/décommissionner), jalons de trajectoire datés.
8. Export PowerPoint COPIL (Portefeuille → bouton COPIL PPTX) : moteur core/pptx.py charte MARCEL (cover indigo, KPI cards, tables zébrées, footer paginé), deck COPIL 7 slides (KPIs RAG, top projets, alertes, décisions, prochaines instances). python-pptx figé dans requirements.
### Incident déploiement prod (résolu)
- 1er build échoué : « no space left on device » — cause racine : log json Docker du conteneur mongo JAMAIS rotaté = 6,9 Go. Truncate + rotation ajoutée au compose (x-logging 20m×3, appliquée à mongo/backend/frontend/nginx-http). Disque : 97 % → 57 %.
- Pendant le rebuild, le VPS a saturé (SSH + site inaccessibles ~5 min) puis a récupéré seul. Déploiement final OK : bundle main.badd53a9.js avec les 8 marqueurs, routes protégées 403, 4 conteneurs healthy.

## 2026-06 (fork) — Reporting PPTX dédié par instance (déployé prod, commit ee57bcf)
- Bouton de téléchargement (FileDown) sur chacun des 272 événements du calendrier → GET /api/exports/event/{id}.pptx.
- 12 builders de slides mappés par mots-clés du type d'instance : COPIL (enrichi d'une slide écart budget/forecast), reforecast (tableau Q1-Q4 + transferts), dossier de gate (demandes, livrables, avis, décisions), stratégique (enveloppes), sécurité (vulnérabilités), CAB/MEP, capacité, fournisseurs (contrats externes), SAFe (trains/PIs/objectifs), trajectoire TIME, demandes, projets/risques/jalons. Fallback = deck COPIL.
- Testé : 16/16 curl (15 types d'instances → PPTX valides 4-8 slides + 404) + toast de téléchargement vérifié en screenshot.
- BUGS CORRIGÉS AU PASSAGE : (1) le <Toaster/> sonner n'était monté NULLE PART — tous les toasts de l'app étaient invisibles depuis toujours → monté dans App.js (richColors). (2) Les contrôles hover du calendrier décalaient la mise en page (risque de clic sur Annuler) → espace réservé via opacity.
- Prod vérifiée : bundle main.adada18c.js, route exports/event protégée (403), disque 43 % après prune.

## 2026-06 (fork) — Rework Roadmap complet (déployé prod, commit 4b35fcd)
- ✅ Lisibilité/navigation : fenêtre 12 mois glissants par défaut (-3/+9, toggle « 12 mois »/« Tout »), zoom Mois/Trimestre/Année, bouton « Aujourd'hui » (recentrage), barres clippées proprement aux bords de fenêtre (coins non arrondis côté clippé), scroll header/body synchronisé.
- ✅ Phases & gates : segments colorés par phase lifecycle dans les barres (découpage par gates : from_phase→to_phase sur target_date), liseré RAG en bas de barre, losanges gates blancs cerclés couleur décision (GO vert, NO-GO rouge, réserves ambre…), toggle « Phases du cycle », légende dynamique.
- ✅ Groupements : Programme / Direction / Thème stratégique / ART (roadmap-groupby), libellés résolus via budgetOpsAPI.listThemes + safeAPI.listTrains.
- ✅ Dépendances refondues : masquées par défaut (mode « Au survol »), badge compteur par projet (dep-badge-{id}, clic = épinglage), tracés SVG orthogonaux (H/V) orientés cible→source, conflits de dates (source démarre avant fin de la cible, statut≠resolved) en rouge trait plein épais + compteur « ⚠ N en conflit », modes Au survol/Toutes/Masquées.
- ✅ Export PPTX Roadmap : GET /api/exports/roadmap.pptx (permission portfolio.view) — barres RAG 12 mois, losanges jalons gouvernance, groupes programme, 14 lignes/slide + bouton « Roadmap PPTX » (toast).
- Testé : iteration_70 = 100 % PASS backend+frontend (zoom, groupby, phases, gates tooltips, 3 modes dépendances, épinglage, conflits, download PPTX, non-régression onglets/filtres/liens). Curl : 200 authentifié / 403 sans auth.
- Prod vérifiée : bundle main.47d8ef9b.js (tous marqueurs), health ok, route protégée 403, 4 conteneurs healthy, disque 58 %.
- Leçon : l'URL preview di-360-dash était une ancienne URL d'un job précédent → toujours lire REACT_APP_BACKEND_URL (project-sync-61).

## 2026-06 (fork) — Budget Participatif sur le modèle SAFe (Preview, NON déployé prod)
- ✅ Affectation features ↔ PI : GET /api/safe/pis/{id}/features, GET /api/safe/features/candidates, PATCH /api/safe/features/{task_id}/pi (+ train_id auto). UI Trains SAFe : section « Features du PI (n) · valorisation totale » dans chaque panneau PI + modal « Gérer les features » (2 groupes Dans ce PI / Disponibles, cases à cocher, jh + €).
- ✅ Valorisation feature : budget_planned_k×1000 sinon jh_planned × TJM ressource (fallback TJM moyen tenant, 600 si aucun).
- ✅ Session PB mode SAFe : création sur Train+PI → items auto-générés depuis les features valorisées (ref=task_id), aperçu avec total cliquable pour remplir l'enveloppe. Mode manuel conservé (toggle).
- ✅ Arbitrage ligne de coupe : résultats triés par allocation moyenne, retained = cumul coûts ≤ enveloppe (greedy, allocation > 0), retained_count/retained_cost + badges Retenue/Reportée + bandeau ligne de coupe.
- ✅ Décision appliquée au scope : « Appliquer l'arbitrage au scope » → features retenues scope_status=sec, reportées=etendu + trace pb_decision sur les tasks + résumé decision sur la session + toast.
- Testé : iteration_71 backend 17/17 PASS + /pb frontend validé. 1 bug critique trouvé (FeaturesModal non défini — le search_replace avait signalé succès sans écrire le composant) → ré-ajouté via insert_text, /safe/trains re-validé interactivement (rows, modal, toggle 4→5→4, refresh).
- LEÇON (récurrence) : toujours grep après un gros search_replace multi-blocs — 2e occurrence du phénomène « edit fantôme ».

## 2026-06 (fork) — WSJF dans l'arbitrage PB + déploiement prod PB SAFe (commit aa3df8f)
- ✅ WSJF par feature : saisie inline dans « Gérer les features » (PATCH /api/safe/features/{id}/wsjf, validation ≥ 0), badge WSJF affiché dans l'aperçu de création de session, le modal de vote (pb-vote-wsjf-*) et la restitution. Les items PB SAFe embarquent le wsjf à la création.
- ✅ Testé Preview : 4 WSJF fixés par API (12/8.5/15/6), session créée avec wsjf dans les items, 4 badges visibles dans le modal de vote (screenshot). Session dupliquée de test supprimée.
- ✅ PROD marcel-ppm.com déployée (update.sh, conteneurs healthy, disque 59 %) : bundle main.ffad235c.js contient tous les marqueurs PB SAFe + WSJF, health ok, routes protégées 403.
- Rappel piège : la RACINE marcel-ppm.com = site marketing → vérifier le bundle via /app, pas via /.

## 2026-06 (fork) — Deck PPTX d'arbitrage PB (Preview, NON déployé prod)
- ✅ GET /api/exports/pb/{session_id}.pptx (permission portfolio.view) : cover (session + ART·PI), KPIs (enveloppe, votants, retenues, coût retenu, reste), tableau feature par feature (#, WSJF, coût, allocation moy., décision Retenue verte/Reportée rouge) avec sous-titre ligne de coupe, slide décision appliquée si status decided. Fonctionne aussi en mode manuel (candidats libres, financé/partiel).
- ✅ Bouton « PPTX » sur chaque carte de session (/pb, pb-pptx-btn-{id}) + toast. Testé : 200 authentifié (2 modes), 403 sans auth, download UI OK.

## 2026-06 (fork) — Catalogue d'indicateurs PPM (Preview, NON déployé prod)
- ✅ Référentiel : 149 indicateurs importés depuis l'Excel utilisateur (/app/backend/data_catalogue.xlsx, auto-seed si collection vide) — 8 thématiques, P1/P2/P3, niveaux, formules, seuils, pièges. Classification calculabilité : 24 auto / 90 saisie manuelle / 35 source externe (regex sur données sources : ERP, SIRH, télémétrie…).
- ✅ Module backend modules/catalog : GET /api/indicator-catalog (+?scope=), selections par scope (project/program/portfolio/dashboard — dashboard PAR USER, autres par tenant), preset-p1 (P1 calculables), values/{scope} (moteur 24 indicateurs branchés sur données réelles : EVM CPI/SPI/EAC/VAC, jalons tenus/retard, risques, deps, RAG, complétude/fraîcheur, gates, capacité fallback dernier mois d'allocations, features PI, vélocité/Say-Do).
- ✅ Frontend : page /catalogue-indicateurs (nav « Indicateurs », recherche+filtres+fiches dépliables), composant IndicatorsPanel réutilisable (cartes par thématique, badge statut, fiche détail, sélecteur accordéon avec Socle P1) intégré dans : fiche projet (onglet), programme (onglet), portefeuille (section), dashboard (section « Mes indicateurs » — widgets existants préservés, 17 vérifiés).
- Testé : iteration_72 = 100 % PASS backend (14/14) + frontend (tous flux) + non-régression /pb /roadmap. 2 écarts cosmétiques de noms testids notés non bloquants.
- Piège corrigé en cours de dev : édit ProgramDetail avait cassé `].map(` — détecté et corrigé immédiatement (toujours relire les édits de tableaux JSX).

## 2026-06 (fork) — Catalogue d'indicateurs DÉPLOYÉ PROD (commit f816cfd, bundle main.e08616f2.js)
- update.sh OK, conteneurs healthy, health/DB ok, /api/indicator-catalog protégé 403, tous marqueurs frontend présents, openpyxl 3.1.5 dans l'image, data_catalogue.xlsx présent dans le conteneur (/app/data_catalogue.xlsx) → auto-seed au premier accès authentifié. Disque 59 %.

## 2026-06 (fork) — Dossier d'engagement (Preview, NON déployé prod, commit 379d3bb)
- ✅ Inspiré des documents client (sanity check + template comité) SANS plagiat : moteur générique MARCEL, formulations neutres, critères paramétrables.
- ✅ Champs projet structurés : scope_in/out, nfr, impacted_entities, governance_roles [{role,name}], build_to_run, budget_breakdown [{entity,capex,opex}] — section « Cadrage & gouvernance » dans l'onglet Informations.
- ✅ Module engagement : référentiel de critères par phase (21 cadrage / 29 conception / socles allégés real/recette/deploiement), seed par tenant, types auto (22 checkers sur données réelles) et attesté (checkbox + N/A avec justification OBLIGATOIRE + trace par/quand), CRUD critères (renommer, obligatoire/recommandé, actif, custom).
- ✅ Readiness : GET /projects/{id}/engagement/readiness (score %, manquants obligatoires) ; demande de gate bloquée 422 si obligatoires manquants, dérogation readiness_override tracée sur la gate (readiness_score stocké).
- ✅ Deck « Dossier d'engagement » PPTX : GET /exports/engagement/{id}.pptx (10 slides : identité, pitch & périmètre, valeur, gouvernance, jalons, features, budget+ventilation, build-to-run, risques, préparation+décision attendue) + bouton dans le panneau.
- ✅ UI : panneau en tête de l'onglet Cycle de vie (score, barre, 2 colonnes auto/attestés, Gérer les critères, Dossier PPTX) ; dérogation via confirm dans la demande de passage.
- Testé : iteration_73 = 13/13 backend + frontend 100 %, zéro bug. Post-test : justification obligatoire pour N/A ajoutée (400) + catch frontend.

## 2026-06 (fork) — Dossier d'engagement DÉPLOYÉ PROD (commit 5f493a0, bundle main.e031b98c.js)
- update.sh OK, conteneurs healthy, health/DB ok, /api/engagement/* protégé 403, tous marqueurs frontend présents. Le référentiel de critères s'auto-seede par tenant au premier accès. Disque 60 %.

## 2026-06 (fork) — Lot 1 audits UX/UI « cohérence des chiffres » DÉPLOYÉ PROD (commit 88ecb0b, bundle main.09f356f3.js)
- ✅ F01 : heatmap /teams remonte les vraies utilisations (Dev A 67 %, Support 100 % surcharge) — filtre period_month corrigé (format YYYY-MM-01 en base) + bannière teams-no-alloc-banner si aucune allocation. Régression préexistante réparée au passage : create_team avait perdu sa signature def dans teams/service.py → POST /api/teams crashait (testé 201 + DELETE 204).
- ✅ F02/F03 : fiche projet — JH consommés/prévus = Σ tâches quand elles existent (mention « Σ tâches » / « déclaré »), KPI EAC marqué « déclaré », panneau RAF enrichi de « EAC déclaré » + « Écart atterrissage vs EAC » (rouge si >5 %).
- ✅ F04 : anneau « Avancement » renommé « Temps écoulé » (ProjectTile + KPI fiche projet) — il affichait le temps écoulé.
- ✅ F05 : Roadmap bascule auto en vue complète si <30 % des projets visibles dans la fenêtre 12 mois. F06 (Gantt mai 2022) NON reproduit → non corrigé.
- ✅ F07 : overrides .dark dans index.css pour tous les fonds/bordures/textes d'alertes clairs (rose/amber/emerald/blue-50/100).
- ✅ F09 : GET /api/profiles dédoublonne par code (garde le profil référencé par des users, supprime les orphelins) + user_count par profil — 12 codes uniques.
- ✅ F10-F12 : connecteurs désactivés → « Dernier test (connecteur désactivé) » ; KPI Vendors alertes → sous-titre « dépassements forfait & seuils contrats » ; widgets Dashboard verts/à risque → « % du portefeuille » ; Conformité → badge « En retard » (rose) si days_remaining < 0 ; Arbitrage → jitter des bulles superposées + taille ∝ budget.
- Testé iteration_74 : 100 % PASS backend (7/7 pytest) + frontend (14 flux), aucune régression (IndicatorsPanel monté 1 seule fois, dashboard/portefeuille OK). Suite pytest : backend/tests/test_lot1_coherence_chiffres.py.
- PROD marcel-ppm.com : update.sh (VPS saturé ~4 min pendant le rebuild puis récupéré, schéma connu), commit 88ecb0b, bundle main.09f356f3.js avec tous les marqueurs (vérif fragments ASCII — les accents sont encodés dans le bundle minifié, grep accentué = faux négatif), health 200/DB ok, routes protégées 403, login 200, conteneurs healthy, disque 59 % (7,1 Go libres).
- Recos non bloquantes du testing agent (backlog) : scinder ProjectDetail.jsx (2104 lignes), placeholder « Pas de RAF calculé » quand raf absent, seuil 30 % roadmap configurable.
- Backlog audits (non validé par l'utilisateur) : Lot 2 intuitivité (~35-50 cr), Lot 3 navigation/12 onglets (~40-55 cr), Lot 4 design system (~50-70 cr).

## 2026-06 (fork) — Lots 2/3/4 audits UX/UI + alerte cohérence DÉPLOYÉS PROD (commit b3643f9, bundle main.5dd8edd7.js, css main.fda4f6d5.css)
- ✅ Lot 2 — parcours : ProjectModal réécrit — en CRÉATION seulement 4 champs requis (nom, méthodo, début, fin prévue), RAG masqué (défaut vert + message explicatif), baseline auto = forecast, CAPEX/OPEX/JH dans section repliable « Budget & charges (optionnel) » (budget-section-toggle) ; en ÉDITION formulaire complet inchangé. Backend : jh_planned et status_rag optionnels (défauts 0/green) — POST minimal testé 201.
- ✅ Lot 2 — indicateurs 1 clic : état vide IndicatorsPanel avec 2 boutons — « Activer le socle recommandé (P1) » (indicators-quick-p1-{scope}, POST preset-p1 puis reload) + « Choisir mes indicateurs ». NOTE : le preset P1 dashboard a été activé pour admin@altair.fr par le test (user-scoped).
- ✅ Lot 3 — fiche projet : 12 onglets → 5 groupes 2 niveaux (Aperçu, Informations, Exécution [tâches/jalons/équipe], Pilotage [Suivi & RAF/risques/décisions/indicateurs], Gouvernance [Cycle de vie & engagement/business case/scope]) — testids project-tab-{id} (sous-onglets + groupes single) et project-tabgroup-{grp}. Deep-link ?tab= (useSearchParams). Bouton header « Dossier d'engagement » (btn-engagement-shortcut) → onglet cycle en 1 clic. Résout F75 (onglets débordants) + trouvabilité dossier d'engagement.
- ✅ Écart auto : GET /api/projects/consistency (route AVANT /projects/{id} !) — projets actifs avec tâches dont jh_consumed/jh_planned déclarés divergent de Σ tâches (>10 % et ≥5 JH). Démo Altair : 5 projets détectés (PRJ-006 100 %, PRJ-004 31 %, DATA-002 22 %, PRJ-003 14 %, PRJ-002 13 % — valeurs contre-vérifiées). Bandeau ambre /portfolio (portfolio-consistency-alert) dépliable, items cliquables → /projects/{id}?tab=taches.
- ✅ Lot 4 — design tokens : 21 tokens m-* en triplets RGB (:root index.css) + tailwind.config avec <alpha-value> (opacités /25 OK). ~2000 classes hex bracketées migrées par perl (m-ink/m-muted/m-border/m-blue/m-primary/m-red/m-green…). Unifications : #2563eb→m-blue, blue-600/700→m-blue/m-blue-dark, dc2626→m-red, rounded-[10px]→rounded-lg (39). DARK MODE refondu : redéfinition des variables NEUTRES dans .dark (ink/muted/border/bg/surface/lilac/blue-soft/red-soft/green-soft) + overrides d'attribut pour les couleurs de MARQUE en texte seulement (text-m-primary/text-m-blue/text-m-red… éclaircis) — ne JAMAIS redéfinir m-primary/m-blue en dark (conflit fond de bouton vs texte). Correctifs dark additionnels : bg-m-ink (bouton filtre calendrier), bg-[#f3edb5] (tuile orange), bg-[#d5efec] (tuile cadrage).
- ⚠️ PIÈGE ÉVITÉ documenté : les anciens overrides dark ciblaient [class~="text-[#26243a]"] — le renommage des classes les avait cassés → migrés vers variables. Toute future tokenisation doit vérifier index.css.
- Testé iteration_75 : 100 % PASS backend (5/5 pytest — création minimale, consistency shape/valeurs/403/ordre de route, preset P1) + frontend (tous flux, tokens vérifiés par getComputedStyle, dark OK). Suite : backend/tests/test_lot234_ecart.py.
- PROD marcel-ppm.com : commit b3643f9, tous marqueurs bundle/css présents, health 200, /api/projects/consistency protégé 403, conteneurs healthy, disque 59 %.
- Backlog design restant (mineur) : hex non tokenisés à faible fréquence (ambres b45309/8a6d1a, c9c6da, 75708c), classes utilitaires index.css (.rail-item, .card-surface) encore en hex (avec leurs propres overrides dark fonctionnels), split ProjectDetail.jsx (2150 lignes), placeholder RAF absent.
