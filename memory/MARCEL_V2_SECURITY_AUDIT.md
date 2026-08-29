# MARCEL V2 — Audit sécurité indépendant (Red-Team gate)

Date : 2026-06 (session fork) · Périmètre : backend V2 complet (archive `_v2/`, 604 fichiers ; le patch `marcel_hardening_v2.patch` n'a servi que de changelog).
Méthode : revue statique exhaustive (matrice route→garde→service→scope→tenant sur **232 routes de mutation**), puis **preuve dynamique** contre une stack live (Mongo/API réels) avec comptes réels, puis validation indépendante par l'agent de test (`/app/test_reports/iteration_77.json`, 55/55 PASS).

---

## VERDICT

- **V2 telle que livrée (archive `_v2/`) : NO-GO RED TEAM.** Une vulnérabilité **HIGH exploitable** par n'importe quel utilisateur authentifié (module Arbitrage : aucune autorisation sur toutes les écritures, dont l'application d'un scénario qui modifie les vrais projets/budgets).
- **Après remédiation appliquée et validée dans cette session : GO RED TEAM.** Plus aucune vulnérabilité Critical/High exploitable. Les items résiduels sont Medium/Low (durcissement, non bloquants) et documentés ci-dessous.

Note d'intégrité : le gate « GO » n'est atteint qu'*après* les correctifs de cette session. Le code V2 tel que remis initialement échoue le gate à cause de H1.

---

## Ce que la V2 fait bien (confirmé, non-findings)

Vérifié par lecture de code + tests. Les points suivants sont solides et NE sont PAS des failles :
- **JWT** : secret fail-fast (≥32c, blocklist de secrets faibles), `HS256` figé, TTL 8h, révocation par `perm_version` (`pv`), **fail-closed 503** si la vérif DB est indisponible.
- **Login** : MFA réellement imposée (ticket-only si `mfa_enabled`), `is_active` + compte SSO vérifiés, bcrypt.
- **MFA** : challenge one-shot (`jti` + delete), max 5 essais, rate-limit 10/min, backup codes 128 bits hashés.
- **OIDC** : RS256 uniquement (rejet `alg=none`/HS), clé via JWKS par `kid`, `aud`+`iss`+`nonce`+`exp` validés, `state` one-shot.
- **SAML** : `strict=True`, `wantAssertionsSigned=True`, anti-rejeu par assertion_id, RelayState one-shot, `PUBLIC_BASE_URL` obligatoire en prod.
- **SimpleCrud** : plus d'autorisation par rôle `PMO_USER` — toute écriture exige une permission métier explicite ; `require_write` obsolète = fail-closed.
- **Mass assignment** : allowlists (`_clean`/`_clean_payload`/schemas Pydantic/`strip_protected`) ; `tenant_id`/`owner_id` non surchargeables.
- **Isolation tenant** : toutes les requêtes filtrées par `tenant_id` du token ; RGPD (`/admin/rgpd/*`) admin-only + confirmation == son tenant ; anti cross-tenant.
- **Docker** : Mongo avec auth root + URI backend authentifiée.
- **CORS** : jamais wildcard+credentials ; défaut sûr (allowlist vide).
- **Uploads** : allowlist d'extension + borne de taille (413).
- **Modules guardés vérifiés** : projects, tasks, risks, decisions, milestones, teams, resources, safe, okrs, demands, governance, forecast, budget, budget_ops, objectives, run, applications, architecture, security, indicators, lifecycle, work_allocations, csv_import, excel_io, msproject, powerbi, profiles, admin_config, status_report, agent(/analyze), engagement(CRUD), pb(CRUD). Faux positifs de scan corrigés par lecture du corps de fonction.

---

## FINDINGS

### H1 — Arbitrage : absence totale d'autorisation sur toutes les écritures — HIGH — CORRIGÉ ✅
- **Routes** : `PUT /api/arbitrage/weights`, `PATCH /api/arbitrage/projects/{id}/scoring`, `POST /api/arbitrage/envelopes`, `DELETE /api/arbitrage/envelopes/{id}`, `POST /api/arbitrage/scenarios`, `POST /api/arbitrage/scenarios/{id}/apply`, `DELETE /api/arbitrage/scenarios/{id}`.
- **Reproduction** : se connecter avec un compte non arbitre (sans `arbitrage.edit`) ; `PUT /api/arbitrage/weights` renvoyait **200** ; `POST /api/arbitrage/scenarios/{id}/apply` appliquait les `modifications` (status, capex/opex, budget_total, dates, scores) aux **vrais projets** du tenant.
- **Impact** : escalade verticale intra-tenant + modification non autorisée des données financières/portefeuille et des projets réels. Aucun contrôle au routeur (`Depends(get_current_user)` seul) ni au service.
- **Correctif** : `require_perm(user, "arbitrage.edit")` sur weights/scoring/envelopes/apply/delete ; `require_perm(user, "arbitrage.simulate")` sur `save_scenario`. Fichier `backend/modules/arbitrage/service.py`.
- **Test/Preuve** : dynamique — viewer(CIO, sans arbitrage.edit) → **403** sur les 7 écritures ; manager(PORTFOLIO) → **200/201** ; agent de test 55/55 (iteration_77) : deny renvoyé AVANT toute logique métier (pas de 422/404 trompeur).

### M1 — Endpoints de seed profils sans autorisation — MEDIUM — CORRIGÉ ✅
- **Routes** : `POST /api/profiles/seed`, `POST /api/profiles/seed-full`.
- **Reproduction** : tout utilisateur authentifié appelait ces routes ; `seed_default_profiles` **réécrit les permissions de tous les profils système** aux valeurs par défaut (`$set permissions`).
- **Impact** : un compte non-admin peut réinitialiser tout le RBAC du tenant et potentiellement re-accorder des permissions qu'un admin avait retirées (escalade indirecte au prochain login). La création de comptes démo reste, elle, protégée par env (`SEED_DEMO_USERS`, off en prod).
- **Correctif** : routeur → `Depends(permission_required("admin.config"))`. La garde reste au routeur (le seed est aussi appelé au startup sans utilisateur).
- **Test/Preuve** : manager/viewer → 403 ; admin → 200. (dynamique + iteration_77)

### M2 — `apply-template` sans autorisation — MEDIUM — CORRIGÉ ✅
- **Route** : `POST /api/projects/{id}/apply-template`.
- **Reproduction** : tout utilisateur authentifié créait tâches + jalons sur n'importe quel projet du tenant.
- **Impact** : injection de données / écriture non autorisée sur les projets.
- **Correctif** : exige `projects.edit` ou `projects.edit_own` + scope owner (`is_ownership_restricted`). `project_templates/service.py`.
- **Test/Preuve** : viewer → 403 ; manager (projects.edit) passe la garde. (iteration_77)

### M3 — `test_connection` connecteur sans autorisation — MEDIUM — CORRIGÉ ✅
- **Route** : `POST /api/connectors/{type}/test` (les autres opérations connecteur — config/mapping/sync — exigeaient déjà `admin.config`, pas `test`).
- **Reproduction** : tout utilisateur authentifié déclenchait une requête sortante vers l'URL du connecteur configuré (avec credentials déchiffrés côté serveur).
- **Impact** : déclenchement d'appels sortants + oracle de connectivité par un non-admin ; surface SSRF (URL admin-définie).
- **Correctif** : `_require_admin_config(user)` en tête de `test_connection`. `connectors/service.py`.
- **Test/Preuve** : viewer/manager → 403 ; admin → non-403. (dynamique + iteration_77)

### M4 — `engagement/attest` sans autorisation — MEDIUM — CORRIGÉ ✅
- **Route** : `POST /api/projects/{id}/engagement/attest`.
- **Reproduction** : tout utilisateur authentifié cochait/validait les critères de gate/engagement d'un projet.
- **Impact** : intégrité de la gouvernance (readiness des gates falsifiable).
- **Correctif** : exige `projects.edit`/`projects.edit_own` + scope owner. `engagement/service.py`.
- **Test/Preuve** : viewer → 403 ; manager → 200. (iteration_77)

### M5 — Saisie manuelle d'indicateurs (scope `dashboard`) sans autorisation — MEDIUM — CORRIGÉ ✅
- **Route** : `PUT /api/indicator-catalog/manual/{scope}/{id}` avec `scope=dashboard`.
- **Reproduction** : le contrôle ne s'appliquait qu'aux scopes ≠ dashboard ; pour `dashboard`, aucune permission requise.
- **Impact** : falsification des KPI portefeuille affichés au COMEX.
- **Correctif** : `scope=dashboard` exige désormais `indicators.manage`. `catalog/service.py`.
- **Test/Preuve** : profil minimal → 403 (iteration_77, fixture TEST_MinPerm).

### M6 — Export COPIL sans permission d'export — MEDIUM/LOW — CORRIGÉ ✅
- **Route** : `POST /api/export/copil`.
- **Reproduction** : tout utilisateur authentifié exportait le PPT COPIL (données portefeuille).
- **Impact** : export de données sans permission explicite.
- **Correctif** : routeur → `Depends(permission_required("export.ppt"))`. `export/router.py`.
- **Test/Preuve** : profil minimal → 403 (iteration_77).

### M7 — `tenant/settings` gardé par rôle et non par permission — LOW — CORRIGÉ ✅ (cohérence)
- **Route** : `PUT /api/tenant/settings`. Était `role == TENANT_ADMIN` (protégé mais hors modèle RBAC).
- **Correctif** : `Depends(permission_required("admin.config"))`. `tenant/router.py`.
- **Test/Preuve** : admin → 200 (round-trip sans perte) ; manager → 403 (dynamique).

### M8 — SSRF : rebinding DNS TOCTOU — MEDIUM (admin-gated) — NON CORRIGÉ (recommandation)
- **Lieu** : `core/ssrf.validate_public_url` résout le DNS à la validation, mais la requête réelle (connecteurs/webhooks) re-résout sans épingler l'IP validée.
- **Reproduction** : un `admin.config` configure une URL dont le DNS renvoie une IP publique à la validation puis une IP interne (169.254.169.254 / RFC1918) à la requête.
- **Impact** : accès réseau interne / metadata cloud côté serveur (limité aux admins tenant, d'où Medium).
- **Correctif recommandé** : épingler l'IP validée pour la connexion (résoudre une fois, connecter à l'IP, forcer l'en-tête Host), interdire les redirections vers IP privées, revalider après redirection.
- **Test** : à faire après implémentation (résolveur contrôlé + IP interne attendue → refus).

### M9 — CSP `script-src 'unsafe-inline' 'unsafe-eval'` — MEDIUM/LOW — NON CORRIGÉ (recommandation)
- **Lieu** : `server.py` SecurityHeadersMiddleware.
- **Impact** : défense en profondeur XSS affaiblie (pas exploitable sans point d'injection).
- **Correctif recommandé** : passer à des nonces/hashes CSP (nécessite build front adapté ; risque de casse — à tester).

### L1 — Anti-bruteforce login en mémoire, par email seulement — LOW — NON CORRIGÉ (recommandation)
- 10 essais/60s par email, dict module (par process, remis à zéro au restart). Pas de limite par IP → password spraying multi-emails non limité.
- **Correctif recommandé** : throttling par IP + stockage partagé/persistant.

### L2 — Énumération d'utilisateurs au login — LOW — NON CORRIGÉ (recommandation)
- Messages distincts « compte désactivé » (403) / « compte SSO » (401) vs « identifiants invalides » (401) → révèlent l'existence d'un email.
- **Correctif recommandé** : normaliser en 401 générique.

### L3 — WebSocket : `decode_token` ne vérifie pas la révocation — LOW — NON CORRIGÉ (recommandation)
- `core/auth.decode_token` (auth WS) ne contrôle ni `perm_version` ni `is_active` → un token révoqué/désactivé reste valide sur le WS jusqu'à 8h. Surface WS = notifications de l'utilisateur uniquement.

### L4 — Clé de chiffrement connecteurs : fallback dev déterministe — LOW — INFO
- Hors production (`MARCEL_ENV != production`), clé Fernet déterministe en dur → credentials connecteurs non confidentiels en preview/dev. En prod, fail-fast si `ENCRYPTION_KEY` absente. Acceptable ; ne jamais promouvoir des données prod via un env non-prod.

### L5 — PB : vote sans restriction de participant — LOW — INFO/recommandation
- `POST /api/pb/sessions/{id}/vote` : tout utilisateur du tenant peut voter (le modèle de session ne stocke pas de liste de participants). Valide les items/montants/enveloppe. Intégrité de la consolidation potentiellement biaisée.
- **Correctif recommandé** : ajouter une allowlist `participants` à la session et la vérifier.

### L6 — Bug fonctionnel (échappement email) `public_site` — LOW — CORRIGÉ ✅
- `_notify` : la variable locale `html` masquait le module `html` → `UnboundLocalError` (capturé) ⇒ l'email de notification ne partait jamais et l'échappement HTML annoncé était inopérant.
- **Correctif** : renommage `html` → `body_html`. `public_site/router.py`.

### OBS — Profils « lecture »-type portant `indicators.manage`/`export.ppt`/`lifecycle.decide` — décision métier
- Les profils système (dont CIO/« Direction SI ») portent des permissions d'écriture/décision. Ce n'est pas un bug d'implémentation mais une décision de dimensionnement des profils à revoir avec le métier.

---

## Preuves / artefacts
- Scans statiques : `_v2/scan_mutations.py` (232 mutations), `_v2/scan_service_authz.py`.
- Preuve dynamique RBAC : `_v2/rbac_proof.py` (7/7 arbitrage 403 pour non-autorisé, 200/201 pour autorisé).
- Validation indépendante : `/app/test_reports/iteration_77.json` (55/55 PASS) + suite régression `backend/tests/test_rbac_audit_v2*.py`.
- Correctifs (Preview) : `arbitrage/service.py`, `connectors/service.py`, `project_templates/service.py`, `engagement/service.py`, `catalog/service.py`, `profiles/router.py`, `export/router.py`, `tenant/router.py`, `public_site/router.py`.

## État de déploiement
- Correctifs appliqués et testés en **Preview** (55/55 RBAC + 11/11 durcissement).
- **DÉPLOYÉ EN PRODUCTION** le 2026-08-29 — commit `5adbbaf73f2893b525bf84ecfb8f3c3bfd901f3c`.

## Déploiement production (2026-08-29)
- **Commit déployé** : `5adbbaf73f2893b525bf84ecfb8f3c3bfd901f3c` (VPS `/opt/marcel`, backend rebuild `--no-deps`, mongo/frontend/nginx intacts).
- **Méthode** : git bundle → VPS `git reset --hard` → `docker compose up -d --build --no-deps backend`. Backup préventif effectué avant. Backend `Up (healthy)`, `/api/health` ok.
- **Infra** : docker-compose rendu prod-safe (Mongo-auth optionnel/rétro-compatible ; l'auth réseau Mongo reste une migration infra coordonnée à part). `ENCRYPTION_KEY` forte ajoutée en prod (les 3 connecteurs existants avaient des credentials vides → aucune casse) ; `PUBLIC_BASE_URL` ajoutée.
- **Smoke sécurité PROD (https://marcel-ppm.com)** : **26/26 PASS** — arbitrage 6/6 → 403 viewer ; apply-template/connectors-test/profiles-seed/engagement-attest/tenant-settings → 403 ; manager/admin légitimes 200/201 ; isolation tenant + IDOR ok ; login/auth ok ; JWT pv + MFA non régressés ; CRUD (risk create/delete) non régressé ; login uniforme + throttle IP 429.
- **CI** : job `rbac-audit` (bloquant) ajouté à `.github/workflows/ci.yml` (mongo service + seed + normalisation mots de passe + uvicorn + pytest `test_rbac_audit_v2*`). S'exécute sur GitHub Actions au push.
- ⚠️ **Divergence dépôt** : le VPS est sur `5adbbaf` (code audité), mais GitHub `origin/main` est sur une branche divergente (`2821879`). Avant tout futur `update.sh`, réconcilier GitHub sur `5adbbaf` (Save to GitHub) pour éviter un merge régressif et activer la CI.

## PROD SECURITY GATE = PASS · GO RED TEAM
Après déploiement et smoke prod 26/26, plus aucun Critical/High exploitable en production. Résiduels Medium/Low documentés (SSRF admin-gated désormais durci, CSP, énumération SSO résiduelle, chiffrement Mongo at-rest infra, PB vote) — non bloquants.
