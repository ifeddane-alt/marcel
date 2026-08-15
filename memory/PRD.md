# PRD — MARCEL

## 2026-08 (3) — DSI 360° + Cockpit indicateurs + PB SAFe + IA proactive — DÉPLOYÉ PROD (commit 741eb08, testé iteration_66 backend 34/34 + frontend 100 %)
- **Modules DSI 360°** (Application = objet pivot) : APM/portefeuille applicatif (`modules/applications/`, pages Applications + ApplicationDetail, matrice TIME, cycle de vie, TCO, obsolescence, lien projets↔apps), Run (`modules/run/`, activités récurrentes, budget OPEX, allocations ressources build+run intégrées à la heatmap, incidents/SLA, MEP/gels), Sécurité (`modules/security/`, risques, exigences DORA/NIS2/RGPD/ISO27001, vulnérabilités, posture par app), Architecture (`modules/architecture/`, flux, standards/dérogations, radar techno, dette technique). `core/simple_crud.py` factorisé.
- **Cockpit indicateurs par méthodologie** (`modules/indicators/`, `ProjectIndicators.jsx`, onglet Pilotage sur fiche projet + page /pilotage portefeuille) : socle commun + EVM CPI/SPI (waterfall), vélocité/burndown (agile, saisie sprints), PI predictability (SAFe), WIP (kanban). Bug tab Pilotage manquant dans tabs array trouvé par testing_agent et corrigé.
- **Participatory Budgeting SAFe** (`modules/pb/`, page ParticipatoryBudgeting) : sessions PB (enveloppe, candidats value streams+epics, participants, échéance), vote/répartition, consolidation par moyenne, statuts financé/partiel/non financé, restitution.
- **IA proactive** (`agent/insights.py`, cron 06h15 UTC : règles déterministes + 1 synthèse LLM/tenant), **rapport IA portefeuille PDF** (`status_report/portfolio_report.py`, hebdo lundi 07h00 UTC + à la demande, `PortfolioAiReport.jsx`), **rappels timesheets** (lundi 09h00 UTC, `timesheets/reminders.py`), `core/email.py` (no-op silencieux tant que RESEND_API_KEY absente — AUCUN email réel ne part).
- **PROD marcel-ppm.com vérifiée** : health 200, bundle main.7a80b0c8.js avec routes /applications /run /securite /architecture /pilotage, login prod OK, 6 endpoints summary/indicators/pb → 200, scheduler 4 jobs actifs, permissions synchro 2 tenants, prune 1,97 Go, disque 81 % (3,4 Go libres).
- ⚠️ Les données DSI de démo (seed_dsi_demo.py) n'existent QU'EN PREVIEW — les pages DSI prod démarrent vides (données réelles à saisir).
- ⚠️ requirements.txt nettoyé avant déploiement (playwright/pymupdf/pypdf/pyee/greenlet retirés — paquets pod-only).
- **Chantier Collaboration (commentaires/mentions) STOPPÉ à la demande de l'utilisateur avant implémentation** — rien de livré, squelette supprimé. À reprendre du backlog si souhaité.

## 2026-08 (2) — Mon Compte + Objectifs Stratégiques + Invitation ODJ (testé : backend curl 100 %, frontend testing_agent iteration_61 = 100 %, AUCUN bug)
- **Mon Compte** (`Account.jsx`, route /account, footer utilisateur du rail → lien nav-account) : carte profil (nom, email, profil de permissions, rôle, organisation, dates) + changement de son propre mot de passe (GET /api/auth/account, POST /api/auth/change-password : vérif bcrypt mdp actuel 401, min 8 car. 422, refus mdp identique, comptes SSO → message dédié, audit "user.password_changed"). Playbook integration_expert suivi.
- **Objectifs stratégiques** (`modules/objectives/`, `Objectives.jsx`, route /objectifs, nav « Objectifs » icône Goal entre Portefeuille et Budget, perm portfolio.view, écriture TENANT_ADMIN/PMO_USER) : référentiel (titre, description, axe, horizon, porteur, statut actif/atteint/abandonne), rattachement projets (PUT /objectives/{id}/projects, champ objective_ids sur les projets, $addToSet/$pull), métriques par objectif (nb projets, budget, répartition RAG, chips cliquables), KPIs d'alignement portefeuille (GET /objectives/alignment : % projets alignés, % budget aligné, liste des non-alignés), audité (entity "objective" + action projects_linked). Seed démo : 3 objectifs, 4/10 projets alignés, 66 % du budget.
- **Invitation ODJ** (`modules/governance/pdf_invitation.py`, GET /api/governance/{id}/invitation-pdf) : PDF reportlab (en-tête tenant, type/date FR/statut, table ordre du jour avec durée totale, participants, projets en périmètre) + bouton « Envoyer par email » = lien mailto: prérempli (sujet [TYPE] + ODJ numéroté dans le corps) sur chaque instance dépliée de /governance, à côté d'Export COPIL.
- ⚠️ Mot de passe de test.audit@altair.fr changé en MonCompte2026! (test_credentials.md à jour).
- ⚠️ NON DÉPLOYÉ en production — Preview seulement, déploiement à la demande de l'utilisateur.
- Note testing agent (non bloquant) : nav-account rendu 2× (sidebar mobile cachée + rail desktop) comme tous les items de nav — pattern existant.

## 2026-08 — Instances COPIL + DÉPLOIEMENT PROD des 5 chantiers (testé : backend curl 100 %, frontend testing_agent iteration_60 = 11/11)
- **Instances COPIL** (`modules/governance` réécrit, `GovernanceModal.jsx`, `GovernanceCalendar.jsx`, `Governance.jsx` enrichi) : CRUD complet des comités (POST/PUT/DELETE /api/governance, permission governance.edit, 422/403 validés) ; champs : type (copil/coproj/comex/codir/steering/autre), date+heure, statut (planifie/tenu/annule), projets en périmètre, participants, **ordre du jour** ({title, presenter, duration_min}), compte-rendu ; **vue calendrier mensuelle** (grille lun-dim, chips colorées par type, navigation, clic chip → liste dépliée) ; tri liste : à venir d'abord ; badges statut + boutons éditer/supprimer sur chaque instance ; suppression = décisions détachées (governance_id→None) ; audité (entity_type "governance" ajouté au journal + filtre AdminAudit). Relevé de décisions rattaché = section décisions par instance (existante, régression OK).
- Migration : 5 instances legacy sans statut → "tenu" (préview ET prod). Démo : COPIL Juillet 2026 (tenu + CR) et COPIL Septembre 2026 (planifié, 5 points ODJ) créés en préview.
- **DÉPLOYÉ EN PRODUCTION marcel-ppm.com** (commit 8ef316b, 2026-08-11) : push GitHub + scripts/update.sh sur VPS (backup, pull, rebuild Docker, sync permissions 2 tenants) + docker system prune (1,97 Go) + migration statuts prod. Vérifié : /api/health ok, /login 200, bundle main.ebe10c09.js contient les testids des 5 features, login prod OK, 5 instances statut tenu, audit-logs actif (total 0), endpoints protégés 403. Disque VPS 80 %.
- ⚠️ Date système du pod : AOÛT 2026 (pas juin).
- Note code review (non bloquant) : date_scheduled stocké `...T{heure}Z` littéral (heure saisie = heure affichée, round-trip symétrique, cohérent avec le legacy — pas de conversion fuseau).

## 2026-06 — 4 chantiers P0/P1 de l'audit livrés (testé : backend 100 % curl, frontend testing_agent iteration_59 + contre-vérification)
- **Gestion utilisateurs** (`profiles/router.py+service.py`, `AdminUsers.jsx` réécrit) : POST /api/admin/users (validation email/mdp 8 car./409 doublon), PATCH {profile_id,name,is_active} avec garde anti-auto-désactivation (400), POST /{id}/reset-password ; login (auth/router.py) et SSO (sso/service.py) refusent les comptes is_active=false (403 « Compte désactivé ») avec message affiché sur /login ; UI : modal création, modal reset mdp, toggle actif/désactivé avec ConfirmDialog, badge statut.
- **Business case bénéfices** (`projects/service.py+router.py`, `components/BenefitsSection.jsx`) : GET/PUT /api/projects/{id}/benefits (items {label, category financier/productivite/qualite/conformite/autre, unit EUR/JH/%/autre, expected_value, realized_value, horizon, comment}, summary expected_eur/realized_eur/realization_pct) ; onglet « Business case » sur la fiche projet (4 KPIs dont bénéfices vs budget, tableau CRUD, KPIs rafraîchis en direct) ; visibilité portefeuille : ligne bénéfices sur les tuiles (tile-benefits-*) + colonne « Bénéfices » en vue liste. Projet Phoenix seedé avec 2 bénéfices (250 k€ attendus / 80 k€ = 32 %).
- **Registre dépendances sur la Roadmap** (`Roadmap.jsx`) : 3e onglet « Dépendances (n) » — 4 KPIs (total/critiques ouvertes/bloquées/résolues), table avec liens projets, badges impact, échéance rouge si dépassée, CRUD complet (DepFormModal : source/cible figés en édition car le backend ne les modifie pas). Les flèches SVG sur la timeline existaient déjà ; 7 dépendances en base.
- **Journal d'audit** (`core/audit.py`, `modules/audit/`, `AdminAudit.jsx`, route /admin/audit + nav « Journal d'audit ») : collection audit_logs, hooks sur projets (create/update avec diff/delete/budget-revision), budget (revise), décisions (CRUD), utilisateurs (created/updated/password_reset — jamais la valeur du mdp), bénéfices ; GET /api/admin/audit-logs (filtres entity_type/action/q, pagination, admin only 403 sinon) ; UI : badges par action, lignes dépliables old→new, filtres, charger plus.
- ⚠️ iteration_59 a remonté 2 « bugs » MEDIUM qui sont des FAUX POSITIFS, contre-vérifiés par reproduction Playwright : (1) le message « Compte désactivé » S'AFFICHE bien sur /login (login-error), (2) les KPIs business case SE RAFRAÎCHISSENT instantanément (250 000 → 260 000 € constaté).
- ⚠️ LEÇON RÉCURRENTE : 1 search_replace fantôme sur api/index.js (usersAPI/auditAPI non appliqués + fin de fichier corrompue) — détecté par grep + log webpack, corrigé. TOUJOURS grep après un gros batch.
- ⚠️ test_credentials.md était OBSOLÈTE (cp@altair.fr/manager@altair.fr → vrai mdp Altair2026!, pmo@ → Pmo1234!, viewer@ → View1234!) — fichier réécrit avec les credentials vérifiés.
- NON déployé en prod — en attente de validation utilisateur du Preview.

## 2026-06 — Audit de complétude fonctionnelle de l'APPLICATION (livré, rapport remis)
- Demande utilisateur : audit des fonctionnalités de l'app (complet ou pas), posture directeur du pilotage stratégique DSI. NE PLUS PARLER DU SITE.
- Rapport complet : `/app/memory/AUDIT_COMPLETUDE_2026-06.md`. Verdict ~85 % de couverture PPM entreprise.
- P0 identifiés : (1) cycle de vie utilisateur inexistant (pas de création/désactivation user, pas de reset/changement mot de passe, pas de « Mon compte »), (2) aucun audit trail, (3) emails réels inactifs (Resend) + pas de relances timesheets.
- P1 : bénéfices/business case ✅ (livré 2026-06), planification pluriannuelle, objectifs stratégiques hors silo SAFe, instances COPIL, ~~UI dépendances inter-projets~~ ✅ (registre roadmap livré 2026-06).
- P2 : documents/commentaires, 2FA, skills, diffusion planifiée, connecteurs réels.
- ✅ TRAITÉ (2026-06) : cycle de vie utilisateur, journal d'audit, bénéfices, registre dépendances. RESTE P0 : emails réels (clé Resend utilisateur) + relances timesheets ; page « Mon compte » / changement de son propre mot de passe.

## 2026-06 — Teasers vidéo YouTube 30 s (livrés en téléchargement preview)
- 4 MP4 1080p/30fps H.264+AAC ~28,5 s : `marcel_teaser_{fr,en}_{femme/homme|female/male}.mp4` — pipeline : voix off OpenAI TTS tts-1-hd via emergentintegrations (nova=féminine, onyx=masculine, speed 1.05, scripts FR/EN ~23 s rédigés), screencast Playwright 1920×1080 de l'app réelle (auth par injection localStorage projetenne_token + user complet de /api/auth/me — la réponse login N'A PAS les permissions, ce qui faisait rediriger /dashboard vers timesheets), plans : portfolio → budget → teams vue croisée → dashboard (route SPA « / » en preview), cartes intro/outro PIL (Liberation Sans — DejaVu ABSENT du pod), assemblage ffmpeg (xfade, fades, adelay 2.2 s, faststart).
- Scripts et sorties dans `/app/video_teaser/` (gitignoré) ; MP4 servis via `frontend/public/teaser/` (gitignoré, non déployé). Chromium playwright : executable_path /root/.cache/ms-playwright/chromium-1208 requis (pip playwright cherche une autre version).
- OG image du site régénérée avec Liberation Sans (l'originale était tombée en police fallback) et **déployée prod** (commit fcfef28).
- Formule b (kit script/miniature/description) non demandée mais proposable.

## 2026-06 — Site vitrine MARCEL (déployé prod, commits 732d9e1 + 9d6537b)
- **6 pages HTML statiques pur** (design_agent consulté, CSS partagé `frontend/public/site/site.css`, zéro framework JS — lisible par GPTBot/ClaudeBot qui n'exécutent pas le JS) : FR `site/index.html`, `fonctionnalites.html`, `contact.html` + EN `site/en/index.html`, `features.html`, `contact.html`.
- **URLs propres via nginx.conf** (frontend Docker) : `/` → site FR, `/fonctionnalites`, `/contact`, `/en/`, `/en/features`, `/en/contact` (locations exactes avant fallback SPA). **L'app React reste intacte** sur /login, /dashboard, etc. En preview (pas de nginx) : accès via /site/*.html. CSP étendu : fonts.googleapis.com (style-src) + fonts.gstatic.com (font-src).
- **SEO/IA** : meta title/description par page, canonical, hreflang fr/en/x-default, Open Graph + Twitter (og-marcel.png 1200×630 généré PIL), JSON-LD (SoftwareApplication+featureList, BreadcrumbList, ContactPage), `robots.txt` (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-Web, anthropic-ai, PerplexityBot, Google-Extended, CCBot explicitement autorisés ; routes app disallow), `sitemap.xml` avec alternates hreflang, `llms.txt` (fiche produit markdown pour crawlers IA).
- **Design** : hero asymétrique avec mockup produit 100% CSS (tuiles, anneaux conic-gradient, chips RAG, valeurs JetBrains Mono), bande chiffres, bento 8 modules, section IA fond indigo avec faux terminal, section entreprise (SSO/multi-tenant/on-premise), CTA bande indigo. Carte flottante hero repositionnée (bottom -54px) pour ne pas masquer les tuiles.
- **Formulaire démo** : POST `/api/public/contact` (nouveau module `backend/modules/public_site/`, sans auth) — validation email regex, honeypot `website` (bots ignorés silencieusement 201 sans stockage), stockage `db.demo_requests` (request_id, status new), notification email si RESEND_API_KEY + CONTACT_NOTIFY_EMAIL configurés (pas encore le cas). Testé e2e : 201+stocké, honeypot ok, 422 email invalide, soumission UI avec message succès.
- **Prod vérifiée** : 13 URLs en 200, racine = site vitrine (title FR ok), /login = app React, form contact prod 201, navigation FR + EN screenshotée. Données de test nettoyées.
- Positionnement rédigé : « Reprenez le contrôle de votre portefeuille projets » / cible PMO-DSI-directions de programme.
- ⏳ Suggestion utilisateur : soumettre le sitemap à Google Search Console + Bing Webmaster pour accélérer l'indexation (action côté utilisateur, nécessite son compte).

## 2026-06 — Favicon MARCEL (déployé prod, commit ee899bf)
- favicon.svg (vectoriel), favicon.ico (16/32/48), favicon-32.png, icon-192.png, icon-512.png dans frontend/public — carré arrondi indigo #352c6e + « M » blanc géométrique identique au logo de l'app ; manifest.json PWA (short_name MARCEL, theme #352c6e) ; index.html : links icon/apple-touch-icon/manifest + theme-color #352c6e. Note : le dev server CRA cache index.html → restart frontend nécessaire après modif. Vérifié en prod : svg/ico servis avec bons content-types, link rel=icon dans le HTML.

## 2026-06 — Export Excel matrice + Alertes email contrats expirants + PROD (commit 8b7a196)
- **Export Excel vue croisée** : GET /api/teams/capacity-heatmap/export?months=N (teams/service.py export_capacity_heatmap, openpyxl) — matrice équipes × mois avec cellules colorées par utilisation, ligne Total portefeuille, freeze panes ; bouton « Exporter Excel » (matrix-export-btn) dans la vue croisée de /teams. Testé curl (xlsx valide relu par openpyxl) + téléchargement UI réel (MARCEL_charge_equipes_*.xlsx).
- **Alertes email contrats expirants** : nouveau `core/contract_alerts.py` — seuils 90/60/30/7 jours, déduplication par (resource, contract_end, seuil) dans db.contract_alerts_sent, marquage UNIQUEMENT si envoi réel réussi ; digest par tenant via send_alert_email (qui retourne désormais bool) ; événement `contract.expiring` ajouté à EVENT_LABELS + à l'UI Admin (onglet Webhooks/Alertes → Alertes Email) ; **cron quotidien 06h00 UTC** (APScheduler, job ajouté après _schedule_connectors dans server.py) ; endpoint manuel POST /api/admin/config/email-alerts/contracts/run + bouton « Vérifier les contrats maintenant » (contract-check-run-btn, message résultat contract-check-result). Couvre ressources ET fournisseurs (resources.contract_end, vendor).
- Testé e2e : 1 contrat détecté (J-21), événement déclenché, envoi ignoré proprement sans RESEND_API_KEY, dedup non marqué, config restaurée. ⚠️ **RESEND_API_KEY absente des env preview ET prod — aucun email réel ne part tant que l'utilisateur ne fournit pas sa clé Resend** (et active l'alerte + destinataires + événement dans Administration).
- **PROD DÉPLOYÉE (8b7a196)** : inclut aussi la vue croisée équipes × mois du lot précédent. Backend healthy, scheduler contrats actif en prod (log vérifié), bundle main.45d525f1.js avec nouveaux marqueurs, health 200, disque 79% après prune.

## 2026-06 — Vue Charge Portefeuille (équipes × mois) — livrée, DÉPLOYÉE en prod avec 8b7a196
- **Page /teams** : bascule segmentée Tuiles / Vue croisée (teams-view-toggle, teams-view-tiles, teams-view-matrix) ; état months (défaut 6, sélecteur 3/6/9/12) recharge la heatmap ; badge résumé surcharges (matrix-overload-badge : rouge « X mois-équipe en surcharge sur N mois » ou vert « Aucune surcharge »).
- **CapacityHeatmap.jsx harmonisé** (partagé avec l'onglet heatmap de Ressources) : thead lilas, bordures #e8e6f0, valeurs mono ; noms d'équipes cliquables → fiche ; **cellules cliquables** → /teams/:id?month=YYYY-MM (heatmap-link-*) réutilisant le focus mois de TeamDetail ; **ligne Total portefeuille** en tfoot (heatmap-total-row, capacité/alloué/% par mois, 261.2 JH/mois sur données démo).
- Auto-testé par screenshot+navigation : bascule OK, 35 cellules cliquables, clic → fiche équipe avec « Mois sélectionné », total row OK. Note : l'API renvoie mois courant + N périodes (7 colonnes pour 6 mois) — comportement existant.
- ⚠️ NON déployée en prod — en attente de validation utilisateur du Preview.

## 2026-06 — Lot 2 harmonisation : Fiche Équipe / Ressources / Fournisseurs + charge cliquable + PROD (testé 100% iteration_58)
- **Fiche Équipe (TeamDetail.jsx)** : grand bandeau indigo supprimé → en-tête standard (avatar carré indigo + h1 + manager/train) ; 4 tuiles KPI (membres, capacité, projets actifs, utilisation avec anneau — team-kpi-*) ; sections Membres/Affectations/Charge mensuelle en shell tuile + titres font-heading ; palette barres alignée (#3f8a34/#e0a800/#cc4f45) ; liens membres → /resources/:id (member-link-*, avant ça pointait vers /resources sans id).
- **Charge cliquable** : mini-cellules 3 mois des tuiles équipes = liens vers /teams/:id?month=YYYY-MM (team-tile-month-*) ; TeamDetail lit ?month via useSearchParams et met en évidence le mois ("Mois sélectionné", data-testid month-focus-*), sinon "Mois en cours".
- **Ressources (Resources.jsx)** : 4 KPI → KpiTile mono (resources-kpi-*), thead annuaire lilas harmonisé, shells tuile (annuaire/référentiel/heatmap).
- **Fournisseurs (Vendors.jsx)** : StatCard supprimé → KpiTile (vendors-kpi-*, anneau sur forfait conso, alertes en rouge), cartes fournisseurs + tables en shell/th harmonisés.
- **Composant partagé** : `components/KpiTile.jsx` (label uppercase + valeur mono + Ring optionnel) — utilisé par Teams, TeamDetail, Resources, Vendors. ResourceDetail : valeurs KPI passées en font-mono-data.
- ⚠️ Bug attrapé par testing_agent : import KpiTile manquant dans Teams.jsx (search_replace "successful" fantôme, 2e occurrence dans cette session — TOUJOURS vérifier par grep). Corrigé.
- **PROD DÉPLOYÉE (commit 1c2ff58)** : builder prune avant build (2 Go libérés), update.sh en arrière-plan (backup + git pull + compose build/up + sync permissions), prune après. Vérifs : backend healthy, /api/health 200, /login 200, bundle main.720ebf79.js contient les nouveaux marqueurs. Disque final 79% (3,7 Go libres).

## 2026-06 — Lot harmonisation Fiche Projet / Équipes / Dashboard + fix Réinitialiser (livré, testé 100% iteration_57)
- **Fiche Projet (ProjectDetail.jsx)** : 4 tuiles KPI avec anneaux Ring sur l'onglet Aperçu (Avancement temps couleur RAG, Budget conso, EAC vs budget rouge si dépassement, JH conso — data-testid project-kpi-*) ; toutes les sections passées au shell tuile (border #e8e6f0, rounded-xl, ombre lavande) ; titres de sections en font-heading ; theads harmonisés lilas #fbfaff + libellés uppercase #8a87a0 (tâches, jalons, dépendances) ; **IDs bruts de ressources remplacés par les noms** dans Allocations (getResourceName, testid allocation-resource-*) et Allocations de travail (wa-resource-*) ; fix bug latent : ChevronDown/X non importés (ScopeFeatureList aurait crashé).
- **Équipes (Teams.jsx réécrit)** : tuiles riches style Programmes — en-tête teinté par charge (vert OK / ambre Tendu ≥85% / rouge Surcharge >100%), badge flottant, anneau utilisation mois courant, capacité/charge allouée en mono, mini-cellules charge à 3 mois (via /api/teams/capacity-heatmap?months=3), membres + manager en chips, footer actions ; 4 tuiles KPI (total, ressources affectées avec anneau, charge du mois, surcharges). data-testids conservés (team-card-*, team-link-*, btn-edit/delete-team-*) + nouveaux (team-tile-status-*, team-tile-months-*, teams-kpi-*).
- **Dashboard widgets (DashboardWidgets.jsx)** : MetricCard valeurs → font-mono-data ; MilestonesGaugeWidget → donut + valeurs mono ; ChartBudget/ChartRag/Heatmap → wrappers tuile + header font-heading. Drag & drop et barre de blocs intacts.
- **Réinitialiser (Dashboard.jsx + backend dashboard/service.py)** : le bouton désélectionne maintenant TOUT (widgets=[], layouts vides) au lieu de tout sélectionner ; états vides ajoutés (dashboard-empty-state hors édition, dashboard-empty-dropzone-hint en édition) ; **backend** : get_dashboard_preferences distingue None (→ défauts) de [] (sélection vide respectée) ; frontend charge via Array.isArray — une sélection vide ou partielle persiste après reload.
- iteration_57 : backend 100%, frontend 100%, zéro bug. Préférences admin restaurées après test. Notes non bloquantes connues : warnings Recharts width(-1), WebSocket /api/ws, hydration warning LanguageSelector, modale Team sans role=dialog.
- Déployé en prod avec le lot 2 (commit 1c2ff58).

## 2026-06 — Harmonisation "langage tuiles" : page Budget (livrée, auto-testée screenshots)
- Réclamation utilisateur : design pas en phase avec les dernières évolutions (tuiles Portefeuille/Programmes = référence). Plan validé : harmonisation profonde page par page, en commençant par Budget (choix utilisateur).
- **Budget.jsx refondu** : 4 cartes KPI style tuile avec anneaux Ring (CAPEX conso %, OPEX conso %, EAC vs prévu %, RAF vs EAC %) + valeurs font-mono-data ; carte enveloppe restylée (micro-label uppercase, barres #3f8a34/#a3891a/#cc4f45) ; filtres en ligne simple ; onglets Clarity avec pastilles de compte ; table dense (thead #fbfaff, colonnes numériques mono, ligne Total #f7f6fb) ; blocs Par programme (titres font-heading, valeurs mono, micro-labels) ; drawer restylé.
- **Fix global** : `Layout.jsx` main → `pb-28` pour que le bouton flottant Agent IA PMO ne masque plus les dernières lignes des tableaux en fin de scroll.
- ⚠️ LEÇON : un search_replace d'un batch parallèle a signalé "successful" sans s'appliquer (composant KpiCard) → toujours vérifier par grep après un gros batch.
- ⏳ Harmonisation restante (backlog utilisateur validé) : ~~fiche Projet~~ ✅, ~~Équipes~~ ✅, ~~Dashboard~~ ✅ (iteration_57). Restant : Fiche Équipe (header unifié), Ressources/fiche, Fournisseurs. Prod à redéployer après validation utilisateur.
 (PPM SaaS Multi-Tenant)

## Énoncé du problème original
Construire et développer en continu une application SaaS multi-tenant appelée `MARCEL` — un PPM (Project Portfolio Management) complet.

## Architecture technique
- **Frontend** : React + Shadcn UI + react-i18next (FR/EN)
- **Backend** : FastAPI + Motor (MongoDB async)
- **DB** : MongoDB (collections: projects, users, tenants, risks, tasks, milestones, timesheets, agent_logs, notifications, scenarios, arbitrage_weights, envelopes…)
- **IA** : Claude Sonnet 4 via Emergent LLM Key (emergentintegrations)
- **Infra** : Traefik, Docker Compose, APScheduler, WebSockets

## Profils utilisateurs (7)
1. Admin (admin@altair.fr / Admin2026!)
2. Chef de Projet (cp@altair.fr / CP2026!)
3. Manager Portfolio (manager@altair.fr / Manager2026!)
4. Admin Beta Corp (admin@betacorp.fr / Beta2026!) ← NOUVEAU Item 17
5. PM Beta Corp (pm@betacorp.fr / PM2026!) ← NOUVEAU Item 17
6. Consultant
7. Viewer

## Architecture des modules
```
/app/
├── backend/
│   ├── modules/
│   │   ├── agent/         (chat, recommandations, alertes, simulations, analytics, export PDF/Excel)
│   │   ├── notifications/ (WebSocket bell)
│   │   ├── export/        (COPIL PPT)
│   │   ├── connectors/    (Jira, SAP RFC V2, ServiceNow, Azure DevOps)
│   │   ├── arbitrage/     (scoring, enveloppes, simulateur, scénarios + comparaison)
│   │   ├── scope/         (candidats, snapshots, Gantt)
│   │   ├── auth/
│   │   ├── admin_config/
│   ├── server.py          (APScheduler + WebSocket /ws)
│   ├── pptx_generator.py  (branding dynamique tenant sur toutes slides)
│   ├── seed_beta_corp.py  (seed tenant Beta Corp)
│   ├── seed_docker.py     (seed principal Altair)
│   ├── entrypoint.sh
├── frontend/
│   ├── src/pages/
│   │   ├── Roadmap.jsx         (tabs Timeline + Scope vs Réel)
│   │   ├── Arbitrage.jsx       (tabs + Scénarios + Comparaison)
│   │   ├── Recommandations.jsx (export PDF + Excel)
│   │   ├── AgentAnalytics.jsx  (dashboard admin Analytics IA)
│   │   ├── Scope.jsx, ProjectDetail.jsx, ...
│   ├── src/components/ (Layout.jsx avec lien Analytics IA)
│   ├── src/locales/ (fr.json, en.json)
│   ├── src/i18n.js
├── docker-compose.yml
├── Makefile
└── README.md
```

## Roadmap MARCEL — Statut complet (19/19)

### BLOC A — IA & Modèles (Items 1-4) ✅
- Item 1 : Upgrade Claude 3.5 → Claude Sonnet 4 (via .env)
- Item 2 : Seed 3 conversations IA de démo
- Item 3 : Bouton "Ask AI" dans Project Detail
- Item 4 : APScheduler configuré dans server.py

### BLOC B — DevOps & Infra (Items 5-9) ✅
- Item 5 : Traefik dans docker-compose.yml
- Item 6 : Makefile amélioré
- Item 7 : SEED_DEMO_DATA dans entrypoint.sh
- Item 8 : README.md mis à jour
- Item 9 : WebSockets Notifications + Bell UI

### BLOC B² — UX (Items 10-12) ✅
- Item 10 : i18n FR/EN (react-i18next)
- Item 11 : Kanban Drag & Drop (Scope page)
- Item 12 : Modal CP "Scope reçu" (Project Detail)

### BLOC C — Analytics & Export (Items 13-16) ✅ NEW
- Item 13 : Onglet "Scope vs Réel" dans Roadmap (barres Gantt scope figé vs réel, rouge si retard)
- Item 14 : Export PDF + Excel des Recommandations IA (ReportLab + xlsxwriter)
- Item 15 : Onglet "Scénarios" dans Arbitrage + comparaison côte à côte 2 scénarios
- Item 16 : Dashboard Analytics Agent IA (/admin/agent-analytics) — KPIs + graphique 30j + top questions

### BLOC D — Multi-tenant & Connecteurs (Items 17-19) ✅ NEW
- Item 17 : Tenant Beta Corp créé (3 projets, 2 users, isolation vérifiée ✅)
- Item 18 : Correctifs visuels PPT (police tenant, logo sur toutes slides via _CURRENT_BRAND)
- Item 19 : SAP RFC natif V2 (auth_type="rfc", pyrfc fallback mock)

## Modules implémentés (complets)
| Module | Status | Notes |
|---|---|---|
| Auth + Profils | ✅ | JWT, permissions granulaires |
| Dashboard Portfolio | ✅ | KPIs, RAG, graphiques |
| Projets | ✅ | CRUD, fiches détail |
| Risques | ✅ | Heatmap, CRUD |
| Jalons | ✅ | Familles, types, attributs |
| Timesheets | ✅ | Saisie, validation |
| Roadmap | ✅ | Gantt multi-projets + Scope vs Réel |
| Scope | ✅ | Kanban, snapshots, Gantt, drag&drop |
| Arbitrage | ✅ | Scoring, enveloppes, simulateur, scénarios |
| Agent IA PMO | ✅ | Chat, recommandations, alertes, simulations |
| Analytics IA | ✅ | Dashboard admin (Item 16) |
| Export COPIL (PPT) | ✅ | Branding tenant complet |
| Export Recommandations | ✅ | PDF + Excel (Item 14) |
| Connecteurs | ✅ | Jira, SAP (RFC V2), ServiceNow, Azure DevOps |
| Notifications | ✅ | WebSocket, bell, temps réel |
| Multi-tenant | ✅ | Altair + Beta Corp, isolation parfaite |
| i18n | ✅ | FR/EN react-i18next |
| Admin | ✅ | Profils, utilisateurs, configuration |

## Collections MongoDB clés
- `agent_logs`: {user_id, tenant_id, question, response, sources, tokens_used, duration_ms, verified, is_simulation, session_id, created_at}
- `notifications`: {user_id, tenant_id, type, message, read, created_at}
- `user_alert_rules`: {tenant_id, user_id, metric, threshold, scope, enabled}
- `scenarios`: {scenario_id, tenant_id, name, description, modifications, status, created_at}
- `projects`: {project_id, tenant_id, name, status, status_rag, budget_*, end_date_baseline, end_date_forecast, ...}

## Endpoints clés (backend)
- `GET /api/admin/agent-analytics` — KPIs Analytics IA
- `GET /api/agent/recommendations/export-pdf` — Export PDF
- `GET /api/agent/recommendations/export-excel` — Export Excel
- `GET /api/arbitrage/scenarios/{id}` — Détail scénario
- `WebSocket /ws` — Notifications temps réel
- `POST /api/export/copil` — Génération PPT COPIL

## État final — MARCEL V1.0 ✅ + Module Budget ✅ + Responsive UI ✅ + Power BI Connector ✅ (Mai 2026)
- **19/19 items MARCEL** : COMPLÉTÉS ✅
- **Module Budget** : Page /budget complète (KPIs, tableau, programmes, graphiques, export, révisions) ✅
- **Responsive Design** : Layout responsive 3 viewports (Mobile/Tablet/Desktop) ✅
- **Connecteur Power BI** : 6 endpoints GET /api/powerbi/*, auth JWT+API Key, page /admin/powerbi ✅
- **Tests Pytest** : **80 tests passent / 0 échec** ✅ (+ 15 tests powerbi ajoutés)
- **Sécurité** : Rate limiting par email (10/min), HTTP Security headers ✅
- **Bugs connus** : Aucun
- **APIs mockées** : SAP RFC (pyrfc absent), Jira sync, ServiceNow sync
- **Isolation multi-tenant** : ✅ Altair / Beta Corp totalement isolés

## Connecteur Power BI — Détails (Mai 2026)
| Endpoint | Champs retournés |
|---|---|
| GET /api/powerbi/projects | id, name, program, methodology, status, rag, capex_budget, opex_budget, capex_consumed, opex_consumed, eac, raf, start_date, end_date, owner |
| GET /api/powerbi/resources | id, name, role, team, type, vendor, tjm, availability_rate, capacity_jh |
| GET /api/powerbi/timesheets | resource_name, project_name, date, jh, status |
| GET /api/powerbi/budget | project_name, program, capex_prev, capex_cons, opex_prev, opex_cons, eac, raf, ecart_pct |
| GET /api/powerbi/risks | project_name, name, probability, impact, criticality, category, status |
| GET /api/powerbi/milestones | project_name, name, family, type, date, days_remaining, attribute, status |

- Auth : Bearer JWT ou header X-API-Key (clé pbi-xxx générée dans /admin/powerbi)
- Permission : export.powerbi (accordée ADMIN, CIO, PORTFOLIO, FINANCE)

## Responsive Design — Détails (Mai 2026)
| Viewport | Comportement Sidebar | KPI Cards | Modals | Pages |
|---|---|---|---|---|
| Mobile (<768px) | Drawer overlay, hamburger | 1 colonne | rounded-none, fullscreen, p-0 | p-4 |
| Tablet (768-1279px) | 60px in-flow, hover:w-60 (group) | 2×2 | rounded-none sm:rounded-xl | p-4 md:p-6 |
| Desktop (≥1280px) | Toujours w-60, labels visibles | 4 colonnes | rounded-xl | p-4 md:p-6 lg:p-8 |

## État — MARCEL V1.3 P1 ✅ (Fév 2026)
- **Template Power BI ZIP** : `GET /api/admin/powerbi/template` → ZIP (6 fichiers `.m` M-Query + README) pré-configurés avec URL tenant et clé API. Bouton "Télécharger .zip" dans `/admin/powerbi`.
- **Webhook projet** : `PUT /api/admin/config/webhooks` → config (URL, enabled, events, HMAC secret). Fire-and-forget dans `projects/service.py` sur `project.created` / `project.updated`. Onglet "Webhooks" dans `/admin/config`.

## État — MARCEL V1.4 P2 ✅ (Juin 2026) — testé 100% (iteration_46)
- **Fix gate Waterfall** : template par défaut = 6 phases / 18 tâches / 12 jalons (ajout "Transfert vers le run" en Hypercare). Resync auto des templates par défaut non modifiés au seed (`project_templates/service.py`).
- **Sentry APM backend (optionnel)** : init conditionnel dans `server.py` si `SENTRY_DSN` défini (env). `SENTRY_TRACES_SAMPLE_RATE` (défaut 0), `SENTRY_ENVIRONMENT`. Capture 5xx via FastApiIntegration/StarletteIntegration. NON CONFIGURÉ en preview — l'utilisateur ajoute le DSN dans le .env du VPS.
- **Alertes email (Resend, optionnel)** : `core/email_alerts.py`, config tenant `PUT /api/admin/config/email-alerts` (enabled, recipients, events). Envoi fire-and-forget sur project.created/updated si `RESEND_API_KEY` défini (env). UI dans `/admin/config` onglet Webhooks (section-email-alerts). CLÉ NON CONFIGURÉE en preview.
- **Dashboard CxO personnalisable** : `GET /api/dashboard/cxo` (kpis, rag, budget, jalons on-time, top 5 projets), préférences widgets par utilisateur (`GET/PUT /api/dashboard/cxo/preferences`, collection `user_preferences`). Page `/cxo` (`DashboardCxO.jsx`), entrée nav "Dashboard CxO", panneau Personnaliser avec toggles persistés.
- **Connecteur MS Project (XML MSPDI)** : `GET /api/msproject/export/{id}` (phases=summary tasks, tâches, jalons Milestone=1) + `POST /api/msproject/import/{id}` (multipart). Boutons dans l'en-tête `ProjectDetail.jsx`. Round-trip validé.
- **Alertes email seuils** : `threshold.budget_overrun` (EAC > budget_total × eac_ratio, déclenché sur update projet et révision budget, anti-spam au franchissement) et `threshold.milestone_late` (forecast > baseline nouvellement en retard, sur update jalon). Événements cochables dans la config email. Poussé sur GitHub (commit a961750), CI vert (backend + frontend).
- **Webhook** : filtre désormais par événements configurés (`get_tenant_webhook_url(tenant_id, event)`).

## État — MARCEL V1.5 SSO ✅ (Juin 2026) — backend 17/17, frontend validé (iteration_47 + retest correctifs)
- **SSO multi-tenant** (`backend/modules/sso/`) : Google OIDC, Microsoft Entra ID OIDC, SAML 2.0 (python3-saml). Config par tenant dans `tenants.settings.sso` via `PUT /api/admin/config/sso`.
- Routes : `GET /api/auth/sso/providers?email=`, `GET /api/auth/sso/login/{provider}?email=`, `GET /api/auth/sso/callback/{provider}`, `POST /api/auth/sso/saml/acs/{tenant_id}`, `GET /api/auth/sso/saml/metadata/{tenant_id}`, `POST /api/auth/sso/exchange` (ticket one-shot 60s, collections TTL sso_states/sso_tickets/sso_replays).
- Auto-provisioning optionnel (allowed_domains + profil par défaut). Comptes SSO sans mot de passe local (guard 401 dans login).
- UI : boutons Google/Microsoft/SAML sur `/login` (échange ticket via `?sso=`), onglet SSO dans `/admin/config` (3 cartes + provisioning, URLs de callback affichées).
- Fixes : bug `client_ip` (NameError → 500 sur login échoué), intercepteur axios 401 n'écrase plus les erreurs des routes `/auth/`, `base_url_of` préfère `x-forwarded-host` + override env `PUBLIC_BASE_URL`.
- Dockerfile backend : ajout libxmlsec1-dev pour python3-saml. Commit `12cfd20`, CI vert.
- ⚠️ Testé jusqu'à la redirection IdP (pas d'identifiants Google/Microsoft réels). L'utilisateur doit créer ses app registrations et configurer l'onglet SSO.

## Fix — Sélecteur de template projet (Juin 2026)
- Bug : le modal "Nouveau projet" (`ProjectModal.jsx`) prenait automatiquement le premier template de la méthodologie (le défaut) — les templates custom (ex: "WATERFALL BYGGA" de l'utilisateur) n'étaient jamais proposés.
- Fix : select `template-select` dans la section template listant tous les templates de la méthodologie (défaut + custom), phases resynchronisées au changement. Commit `6bf588a`, CI vert.

## État — Dashboard personnalisable fusionné ✅ (Juin 2026) — testé 100% (iteration_48)
- Fusion du Dashboard CxO dans `/dashboard` (route `/cxo` → redirect, nav CxO supprimée, `DashboardCxO.jsx` supprimé).
- 15 widgets avec registre (`Dashboard.jsx` orchestrateur + `components/dashboard/DashboardWidgets.jsx`) : metrics, budget_detail, capacity, regulatory, envelope, ai_recommendations, upcoming_milestones (NOUVEAU, 30j avec retards), charts, milestones_gauge (ex-CxO), top_projects (ex-CxO), pending_timesheets (NOUVEAU), recent_decisions (NOUVEAU), recent_projects, top_risks, heatmap.
- Personnalisation : panneau afficher/masquer + réordonner (flèches), préférences par utilisateur (`user_preferences.dashboard_widgets`, GET/PUT `/api/dashboard/preferences`).
- Backend : `GET /api/dashboard/extras` (jalons à venir, timesheets submitted, décisions récentes). Endpoints CxO conservés pour compat.
- Commit `38c8ff9`, CI vert.
- **Widget Charge équipes** (Juin 2026) : `team_load` ajouté aux widgets par défaut (16 au total) — capacité vs allocations par équipe (via `/api/teams/capacity-heatmap?months=3`), barre d'utilisation mois courant, mini-cellules 3 mois, surcharges >100% en rouge, badge nombre de surcharges. Commit `1d2dfa0`, CI vert. Auto-testé (curl + screenshot).
- **Grille matricielle** (Juin 2026, testé 100% iteration_49) : dashboard converti en grille drag & drop (`react-grid-layout@2.2.4`, import legacy `Responsive+WidthProvider`). Mode édition : déplacer (bandeau bleu), redimensionner (poignée), activer/désactiver (pills), réinitialiser. Layouts persistés par utilisateur (`user_preferences.dashboard_layouts`, PUT `/api/dashboard/preferences` {widgets, layouts}). Widgets sans données masqués hors édition (placeholder en édition). Commit `ddea1b9`, CI vert.
- **Blocs indépendants** (Juin 2026, testé 100% iteration_50) : 22 blocs déplaçables individuellement (cartes KPI, budget, graphiques séparés), masquage par croix sur le bandeau de chaque bloc en mode édition, zone "Blocs masqués" pour réafficher, migration auto des anciens ids composites (LEGACY_MAP). Commit `51f2a10`, CI vert.
- **Barre de choix restaurée** (commit `66b0043`) : barre listant les 22 blocs (toggle afficher/masquer) en mode édition, en complément des croix par bloc. Testé par screenshot.
- **Fix "connexion impossible sur l'aperçu"** (Juin 2026) : cause 1 = hibernation de l'environnement preview (services redémarrent ~30-60s) → login avec retry auto (8 tentatives / 6s, message "L'environnement démarre…", data-testid login-waking). Cause 2 = préférences dashboard corrompues par les tests (2 widgets seulement) → reset DB. Commits `bf90ef4` + `a17c27c`.
- **CI** : événements push GitHub non déclenchés temporairement (incident GitHub constaté sur 66b0043/77a47e7/bf90ef4, workflow actif, repo public) → `workflow_dispatch` ajouté au workflow ; run manuel `a17c27c` **vert** (couvre tout le code).
- **Drag & drop barre → grille** (Juin 2026) : glisser un bloc grisé depuis la barre de choix directement vers la position voulue dans la grille (drop HTML5 manuel sur `dashboard-grid-dropzone`, position calculée au point de dépôt). ⚠️ Dead-end : `isDroppable` du wrapper legacy RGL v2 provoque une boucle infinie (Maximum update depth) avec React 19 — ne pas réutiliser ; le drop manuel est la solution. Testé par script DnD simulé + persistance après reload. Commit `513fdae`, CI vert (dispatch manuel, événements push toujours en panne GitHub).
- ⏳ EN ATTENTE réponse utilisateur : reporting PMO "PTF Sync" + "SPR" (questions posées : définitions exactes, sections, format écran/PPT/PDF, périmètre).

## Backlog / Améliorations futures
### P1 — Court terme
- **Modules DSI 360° (demandés Juin 2026 — ordre validé : APM → Run → Sécurité → Architectes, l'Application = objet pivot reliant tout)** :
  1. **APM (portefeuille applicatif)** : référentiel applications (fiche : cycle de vie, éditeur, techno, criticité, owner, données), matrice TIME (Tolerate/Invest/Migrate/Eliminate), redondances fonctionnelles, capacités métiers ↔ apps, obsolescence (versions, fins de support), TCO par app, lien projets ↔ applications impactées. SOCLE des 3 autres modules.
  2. **Run (version révisée par l'utilisateur — PAS que l'incident !)** : catalogue des activités récurrentes (MCO, maintenance, support N1/N2/N3, supervision, patching, astreintes…) rattachées aux apps ; budget run par activité/app (OPEX, consommé vs prévu, alertes — même mécanique que budget projets) ; KPI ratio build/run portefeuille ; **allocation des ressources sur les activités de run** → charge consolidée build+run par ressource/équipe (corrige la sous-estimation de la heatmap actuelle), capacité résiduelle pour projets ; timesheets sur activités run ; incidents/SLA, MEP/gels, transition projet→run en sous-partie.
  3. **Sécurité** : registre risques sécurité lié apps+projets, conformité DORA/NIS2/RGPD/ISO27001 (exigences, contrôles, plans d'action), vulnérabilités/audits/pentests + remédiation, avis sécurité sur projets, score posture par app.
  4. **Architectes** : cartographie flux/interfaces entre apps, principes/standards + dérogations, avis d'architecture sur projets (comité intégré gouvernance), radar techno, dette technique consolidée.
  Estimation support : APM 60-100 cr, Run 60-100 cr, Sécurité 40-80 cr, Architectes 30-60 cr.
- **Cockpit d'indicateurs par méthodologie (demandé Juin 2026, suite analyse Cora Systems)** : onglet "Pilotage" par projet affichant automatiquement le jeu d'indicateurs selon la méthodologie du projet. Socle commun (santé, avancement, budget EAC/RAF, risques, jalons, alignement) + Waterfall : EVM (CPI/SPI, EV/PV/AC, dérive baseline — données déjà en base) + Agile : vélocité, burndown/burnup, lead/cycle time (via Jira ou saisie sprints) + SAFe : PI predictability, load vs capacité train + Kanban : WIP, cycle time, SLA. Seuils configurables V/A/R, agrégation portefeuille PMO. Découpage validé : Phase 1 socle+EVM, Phase 2 Agile, Phase 3 SAFe/Kanban.
- **Participatory Budgeting SAFe (demandé Juin 2026 — design proposé et mis en backlog par l'utilisateur, à implémenter plus tard)** : rituel LPM de répartition collective du budget portefeuille. Design validé à proposer tel quel :
  - Cycle de vie session PB : Préparation (PMO crée : nom, enveloppe, candidats value streams/epics avec coût estimé, participants, date limite) → Vote ouvert (chaque participant répartit un budget fictif = enveloppe complète, curseurs/saisie K€, commentaire optionnel) → Clôture (auto ou manuelle) → Restitution.
  - Consolidation : financement collectif = moyenne des allocations (option pondération par rôle, ex. Direction ×2) ; statuts Financé / Partiellement financé / Non financé ; indicateur de consensus = écart-type des votes (désaccords à débattre en COPIL).
  - Écrans : "Ma session de vote" (candidats + coût + BC résumé + score alignement existant, jauge reste-à-répartir, soumission) ; "Restitution PMO" (classement collectif vs répartition actuelle, top désaccords, export PDF COPIL) ; "Décision" (PMO valide → alimente guardrails value streams du module SAFe).
  - Garde-fous : vote anonymisé en restitution (option) mais traçable en audit ; 1 participant = 1 soumission modifiable jusqu'à clôture ; notifications in-app (invitation, rappel, résultats).
  - Réutilise : value streams/epics SAFe, scores alignement, enveloppes, notifications, profils. Taille : ~1 grosse feature (module backend + 2 écrans).
  - ⚠️ 2 questions ouvertes à trancher avec l'utilisateur avant de coder : (a) pondération par rôle dès V1 ou votes égaux ; (b) périmètre V1 value streams seuls ou aussi epics.
  - Différenciateur : absent de PPM Express et Cora.
- **Socle IA à coût fixe (Niveau 1 uniquement — spec validée avec l'utilisateur, Juin 2026)** : job planifié (cron APScheduler) 1 appel LLM/tenant/exécution — règles déterministes d'abord (dépassements EAC>budget, risques critiques non mitigés, jalons en retard, décisions en attente, étendre les 6 règles existantes de modules/agent/service.py), LLM uniquement pour rédiger la synthèse des anomalies détectées (0 anomalie = 0 appel). Stockage collection `ai_insights` (horodaté, anomalies structurées + synthèse), déduplication (notifier seulement nouvelles anomalies + résolutions), badge + notifications WebSocket existantes, AUCUN appel LLM à la consultation. Garde-fous : compteur tokens/coût par tenant (agent_logs), suivi coût quotidien dans Analytics IA, alerte + kill-switch si dépassement seuil. Endpoint /api/agent/analyze déclenchable manuellement (admin). Ajustements décidés : cache Mongo TTL (PAS Redis), PAS d'API batch en V1, intent "inconnu" sans fallback LLM. ⚠️ Niveau 2 (chat quota) ABANDONNÉ par l'utilisateur. Questions restées sans réponse : sort du chat IA existant (laisser/désactiver/restreindre), fréquence (nuit vs 6h), modèle (Haiku vs Sonnet).
- SAP RFC natif : installer `pyrfc` + SAP NW RFC SDK (sous licence SAP) pour remplacer le mock actuel

### P2 — Moyen terme (restant)
- Envoi réel Sentry/Resend à activer sur le VPS (ajouter SENTRY_DSN / RESEND_API_KEY dans le .env)

### P3 — Long terme
- Mobile app React Native
- Module BI intégré
- AI Planning Assistant (prévision charge)

## 2026-06 — Export/Import Excel + MS Project .mpp (livré, testé iteration_51)
- Export .xlsx lisible (en-têtes FR, formats €/dates, onglet Aide) sur 9 sections / 10 entités : Portefeuille, Programmes, Budget, Équipes, Ressources, Roadmap (jalons), Gouvernance (risques + décisions), Demandes, Timesheets
- Import Excel avec aperçu de confirmation (Nouveau / Mise à jour / Erreur) et upsert par nom : /api/excel/{entity}/{export|import/preview|import/commit}
- Import Microsoft Project .mpp binaire (MPXJ + JRE) et XML MSPDI sur la Roadmap (choix projet cible)
- Dockerfile backend : default-jre-headless ajouté (requis au prochain déploiement VPS)
- Commits: 6d80c09 (drag&drop barre), d6f380f (Excel/MPP)

## 2026-06 — Export PDF COMEX (livré, auto-testé)
- GET /api/dashboard/export/pdf + bouton « PDF COMEX » sur le dashboard — rapport hebdo portefeuille prêt COMEX

## 2026-06 — Codification unique des projets (livré, auto-testé)
- Préfixes par programme configurables (admin), code auto verrouillé PREFIX-001, backfill projets existants, anti-doublon serveur

## 2026-06 — Recherche globale par code (livré, auto-testé)
- Barre de recherche topbar : code ou nom → ouverture directe de la fiche projet, Ctrl+K

## 2026-06 — Recherche globale étendue (livré, auto-testé)
- /api/search/global : projets + jalons + risques + décisions groupés par type dans la barre de recherche

## 2026-06 — Historique de recherche (livré, auto-testé)
- Projets récemment consultés proposés à l'ouverture de la recherche globale (localStorage par utilisateur)

## 2026-06 — Production déployée (marcel-ppm.com, VPS Scaleway)
- SSH pod opérationnel ; deploy = ssh /opt/marcel : git pull, docker compose build+up, restart nginx-http, prune du cache après build
- Licence MARCEL_LICENSE_KEY requise dans /opt/marcel/.env (générée jusqu'à 2030)

## 2026-06 — Refonte design CLARITY (en cours, phase 1 livrée — testé 100% iteration_52)
- Direction validée par l'utilisateur : design inspiré du Modern UX de Broadcom Clarity PPM (référence : clarity.itdesign.de). Maquettes conservées dans /app/frontend/public/mockups/proposition1-6.html (la 6 = retenue).
- Signature visuelle : fond lavande #f7f6fb, indigo #352c6e, bleu royal #2e5fe8, tuiles projets avec en-tête teinté par statut RAG (vert #ddf0d8, orange #f3edb5, rouge #fbe1de, cadrage teal #d5efec) + badge flottant, timeline jalons avec losanges, anneaux KPI, rangée d'icônes d'action.
- **Phase 1 livrée (commit cf584aa, poussé)** : Login redesigné (Login.jsx — panneau branding indigo + carte blanche, logique retry/SSO/démo intacte), shell (Layout.jsx réécrit — appbar blanche h-50px avec logo/recherche/cloche/langue/profil + rail d'icônes 54px hover-expand 236px avec sections, drawer mobile conservé), Portefeuille en tuiles (ProjectTile.jsx nouveau + Portfolio.jsx : bascule tuiles/liste persistée localStorage portfolio_view, défaut tuiles), palette index.css.
- data-testids conservés (nav-*, logout-btn, sidebar, sidebar-mobile...) + nouveaux (portfolio-tiles, project-tile-*, tile-checkbox-*, view-toggle-tiles/list).
- **Phase 2 livrée (Juin 2026, testée iteration_53 + iteration_54 100%)** : Dashboard Clarity (crumb, MetricCard donuts, BudgetSingleWidget donut, WidgetShell restylé, th denses via /tmp/restyle_clarity.py — 44 remplacements), fiche projet ProjectDetail.jsx avec fil d'Ariane + code chip + ONGLETS (Aperçu/Tâches/Jalons/Risques/Décisions/Équipe/Scope, state activeTab, sections gated hidden), pages Budget/Roadmap/Gouvernance (crumb + titres), DateField (components/ui/DateField.jsx — shadcn Popover+Calendar locale fr, contrat string yyyy-MM-dd) remplaçant les 27 input type=date de 13 fichiers. Bug critique corrigé : modales à helper événementiel set() → adaptateur (v)=>set(k)({target:{value:v}}) dans 7 fichiers. Commits poussés.
- ⏳ EN ATTENTE validation utilisateur phases 1+2. Restant éventuel : Portefeuille bascule gantt (3e icône du sélecteur de vue maquette), restyle GlobalSearch/NotificationBell popovers.

## 2026-06 — Lots A + C Clarity + jalons tuiles + MISE EN PROD (testé 100% iteration_56)
- **Lot A** : Ressources (breadcrumb, onglets Clarity, thead lilas), Fiche Ressource (breadcrumb aligné), Équipes (breadcrumb), Fiche Équipe (breadcrumb, bandeau indigo #352c6e au lieu de #0B2545, TH lilas), Fournisseurs (breadcrumb), Timesheets (breadcrumb, onglets Clarity, theads lilas), Demandes (breadcrumb + H1 Clarity), Scope (breadcrumb + H1, bascules actives #2e5fe8, thead lilas).
- **Lot C** : AdminConfig (breadcrumb Administration/Configuration, onglets + enum-tabs Clarity, theads), AdminUsers, AdminProfiles, AdminPowerBI (onglets mquery Clarity), AdminTemplates, AdminMonitoring, AgentAnalytics, Connectors (onglets + thead Clarity, padding standard). Portfolio vue liste thead → lilas.
- **Jalons sur tuiles programmes** : backend `list_programs` renvoie `next_milestones` (2 max, statuts non atteints hors achieved/cancelled ; à venir en priorité sinon derniers en retard avec `overdue:true`). ProgramTile affiche « Prochains jalons » (losange + date, rouge si retard). data-testid `program-tile-milestones-*`.
- iteration_56 : 100 % backend + frontend, zéro bug. Restes non bloquants connus : WebSocket /api/ws handshake, warnings Recharts width(-1).
- **PROD DÉPLOYÉE** : push GitHub → update.sh VPS → backend healthy, frontend up, health 200, login 200, screenshot /programmes prod OK (données utilisateur intactes, ex. programme CYBERSECURITE). Disque VPS après build : ~2,4 Go libres (87 %) — prévoir extension.
- ⏳ Validation visuelle utilisateur de l'ensemble de la refonte en attente.

## 2026-06 — Programmes en vue consolidée type Portefeuille (livré, auto-testé screenshots)
- Demande utilisateur : « la vue programme doit être la vue consolidée de la page portefeuille, idem quand on entre dans le détail des programmes ».
- `components/ProgramTile.jsx` (nouveau) : tuile programme identique aux tuiles projets — en-tête teinté RAG consolidé + badge flottant, timeline début→fin, anneaux Avancement temps / Budget conso, date de fin, budget total/consommé, répartition RAG (points verts/orange/rouges), actions éditer/supprimer/ouvrir.
- `pages/Programs.jsx` réécrit sur le modèle Portfolio : recherche + filtres RAG/statut + bascule tuiles/liste (localStorage `programs_view`, défaut tuiles) + table liste Clarity ; sous-titre consolidé (n programmes · n projets · budget € · répartition RAG).
- `pages/ProgramDetail.jsx` onglet Projets : tuiles ProjectTile (sans checkbox — prop `selectable=false` ajoutée à ProjectTile) + bascule tuiles/liste (localStorage `program_projects_view`), la table détaillée avec totaux reste en vue liste.
- ProjectTile.jsx : helpers Ring/DateCircle/elapsedPct/clamp exportés (réutilisés par ProgramTile), prop `selectable`.
- Vérifié par screenshots : /programmes tuiles + fiche programme onglet Projets tuiles (P01-001/P01-002 avec anneaux et badges).

## 2026-06 — Clarity Lot B (livré, testé 95% iteration_55)
- Réclamation utilisateur : « le design Clarity n'est pas déployé sur toutes les pages ». Audit : 31 pages, ~24 non traitées. Plan validé : Lot B d'abord (choix utilisateur), puis A et C.
- **Lot B livré** : Arbitrage (breadcrumb + H1 Clarity + 4 KPI mono + onglets Clarity avec pastille + theads #fbfaff sur scoring/simulateur/enveloppes), Conformité (breadcrumb, KpiCard blanches Clarity, thead #fbfaff), Recommandations IA (breadcrumb, KPI mono), Mes Alertes (breadcrumb, thead Clarity), Import (padding standard + breadcrumb), Trains SAFe (breadcrumb + onglets Clarity), Programmes (breadcrumb + KPI uppercase), Fiche Programme (breadcrumb aligné « Accueil / Programmes / Nom »).
- Signature Clarity de référence (à réutiliser pour lots A/C) : breadcrumb `text-xs text-[#8a87a0]` + `text-[#352c6e] font-semibold` ; H1 `font-heading text-2xl sm:text-3xl font-extrabold text-[#26243a] tracking-tight` ; onglets `border-b border-[#e7e3f2]`, actif `text-[#2e5fe8] border-b-[3px] border-[#2e5fe8] -mb-px` + pastille `bg-[#e9effe]` ; theads `bg-[#fbfaff] border-b border-[#e8e6f0] text-[10.5px] uppercase tracking-wider font-bold text-[#8a87a0]` ; KPI blanches label `text-[10px] uppercase tracking-widest text-zinc-400 font-semibold` + valeur `font-mono-data font-bold text-zinc-950`.
- iteration_55 : tous flux fonctionnels OK (onglets, filtres, tri, export CSV, création règle alerte, édition inline scoring, navigation programmes) + régression Portfolio/Dashboard OK. Notes non bloquantes : warnings Recharts width(-1) hors viewport ; WebSocket /api/ws handshake à investiguer (préexistant).
- **⏳ RESTANT : Lot A (Ressources, Fiche Ressource, Équipes, Fiche Équipe, Fournisseurs, Timesheets, Demandes, Scope) et Lot C (Admin Config/Users/Profiles/PowerBI/Templates/Monitoring/Analytics IA/Connecteurs). Pas encore déployé en prod ni validé par l'utilisateur.**

## 2026-06 — Déploiement production (agent-vérifié)
- Prod mise à jour de 8b3deb6 → 1fe7695 (toute la refonte Clarity + fiche/référentiel ressources + widget contrats + fiche programme onglets + DateField).
- Incident résolu : build frontend échouait 2× — (1) disque saturé pendant yarn install (résolu par build séquentiel backend→bascule→prune→frontend), (2) Dockerfile frontend en node:18 incompatible react-router-dom 7.11 → **corrigé en node:20-alpine (commit 1fe7695)**.
- Procédure sûre validée : df -h avant build, build par service, docker image prune après bascule, builder prune final. Disque final 78 % (3,8 Go libres — toujours vérifier avant rebuild).
- Vérifs externes : /api/health 200, /login 200, screenshot login Clarity OK. Conteneurs backend/frontend/mongo/nginx healthy.

## 2026-06 — Widget contrats + fiche programme onglets (livré, agent-testé par screenshots)
- Widget dashboard "Contrats à renouveler (60j)" (contracts_expiry) : ressources avec contract_end ≤ 60 jours, badge ambre "J-x à anticiper" (≤60j), rouge "J-x à renouveler" (≤30j) ou "Expiré" ; lien vers fiche ressource ; ajouté au registre (WIDGET_LABELS, DEFAULT_GRID, RENDERERS, HAS_CONTENT dans Dashboard.jsx + ContractsExpiryWidget dans DashboardWidgets.jsx) ; les utilisateurs existants l'ajoutent via Personnaliser (layout sauvegardé).
- Fiche programme (ProgramDetail.jsx) : fil d'Ariane Clarity, titre avec chips RAG/statut intégrés, onglets Aperçu (KPIs + 3 panneaux RAG/infos/avancement) / Projets (table pleine largeur) / Jalons (42 agrégés, état vide géré) — data-testid program-tabs, program-tab-*.

## 2026-06 — Référentiel ressources + charge mensuelle (livré, agent-testé, commit 4c01dd1)
- Backend : champs `entry_date` + `contract_ref` ajoutés à ResourceCreate/Update (contract_start/end/vendor existaient déjà) ; spec Excel resources enrichie (date d'entrée, réf. contrat, début/expiration contrat).
- Frontend : onglet "Référentiel" sur /resources (tab-referentiel — nom, type, rôle, équipe, date d'entrée, capacité annuelle calculée = JH/mois×12×dispo, réf. contrat, fournisseur, expiration avec badges rouge Expiré / ambre J-60) ; ResourceModal avec Date d'entrée + Référence contrat (+ Expiration pour internes) ; fiche ressource : méta contrat dans l'en-tête + frise "Charge mensuelle" (barres par mois vs capacité effective, vert <70 / ambre 70-90 / rouge >90, ligne pointillée capacité, data-testid resource-load-timeline).

## 2026-06 — Fiche ressource (livré, agent-testé)
- Bug signalé : clic sur une ressource (ex. Camille Rousseau) sans effet. Cause : aucune fiche ressource n'existait.
- Livré : page /resources/:resourceId (pages/ResourceDetail.jsx) — fil d'Ariane, en-tête (avatar, type, rôle, équipe, TJM, dispo), 4 KPIs donuts (capacité effective, JH alloués + % conso, taux de charge, nb projets), tableau allocations groupées par projet (code + lien fiche projet, période, mois, JH alloués/consommés, barre conso) avec lignes mensuelles dépliables. Lignes de l'annuaire Resources.jsx cliquables (navigate), boutons edit/delete avec stopPropagation conservés. Route ajoutée dans App.js.
- Testé par screenshot E2E (clic ligne → fiche → dépliage mensuel). Commit poussé.

## 2026-06 — SSO Entra/Okta REPORTÉ (décision utilisateur)
- L'utilisateur n'a pas de compte Azure ; Okta idem. À reprendre plus tard.
- Tout est prêt côté MARCEL : code SSO déployé en prod, procédure complète documentée dans la conversation (App registration Azure → Redirect URI https://marcel-ppm.com/api/auth/sso/callback/entra → config Admin > Configuration > SSO)

## 2026-08 — Trajectoire objectifs + Enveloppes N+1/N+2 + Alertes dépassement (livré, DÉPLOYÉ PROD commit ecfdd98, agent-testé iteration_63 100 %)
- Objectifs : bloc Trajectoire par objectif (avancement consolidé pondéré budget, jalons atteints/total, conso, barre RAG, % par projet).
- Arbitrage : boutons rapides enveloppes N/N+1/N+2 + comparaison « Plan pluriannuel {année} » vs enveloppe sur chaque carte.
- Alerte « Dépassement d'enveloppe » (notification cloche, admins+PMO) déclenchée par ajustement pluriannuel/révision budget/modification d'enveloppe, avec anti-spam (flag overrun_alerted).
- Preview uniquement, non déployé en prod.

## 2026-08 — Score Alignement auto + Plan pluriannuel + Export Excel (livré, DÉPLOYÉ PROD commit a254910, agent-testé iteration_62 100 %)
- Arbitrage : critère ALI dérivé automatiquement des objectifs stratégiques actifs rattachés (0→1, 1→3, 2→4, 3+→5) quand le tenant a ≥1 objectif actif ; saisie manuelle bloquée (400 + UI badge indigo non éditable, lien vers /objectifs).
- Budget : onglet Plan pluriannuel — répartition N/N+1/N+2 pro-rata temporis de l'EAC, ajustable projet par projet (budget_by_year, permission budget.edit, tracé audit), comparaison enveloppes (marge/dépassement), colonne hors fenêtre. GET /api/budget/multiyear + PUT /api/budget/project/{id}/multiyear.
- Export Excel COMEX : GET /api/budget/multiyear/export/excel (xlsxwriter, synthèse exercices + enveloppes/marges + schéma directeur détaillé), bouton btn-export-multiyear-excel sur l'onglet. Testé curl + download E2E.
- DÉPLOYÉ PROD marcel-ppm.com 2026-08-11 (inclut aussi Mon Compte + Objectifs + Invitation ODJ du commit 3899508, prérequis du score auto). Vérifié : health 200, login 200, bundle main.81ee37c5.js avec tous les marqueurs, /api/budget/multiyear + export xlsx 200 valides, /api/objectives 200, /api/auth/account 200. alignment_auto=false en prod tant qu'aucun objectif actif n'y est créé (comportement attendu). Disque VPS 80 % après prune 1,97 Go.

## 2026-06 — Site vitrine V2 « type Clarity » (livré, DÉPLOYÉ PROD, agent-testé)
- Demande : « pour le site il faut faire la même chose » que https://clarity.itdesign.de/fr/ — validé via ask_human : sitemap complet (b), look actuel conservé (pas de design_agent), placeholders témoignages/chiffres (b), teaser FR dans le hero (a), déploiement direct prod (« balance en prod »).
- 14 nouvelles pages statiques : FR /fonctionnalites/{portefeuille,projets,ressources,budgets,gouvernance,reporting} + /cas-usage ; EN /en/features/{portfolio,projects,resources,budgets,governance,reporting} + /en/use-cases. Chaque page module : breadcrumb, strip 4 chiffres, 3 articles détaillés, témoignage PLACEHOLDER, 3 modules liés, CTA démo, footer 3 colonnes.
- Pages existantes enrichies : accueil FR/EN (section vidéo teaser + poster, 4 bénéfices avec chiffres PLACEHOLDER « −50%* », 4 personas → cas d'usage, 2 témoignages PLACEHOLDER, FAQ 6 questions + JSON-LD FAQPage + VideoObject, liens bento vers pages modules, footer 3 colonnes) ; hub fonctionnalités FR/EN (8 liens « Explorer le module → ») ; contact FR/EN (nav + footer).
- Nav globale : Accueil / Fonctionnalités / Pour qui ? / Contact. SEO : canonical + hreflang fr/en/x-default sur les 20 pages, BreadcrumbList JSON-LD, sitemap.xml réécrit (20 URLs + xhtml:link hreflang), llms.txt mis à jour.
- nginx.conf : 14 nouvelles locations exactes pour les URLs propres. Teasers MP4 dé-gitignorés (4 fichiers ~12 Mo commités) + posters extraits par ffmpeg (site/assets/teaser-poster-{fr,en}.jpg).
- IMPORTANT PLACEHOLDERS : témoignages et chiffres de résultats sont des EXEMPLES marqués « témoignage client à venir » — à remplacer par de vraies références.
- Vérifié prod : 20/20 URLs HTTP 200 avec bons titres, MP4 + posters 200, sitemap 20 URLs, /api/health 200, formulaire contact 201, disque VPS 79% après prune. Screenshots preview + prod OK.
- Leçon : 2 search_replace « fantômes » détectés par grep de contrôle (bento-link-ai FR, bento-link-projects EN) et corrigés — toujours vérifier par grep après un gros lot.

## 2026-06 (fork) — État après Lot A + Lot B (déployés en PROD, commit 013e6f6)
- ✅ Lot A : cycle de vie/gates gouvernance (validations Archi/Sécu, décisions, dérogations, ODJ, Mes validations), skills, champs personnalisés, vues sauvegardées, snapshots portefeuille, seuils RAG, capacités↔applications, pondération PB. Testé iteration_67.
- ✅ Lot B : MFA TOTP (backend 15/15 curl, UI testée), dark mode, i18n FR/EN (nav+sections ; pages internes restent FR), onboarding 4 étapes, mode Présentation COMEX, favoris projets. Testé iteration_68 (6/6 PASS).
- ✅ PROD marcel-ppm.com à jour (bundle main.3054b24c.js, health 200, routes protégées, permissions synchronisées, disque 81 %).
- ❌ EXCLUS par l'utilisateur : collaboration/@mentions (2), emails réels Resend (3), connecteurs Jira/SAP nocturnes (4), lot C (gros chantiers).
- Backlog restant (non prioritaire) : traduction EN des pages internes (seule la nav/shell est traduite), stockage objet pour uploads (via integration_expert), fallback JWT_SECRET codé en dur dans core/auth.py (à traiter avec précaution — prod n'a pas la variable dans compose, retrait cassant les sessions).

## 2026-06 (fork) — Lot Événements & Pilotage (déployé prod, commit be07d04)
- ✅ Cartographie des instances validée avec l'utilisateur (22 types, 5 niveaux, Portfolio Sync inclus, comité d'investissement = gouvernance, revue portefeuille mensuelle) + calendrier annuel généré (/calendrier).
- ✅ Volet budgétaire : reforecast trimestriel = scope valorisé € (TJM réel), transferts budgétaires tracés, console budget cible (coupes features/pause projet), enveloppes stratégiques par programme/thème.
- ✅ Console capacitaire 3/6 mois par équipe/ressource/compétence (/capacite).
- ✅ Trajectoire SI (TIME) dans Architecture + jalons.
- ✅ Socle PowerPoint (core/pptx.py, charte MARCEL) + export COPIL PPTX depuis le Portefeuille.
- ✅ Rotation des logs Docker en prod (incident disque 97 % résolu — log mongo 6,9 Go).
- Backlog exports PPTX additionnels (~10-15 crédits pièce) : dossier de gate, reforecast, relevé de décisions gouvernance, rapport de PI, capacitaire, trajectoire SI.
- Exclusions maintenues : collaboration (2), emails réels (3), connecteurs Jira/SAP (4), lot C.

## 2026-06 (fork) — Rework Roadmap (déployé prod, commit 4b35fcd, bundle main.47d8ef9b.js)
- ✅ Les 5 volets validés (option B, ~75-95 crédits) : lisibilité (fenêtre 12 mois/zoom 3 niveaux/Aujourd'hui), phases+gates dans les barres, groupements Programme/Direction/Thème/ART, export PPTX Roadmap, dépendances refondues (survol/épinglage, orthogonal, conflits rouges).
- Testé iteration_70 : 100 % PASS. Prod vérifiée (health, bundle, 403).
- Backlog restant inchangé : traduction EN pages internes (~40-60 cr), exports PPTX additionnels (gate/reforecast/décisions/PI/capacitaire/trajectoire ~10-15 cr pièce), instances liées gouvernance (clic COPIL calendrier → ODJ), alerte capacité >100 %.

## 2026-06 (fork) — PB modèle SAFe (Preview, PAS déployé prod — attente ordre utilisateur)
- ✅ Demande utilisateur : « prendre toutes les features sur un PI donné, les valoriser feature par feature, et c'est là qu'on fait l'arbitrage ». Option a validée (~40-55 crédits).
- ✅ Livré : affectation features↔PI (UI Trains SAFe), session PB sur Train+PI avec valorisation auto (jh×TJM), ligne de coupe, application au scope sec/étendu. Testé iteration_71 (17/17 backend, frontend OK après fix FeaturesModal).
- ⏳ EN ATTENTE UTILISATEUR : schéma du cycle de vie des projets (il veut le dessiner lui-même) → ensuite chiffrage coordination inter-modules (chaînage Demande→Projet→Gouvernance→Budget, cockpit par rôle, demandes récurrentes vs spécifiques) + Assistant de migration (Excel + presets Clarity/Planview/Triskell, ~50-70 cr MVP).
- Contexte commercial : 2 segments clients cibles = utilisateurs Excel et utilisateurs Clarity/Planview/Triskell → migration à l'onboarding via assistant unique (mapping guidé, dry-run, presets par outil).

## 2026-06 (fork) — Catalogue d'indicateurs PPM (Preview, PAS déployé prod)
- ✅ 149 indicateurs (Excel utilisateur) : catalogue consultable, sélection par thématique dans 4 contextes (projet/programme/portefeuille/dashboard), 24 calculés auto, statut calculabilité honnête. Testé iteration_72 100% PASS.
- Reste (phases suivantes évoquées) : saisie manuelle des indicateurs non calculables + seuils RAG personnalisables (~20-30 cr) ; catalogue Run (l'utilisateur fournira son fichier) ; brancher plus d'indicateurs auto.
- ⏳ TOUJOURS EN ATTENTE : schéma du cycle de vie projets (coordination inter-modules) ; assistant migration Excel/Clarity/Planview/Triskell (~50-70 cr).

## 2026-06 (fork) — Lot 1 audits UX/UI « cohérence des chiffres » (DÉPLOYÉ PROD, commit 88ecb0b, bundle main.09f356f3.js)
- ✅ F01 capacité équipes réelle, F02/F03 JH/EAC Σ tâches vs déclaré + écart atterrissage, F04 « Temps écoulé », F05 roadmap auto vue complète, F07 dark mode alertes, F09 profils dédoublonnés, F10-F12 connecteurs/Vendors/Dashboard, badge « En retard » Conformité, jitter Arbitrage.
- ✅ Régression préexistante réparée : create_team sans signature def (POST /api/teams cassé).
- Testé iteration_74 : 100 % PASS. F06 (Gantt mai 2022) NON reproduit — non corrigé volontairement.
- Backlog audits restant (non validé) : Lot 2 intuitivité parcours (~35-50 cr), Lot 3 navigation/12 onglets fiche projet (~40-55 cr), Lot 4 système de design/tokens (~50-70 cr).

## 2026-06 (fork) — Lots 2/3/4 audits + alerte cohérence portefeuille (DÉPLOYÉ PROD, commit b3643f9, bundle main.5dd8edd7.js)
- ✅ Lot 2 : formulaire nouveau projet simplifié (4 champs requis, RAG masqué en création, budget/JH optionnels repliables, API jh_planned/status_rag optionnels) ; indicateurs activables en 1 clic (bouton « Activer le socle recommandé (P1) » dans les états vides).
- ✅ Lot 3 : fiche projet 12 onglets → 5 groupes (Aperçu/Informations/Exécution/Pilotage/Gouvernance) + sous-onglets pills + deep-link ?tab= + bouton « Dossier d'engagement » dans le header.
- ✅ Lot 4 : ~2000 classes hex → tokens design m-* (CSS variables + tailwind <alpha-value>), bleus/rouges unifiés, rounded-[10px]→rounded-lg, dark mode adaptatif par redéfinition de variables.
- ✅ Alerte cohérence : GET /api/projects/consistency + bandeau /portfolio (écarts JH déclarés vs Σ tâches >10 %, liens vers fiches).
- Testé iteration_75 : 100 % PASS backend + frontend.
