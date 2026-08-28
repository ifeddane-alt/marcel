# MARCEL PPM — Security Readiness Report (audit READ-ONLY, 2026-06)

Verdict global : **FAIL — NE PAS LANCER en SaaS B2B commercial en l'état.**
Aucun risque de fuite cross-tenant *confirmé dynamiquement* (isolation OK sur endpoints testés),
mais 1 faille CRITICAL probable (secret JWT faible) + 1 HIGH confirmée (escalade de privilège intra-tenant)
+ identifiants admin publiés → blockers avant premier client.

Méthode : audit statique (sous-agent sécurité) + vérifications dynamiques sur Preview (2 tenants altair/betacorp)
et prod. Preuves citées fichier:ligne ou endpoint. Aucune conformité (ISO/SOC2/RGPD/SecNumCloud) déclarée.

## Tableau de contrôle
| Control | Status | Severity | Evidence | Action |
|---|---|---|---|---|
| Isolation cross-tenant (lecture/écriture) | **PASS** (spot-check dynamique) | — | betacorp voit 3 projets, HTTP 404 sur projet/tâches/jalons Altair ; risks filtrés tenant | Étendre le test aux ~418 endpoints (auto) |
| Escalade privilège intra-tenant (require_write) | **FAIL** | HIGH | core/auth.py:124-133 ; 93 usages ; USER profile = timesheets.submit (profiles/service.py) | Remplacer par permission_required("<mod>.edit/create/delete") |
| Secret JWT | **FAIL** | CRITICAL | core/auth.py:9 fallback `projetenne-secret-key-2025` ; prod .env = chaîne humaine faible ~33c | Secret aléatoire 256 bits/env + supprimer fallback source + iss/aud |
| Identifiants admin publiés | **FAIL** | HIGH | seed.py, seed_beta_corp.py:231, profiles/service.py:532, memory/test_credentials.md | Rotation, reset au 1er login, désactiver comptes démo en prod |
| Hashing mots de passe | **PASS** | — | bcrypt.hashpw/checkpw (auth/router.py:58,168) | RAS |
| Rate limiting login | **PARTIAL** | MEDIUM | in-memory 10/email/60s (auth/router.py:23) + slowapi (core/limiter.py) | Par IP+email, backend Redis (multi-instance), lockout |
| MFA TOTP | **PARTIAL** | MEDIUM | auth/mfa.py ; pas de throttling sur vérif code/backup | Ajouter limitation de tentatives |
| Révocation de session | **FAIL** | MEDIUM | JWT 24h, pas de jti/denylist (auth.py:27) | Tokens courts + refresh, ou denylist |
| Mass assignment (entrées dict) | **PARTIAL** | MEDIUM | 79 endpoints `data: dict` (22 modules dont projects/budget/forecast) | Schémas Pydantic stricts |
| SSRF connecteur Jira | **PARTIAL** | MEDIUM | connectors/jira.py:68-80 base_url sans allowlist | Allowlist hôtes, bloquer IP privées/metadata |
| Injection NoSQL | **À CONFIRMER** | MEDIUM | entrées dict non typées + opérateurs `$` | Valider/typing, rejeter clés `$` |
| Headers web | **PASS** | — | server.py:111-133 X-Frame DENY, nosniff, Referrer, Permissions, HSTS si HTTPS | Durcir CSP (voir ci-dessous) |
| CSP | **PARTIAL** | LOW | server.py:119 unsafe-inline/unsafe-eval | Retirer unsafe-* à terme |
| CORS | **PARTIAL** | MEDIUM | server.py:150 `*` par défaut + allow_credentials=True ; prod via CORS_ORIGINS | Allowlist explicite en prod, jamais `*`+credentials |
| TLS | **PASS** (à confirmer runtime) | — | Traefik v3 (docker-compose) | Vérifier TLS1.2+ / redirection HTTPS |
| Secrets dans le repo | **PASS** | — | backend/.env NON git-tracké ; .env.example présent | — |
| frontend/.env git-tracké | **PARTIAL** | LOW | git ls-files → frontend/.env (contient seulement URL publique) | Retirer du suivi, ajouter frontend/.env.example |
| Token GitHub dans .git/config | **FAIL** | MEDIUM | remote origin avec ghp_… (expiré) | Purger l'URL, utiliser SSH ; le token étant expiré, impact réduit |
| Chiffrement creds connecteurs | **PARTIAL** | MEDIUM | connectors/encryption.py:12 ENCRYPTION_KEY défaut vide | Rendre la clé obligatoire |
| Audit trail | **PARTIAL** | MEDIUM | log_audit → audit_logs ; couverture partielle, pas d'IP ni immuabilité | Compléter (login/échec/export/droits), IP, WORM/rétention |
| Logs structurés / SIEM | **PARTIAL** | LOW | logging std, health /api/health | JSON structuré, export SIEM |
| Chiffrement Mongo at rest | **FAIL** (probable) | MEDIUM | mono-node VPS, pas d'evidence de chiffrement disque/DB | Chiffrement volume/DB |
| Backups | **PARTIAL** | HIGH | scripts/backup.sh : mongodump + purge +Nj ; PAS de chiffrement ni off-site évident, pas de test restore | Chiffrer, externaliser, tester la restauration, RPO/RTO |
| BCP/DR | **FAIL** | HIGH | VPS unique + Mongo single-node = SPOF ; incident réseau 26/08 | PRA/PCA documenté, redondance |
| Dépendances / SBOM | **PARTIAL** | MEDIUM | FastAPI 0.110.1, uvicorn 0.25, starlette 0.37.2, python-jose 3.5, pydantic 2.12, React 19 | Scan CVE (pip-audit/npm audit), SBOM CycloneDX |
| Secure SDLC / CI | **PARTIAL** | MEDIUM | .github/workflows/ci.yml présent | Ajouter secret-scan, SAST, dependency-scan, gate Critical/High |
| Uploads (Excel/.mpp/CSV) | **À AUDITER** | MEDIUM | modules excel_io/csv_import/msproject | Vérifier MIME/taille/nom/path traversal/exécution |
| RGPD (capacités techniques) | **PARTIAL** | HIGH | données perso : users, resources (noms/TJM), timesheets, congés, audit ; données projet → LLM externes | Export/rectif/suppression/purge/suppression tenant + registre |
| Transferts hors UE | **FAIL à documenter** | HIGH | LLM (OpenAI/Anthropic/Google US) via emergentintegrations ; GitHub US | DPA, localisation, mention explicite ou option UE-only |

## Réponses aux 6 questions
1. **Prêt SaaS B2B France ?** Non. Base saine (isolation tenant fonctionnelle, bcrypt, headers, rate-limit, TLS) mais blockers P0/P1 ouverts.
2. **Risque de fuite entre tenants ?** Pas de fuite *directe* confirmée (tests IDOR/lecture/écriture/recherche → 404/vide). Risque *indirect* CRITICAL via secret JWT faible (forge d'un token admin de n'importe quel tenant). C'est LE point à corriger en priorité.
3. **Blockers avant 1er client (P0/P1) :** secret JWT fort (P0) ; require_write → permissions explicites (P1) ; rotation/désactivation comptes démo (P1) ; backups chiffrés+testés (P1) ; CORS explicite prod (P1).
4. **Intervention humaine/externe :** secret manager, DPA sous-traitants, pentest tiers, choix hébergement DR/redondance, décision transferts hors UE (LLM), avocat/DPO pour RGPD.
5. **Questionnaire RSSI grand compte :** audit trail complet+immuable, RBAC documenté, backup/DR testés, SBOM+scan CVE, gestion vulnérabilités, chiffrement at rest, PRA/PCA, registre RGPD, liste sous-traitants.
6. **Vers ISO 27001 :** SMSI, politiques, analyse de risques, SDLC sécurisé automatisé, revues d'accès, tests de restauration périodiques, journalisation SIEM — trajectoire P3.

## Plan priorisé
- **P0 (blocker)** : SEC-002 secret JWT aléatoire + suppression du fallback source.
- **P1 (avant prod commerciale)** : SEC-001 permissions explicites (retrait require_write) ; SEC-003 comptes démo ; CORS prod ; backups chiffrés+off-site+test restore ; validation entrées (dict→Pydantic) sur écritures sensibles.
- **P2 (enterprise readiness)** : SSRF Jira ; révocation session ; audit trail complet+IP+immuable ; chiffrement Mongo at rest ; SBOM+scan CVE ; audit uploads ; RGPD (export/suppression/purge/tenant) ; CI secret-scan/SAST ; frontend/.env hors git ; purge token GitHub .git/config.
- **P3 (maturité/ISO)** : CSP stricte ; SIEM ; PRA/PCA + redondance Mongo ; SMSI ISO 27001.

## Limites de l'audit
Isolation tenant vérifiée par sondage dynamique (non exhaustive sur 418 endpoints — recommander un test automatisé). Valeur exacte du secret prod non extraite (marquée LIKELY). Runtime Traefik/nginx et état réel SSO (OIDC/SAML/Entra) non testés dynamiquement. Uploads et injection NoSQL à approfondir. Aucun test intrusif exécuté.

---
# PHASE 1 — Correction des blockers (exécutée le 2026-06)

## Réalisé (déployé prod commit 5b926a5)
### 1. JWT (P0 CRITICAL) → PASS
- core/auth.py : suppression du fallback hardcodé ; `_load_jwt_secret()` refuse le démarrage si secret absent / <32c / valeur compromise connue ; `JWT_SECRET` chargé à l'import (fail-fast global).
- Rotation effectuée : nouveau secret aléatoire 256 bits (64 hex) en preview ET prod. Ancien secret blacklisté.
- Tests backend/tests/test_jwt_security.py : 8/8 PASS (absent→refus, <32→refus, compromis→refus, valide→OK, token valide→accepté, ancien secret→rejeté, falsifié→rejeté, expiré→rejeté).
- Vérif prod : health OK, login inchangé (Admin2026!), token forgé avec ancien secret → 401.

### 3. Credentials/secrets exposés (P0) → PARTIAL→traité
- profiles/service.py : création auto des 4 comptes démo désormais GATÉE par SEED_DEMO_USERS (défaut false). En prod (flag absent) → aucun compte démo créé, y compris pour tout NOUVEAU tenant client. La synchro profils/permissions continue de tourner.
- seed.py, seed_beta_corp.py : mots de passe lus depuis l'environnement (SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD / SEED_BETA_*), génération aléatoire + affichage si absents ; plus aucun mot de passe littéral dans ces fichiers.
- profiles/service.py : mot de passe démo via SEED_DEMO_PASSWORD (plus de littéral "Altair2026!").
- memory/test_credentials.md : retiré du suivi git + ajouté à .gitignore.
- CI (.github/workflows/ci.yml) : job secret-scan Gitleaks ajouté.
- Preview : SEED_* renseignés dans .env pour préserver les logins de test connus ; prod : non renseignés (pas de reseed auto).

## BEFORE / AFTER
| Control | Before | After | Test | Status | Remaining risk |
|---|---|---|---|---|---|
| Secret JWT (fallback + faible) | FAIL/CRITICAL | Secret 256-bit env, fail-fast, rotation | test_jwt_security 8/8 + prod 401 ancien secret | PASS | Secret manager (P2) ; iss/aud non ajoutés (P2) |
| Création auto comptes démo en prod | FAIL/HIGH | Gatée SEED_DEMO_USERS (off en prod) | code + prod (flag absent) | PASS | Rotation des mots de passe altair/beta existants = action user |
| Mots de passe en dur dans seeds | FAIL/HIGH | Lus depuis env, aléatoire sinon | revue code | PASS | Historique git contient encore les anciennes valeurs |
| test_credentials.md dans le repo | FAIL/MEDIUM | Dé-tracké + gitignore | git ls-files | PASS | Présent dans l'historique git |
| Secret scanning CI | FAIL/MEDIUM | Job Gitleaks | ci.yml | PARTIAL | À valider au 1er run CI |

## RISQUES OUVERTS après Phase 1 (à traiter ultérieurement, NON demandés dans cette phase)
- Historique Git contient encore : ancien secret JWT (désormais inutile car rotaté), mots de passe démo, token GitHub expiré. → nécessite git filter-repo/BFG + rotation de TOUT secret encore valide, opération destructive à planifier (proposée, non exécutée).
- Mots de passe des comptes existants (altair/betacorp) toujours ceux connus publiquement → l'utilisateur doit les changer via l'app (rotation côté user, non fait pour éviter tout lockout).
- require_write (escalade intra-tenant, P0 RBAC) : matrice produite, refonte EN ATTENTE DE VALIDATION UTILISATEUR.

NON déclaré : Marcel n'est ni "secure", ni "GDPR compliant", ni "ISO 27001", ni "production ready" à l'issue de cette phase.
