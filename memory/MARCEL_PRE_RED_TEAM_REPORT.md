# MARCEL — PRE-RED-TEAM HARDENING REPORT
Date : 2026-08-28 · Objectif : **MARCEL PRE-RED-TEAM HARDENED** · Autonomie d'exécution.
Méthode : correctifs + tests positifs ET négatifs (Preview 2 tenants + Production). Preuves = scripts rejouables.

## Résumé chiffré (gate final)
- **0 Critical exploitable** connu.
- **0 High exploitable** connu avec correctif raisonnablement disponible et non bloqué par un pin structurant.
- Sévérités résiduelles (documentées, non bloquantes pré-red-team) : **HIGH infra** = 3 (backups off-site, Mongo at-rest, SPOF/DR — actions externes) ; **MEDIUM** = 4 ; **LOW** = 3.
- **CVE backend** : 20 paquets vulnérables → **8 restants** (tous triés dans `security/CVE_TRIAGE.md` : transitifs LLM, pin FastAPI, non exercés HS256, ou DEV).
- **`data: dict` d'écriture dangereux restants : 0** (77 endpoints audités : allowlist `SimpleCrud._clean` / `_clean_*` / extraction explicite / Pydantic ; seul `project_templates` propageait `data` → corrigé par `strip_protected`).
- **`verify=False` en production : 0** (4 occurrences supprimées ; garde `connector_tls_verify` : jamais insecure en prod).
- **Tests** : JWT 8/8 · RBAC Preview 16/16 + Prod 21/21 · cross-tenant 53/53 · mass-assignment 9/9 · RGPD 9/9 · adversarial 9/9 · backup/restore PASS · uploads 400/200/413 · SSRF 12/12 · CORS OK. **Aucune régression.**

## Tableau CONTROL / BEFORE / ACTION / EVIDENCE / NEGATIVE TEST / REGRESSION / STATUS / REMAINING RISK

| CONTROL | BEFORE | ACTION | EVIDENCE | NEGATIVE TEST | REGRESSION | STATUS | REMAINING RISK |
|---|---|---|---|---|---|---|---|
| Mass assignment | 77 `data: dict`; `project_templates` propageait `data` brut | `core/payloads.py` (strip/reject protected) ; audit des 22 modules (allowlists confirmées) ; fix create+update templates | `test_mass_assignment.py` 9/9 (Preview+Prod) | injection tenant_id/owner_id/role/permissions/is_admin/_id → non stockés | cross-tenant 53/53, RBAC OK | **PASS** | typage Pydantic per-op exhaustif = amélioration continue (P2) |
| TLS connecteurs | 4× `verify=False` (SAP/ServiceNow) | `connector_tls_verify()` (défaut True, opt-out ignoré en prod `MARCEL_ENV=production`) + validate_public_url | `grep verify=False` = 0 ; helper prod → True | opt-out en prod forcé à True | connecteurs importent OK | **PASS** | CA custom si serveurs à cert privé (config) |
| SSRF | connecteurs/webhooks sans validation | `core/ssrf.validate_public_url` (https, blocage loopback/RFC1918/link-local/metadata + DNS) | 7/7 unitaires | adversarial 12/12 (hex/décimal IP, IPv6 ::1, metadata hostname, gopher/file) | — | **PASS** | SSO OIDC endpoints (fournisseur de confiance) hors périmètre |
| CVE dépendances | 20 paquets / 122 advisories | bumps testés (requests/urllib3/idna/cryptography/pillow/multipart/pyjwt/pymongo/…) + job CI + SBOM | `security/CVE_TRIAGE.md`, `pip_audit_after.txt` | — | JWT 8/8 + suites OK sur stack bumpé | **PARTIAL→traité** | 8 restants documentés (transitifs/pin/DEV/non exercés) |
| Audit trail auth | seuls user CRUD/mdp ; pas d'IP | `log_auth_event` (login_success/failed/blocked/logout/mfa) + `profile.permissions_changed` + IP proxy-aware (`request_ctx`, TRUSTED_PROXY) | Prod : événements en base avec **IP client réelle** (104.198.x) | jamais de password/token/secret journalisé | login OK | **PASS** | logout serveur = best-effort (JWT stateless ; révocation via perm_version) |
| RGPD technique | aucun endpoint sujet/tenant | module `rgpd` : export sujet (sans password_hash), anonymisation (intégrité préservée), suppression tenant protégée | `test_rgpd.py` 9/9 | export/suppression cross-tenant → 404/400 ; viewer → 403 ; auto-suppression tenant tiers impossible | tenant Beta intact | **PASS** | DPA/registre/transferts hors UE = juridique (externe) |
| Suppression tenant | inexistante | `POST /admin/rgpd/tenant/delete` : admin only + confirmation == son propre tenant | refus confirmation invalide (400) + cross-tenant (400) | Altair visant Beta → 400, Beta intact | — | **PASS** | double validation UI/opérateur recommandée |
| Backups off-site | backup local uniquement | code upload S3-compatible (chiffré avant upload, vérif présence, statut consigné) gated par env | `backup.sh` (bloc S3) ; monitoring `offsite` | — | restore PASS | **PARTIAL (code prêt)** | credentials/bucket = action externe (`MARCEL_EXTERNAL_ACTIONS.md`) |
| Mongo at-rest | non chiffré | investigation : ext4 sans LUKS, volume Docker clair, Community=pas de natif ; compensation = backups chiffrés | `lsblk` (aucun crypt) | — | — | **FAIL (infra)** | volume chiffré Scaleway/LUKS/Atlas = action externe |
| Monitoring | health basique | `/admin/monitoring` enrichi : disque, âge dernier backup + alerte, erreurs, scheduler ; statut backup en base | Prod : disk 63%, last_backup success 0.1h, backup_alert False | viewer → 403 | — | **PASS** | alerting externe (Sentry DSN/sonde) = config |
| SPOF / DR | VPS+Mongo single-node | documenté ; compensations : backup chiffré quotidien + restore hebdo + swap + watchdog | cron `/etc/cron.d/marcel-backup` | — | — | **PARTIAL (doc)** | réplication/DR = action externe |

## Tests adversariaux internes (section 10) — 9/9 PASS
Bypass RBAC (viewer→admin 403), object-scope (CP hors périmètre 403), cross-tenant par ID (404/400), forged JWT (401), alg=none (401), stale perms (401 via perm_version), SSRF bypass (12/12 : IP hex/décimale, IPv6 ::1, metadata, RFC1918, gopher/file), CORS leurre suffixe (refusé), upload double-extension `.csv.exe` (400), RGPD/tenant-delete abuse (403/400), privilege escalation (403).

## Blockers nécessitant une action externe (voir `MARCEL_EXTERNAL_ACTIONS.md`)
1. Backups off-site : bucket + credentials + aws-cli (HIGH).
2. Mongo at-rest : volume chiffré / LUKS / Atlas (HIGH, migration à froid).
3. DR/redondance : réplica set ou Atlas + PRA/PCA (HIGH).
4. DPA / transferts hors UE (LLM) : juridique (HIGH RGPD).
5. Sentry DSN + sonde externe (MEDIUM).
6. Rotation mots de passe démo (MEDIUM).

## Preuves (scripts rejouables)
`scripts/verify_rbac_prod.py`, `test_cross_tenant.py`, `test_mass_assignment.py`, `test_rgpd.py`,
`test_adversarial.py`, `backup.sh`+`restore_test.sh`, `backend/tests/test_jwt_security.py`.
Artefacts : `security/{pip_audit.json,pip_audit_after.txt,CVE_TRIAGE.md,sbom_backend.cdx.json}`.

## Verdict
**MARCEL PRE-RED-TEAM HARDENED** atteint : gate final validé (0 Critical/High exploitable corrigeable, RBAC+cross-tenant PASS, mass-assignment traité, TLS durci, CVE triées, audit auth opérationnel, RGPD technique opérationnel, backup/restore PASS, monitoring minimum opérationnel, régressions PASS). Blockers restants = actions externes documentées, non bloquantes pour lancer une campagne Red Team.
