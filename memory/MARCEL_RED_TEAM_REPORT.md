# MARCEL — Rapport Red Team (marcel-ppm.com)

- Date : 2026-06 (fork)
- Base auditée : commit `74cd118` ; remédiation `c0e0417`
- Méthode : (1) audit offensif indépendant du code (statique, read-only) + (2) passe dynamique non destructive contre la production (curl : lectures, rejets 401/403, un create+delete admin auto-nettoyé).
- Rapports /app/memory utilisés comme pièces d'appui, passe refaite de zéro en supposant des failles restantes.

## Résultat global
- **Critical : 0 | High : 0 | Medium : 1 (remédié) | Hardening : 4**
- Aucun chemin Critical/High exploitable trouvé (login/JWT/MFA/SSO/RBAC/IDOR/cross-tenant/mass-assign/WS/SSRF/uploads/injections/headers).
- **VERDICT : RED TEAM = PASS** (après remédiation SEC-001).

## Findings

### SEC-001 [MEDIUM] SSRF DNS-rebinding sur SAP « test connection » — REMÉDIÉ
- Route/fichier : `POST /connectors/sap/test` → `modules/connectors/sap.py:test_connection` (ex-ligne 65).
- Prérequis : utilisateur `admin.config` + DNS contrôlé par l'attaquant + timing (TOCTOU entre `validate_public_url` et la connexion).
- Repro : configurer une base_url SAP dont le nom résout d'abord public (passe la validation) puis privé à la connexion → le serveur émet un GET vers l'hôte interne, statut divulgué. Pas de suivi de redirection (httpx défaut).
- Impact réel : sondage réseau interne borné (chemin/statut fixes), admin-only, même tenant. Pas de lecture de données d'un autre tenant.
- Correctif appliqué : le chemin de test utilise désormais `hardened_async_client` (IP-pinning à chaque connexion, anti-rebinding, no-redirect), aligné sur jira/servicenow. Plus aucun `httpx.AsyncClient` brut dans les connecteurs.
- Test de non-régression : `backend/tests/test_ssrf_connectors.py` (aucun client httpx brut dans sap/jira/servicenow ; `test_connection` SAP utilise le client durci ; `validate_public_url` bloque 169.254.169.254/127.0.0.1/10.x/[::1] ; client durci `follow_redirects=False`). CI backend + suite verte.

### SEC-002 [MEDIUM] Affaiblissement clé/TLS si MARCEL_ENV != production — RÉSOLU (vérifié)
- Fichiers : `modules/connectors/encryption.py:24` (fallback clé déterministe hors prod), `core/ssrf.py:67` (verify_tls=false honoré hors prod).
- Vérification prod : `MARCEL_ENV=production` confirmé sur le VPS → fallback et opt-out TLS **inactifs**. `ENCRYPTION_KEY` posée, `JWT_SECRET` 64 chars, `CORS_ORIGINS` = allowlist explicite (pas de wildcard), `SKIP_LICENSE_CHECK` vide.
- Reco résiduelle (hardening) : garde fail-closed au démarrage si le fallback crypto serait atteignable en prod.

## Hardening (P3, non bloquants)
- CORS wildcard : artefact Preview uniquement — prod = allowlist explicite (vérifié). Credentials désactivés, auth par header Authorization.
- CSP : `script-src 'unsafe-inline' 'unsafe-eval'` (défense en profondeur XSS) — nonces/hashes recommandés.
- Clé maître licence en dur (`core/license.py:15`) : forge de licence possible, pas un contrôle de données tenant — déplacer en secret.
- Mongo auth : ACTIVÉE en prod (marcel_app readWrite mono-DB) — vérifié `AUTH_ON:Unauthorized` sur accès anonyme.
- `strip_protected/reject_protected` (`core/payloads.py`) inutilisés : endpoints admin raw-dict schema-bornés côté routeur ; application défensive recommandée.

## Preuves dynamiques (prod)
- Smoke sécurité : 26/26 PASS.
- Red team dynamique : 34/39, les 5 « FAIL » = artefacts confirmés (compte betacorp inexistant en prod → 401 ; payloads 422 de schéma invalide). Un 422 n'est JAMAIS une faille RBAC.
- Re-test payloads valides : 9/9 PASS (viewer arbitrage weights/envelope/scoring = 403 ; mass-assign tenant_id/risk_id/criticality ignorés+forcés ; cross-tenant/IDOR = 404 ; création risque hors tenant = 404).
- JWT : alg=none rejeté, payload tamponné (sig invalide) rejeté, malformé rejeté.
- AuthN : erreur login uniforme (anti-enum), NoSQL operator injection rejetée (422), throttle IP 429.
- Headers : HSTS, X-Frame DENY, nosniff, CSP présents ; CORS ne reflète pas une origine arbitraire.
- SSRF connecteurs (admin, cibles internes 169.254.169.254 / localhost) : bloqués/échec.

Scripts de preuve (non commités, mots de passe démo) : `/app/_v2/prod_smoke.py`, `/app/_v2/redteam_dynamic_prod.py`, `/app/_v2/redteam_retest.py`.

## État final
- origin/main == prod == `c0e0417a1f9adae7f76f14c54e397f771b81d165`, repo prod propre, Mongo auth ON.
- CI 5/5 verte (rbac 55 passed/1 skipped, gitleaks 0 leak, backend pytest inc. test SSRF).
- **RED TEAM = PASS** — aucun Critical/High exploitable.
