# PRD — MARCEL (PPM SaaS Multi-Tenant)

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
- ⏳ EN ATTENTE réponse utilisateur : reporting PMO "PTF Sync" + "SPR" (questions posées : définitions exactes, sections, format écran/PPT/PDF, périmètre).

## Backlog / Améliorations futures
### P1 — Court terme
- SAP RFC natif : installer `pyrfc` + SAP NW RFC SDK (sous licence SAP) pour remplacer le mock actuel

### P2 — Moyen terme (restant)
- Envoi réel Sentry/Resend à activer sur le VPS (ajouter SENTRY_DSN / RESEND_API_KEY dans le .env)

### P3 — Long terme
- Mobile app React Native
- Module BI intégré
- AI Planning Assistant (prévision charge)
