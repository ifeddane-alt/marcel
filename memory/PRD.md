# PRD — Projetenne (PPM SaaS Multi-Tenant)

## Énoncé du problème original
Construire et développer en continu une application SaaS multi-tenant appelée `Projetenne` — un PPM (Project Portfolio Management) complet.

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

## État final — MARCEL V1.0 ✅ + Module Budget ✅ (Mai 2026)
- **19/19 items MARCEL** : COMPLÉTÉS ✅
- **Module Budget** : Page /budget complète (KPIs, tableau, programmes, graphiques, export, révisions) ✅
- **Tests Pytest** : **80 tests passent / 0 échec** ✅
- **Sécurité** : Rate limiting par email (10/min), HTTP Security headers ✅
- **Bugs connus** : Aucun
- **APIs mockées** : SAP RFC (pyrfc absent), Jira sync, ServiceNow sync
- **Isolation multi-tenant** : ✅ Altair / Beta Corp totalement isolés

## Backlog / Améliorations futures
### P0 — Néant (MARCEL V1.0 intégralement livré)
### P1 — Optionnel
- Installer pyrfc + SAP NW RFC SDK pour connectivité RFC native réelle
- CI/CD pipeline GitHub Actions
- Nettoyage des anciens fichiers de test legacy (34 fichiers d'anciennes itérations)

### P2 — Futur
- Module "Tableau de bord CxO" personnalisable
- Connecteur Microsoft Project
- API REST publique + webhooks
- Mobile app (React Native)
