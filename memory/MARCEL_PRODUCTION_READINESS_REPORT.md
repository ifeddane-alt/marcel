# MARCEL PPM — Production Readiness Report (pré-pentest)
Date : 2026-08-28 · Périmètre : application SaaS multi-tenant MARCEL (marcel-ppm.com)
Méthode : correctifs + tests dynamiques (Preview 2 tenants + Production), preuves citées. Aucun test intrusif tiers exécuté.

## VERDICT : **READY FOR EXTERNAL PENTEST** — renforcé « PRE-RED-TEAM HARDENED » (2026-08-28)

> Mise à jour 2026-08-28 (sprint pré-red-team) : les risques résiduels ci-dessous ont été traités ou documentés.
> Voir `MARCEL_PRE_RED_TEAM_REPORT.md` (matrice complète + tests adversariaux) et `MARCEL_EXTERNAL_ACTIONS.md`.
> Résumé : mass-assignment traité (0 endpoint dangereux), `verify=False` éliminé (0 en prod), SSRF durci (12/12 bypass bloqués),
> audit auth login/logout/révocation + IP proxy-aware, RGPD technique (export/anonymize/tenant-delete scoped, 9/9),
> monitoring enrichi (disque/backup), CVE 20→8 paquets (triage documenté), backup off-site (code prêt, gated).
> Blockers restants = infra/juridique externes (backups off-site, Mongo at-rest, DR, DPA hors UE).


Justification : les blockers P0 identifiés à l'audit initial (secret JWT faible, escalade de privilège intra-tenant)
sont corrigés, déployés en production et prouvés par tests. L'isolation cross-tenant est vérifiée dynamiquement
de façon exhaustive (53/53). Les surfaces réseau (CORS, SSRF) et d'entrée (uploads) sont durcies. Un dispositif
de sauvegarde chiffrée + restauration testée est opérationnel. Un pentest externe serait désormais productif
(non bloqué par des défauts évidents). Ce verdict **n'est PAS** une certification (ISO/SOC2/RGPD/SecNumCloud)
ni une garantie d'absence de vulnérabilité. Les risques résiduels ci-dessous doivent être traités avant
« PRODUCTION READY / LIMITED PRODUCTION » commercial grand compte.

---
## Contrôles traités (BEFORE / AFTER / TEST / STATUS / REMAINING RISK)

| CONTROL | BEFORE | AFTER | TEST | STATUS | REMAINING RISK |
|---|---|---|---|---|---|
| Secret JWT | fallback codé en dur + secret faible (CRITICAL) | 256-bit env, fail-fast, rotation, ancien token rejeté | test_jwt_security 8/8 + prod 401 ancien token | PASS (prod) | secret manager externe (P2) ; iss/aud non ajoutés |
| Escalade privilège intra-tenant (require_write) | toute perm d'écriture ouvrait 74 fonctions (HIGH) | permissions explicites edit/create/delete, 0 require_write résiduel | Preview 16/16 + prod 21/21 | PASS (prod, commit 83d0727) | endpoints `data: dict` non typés (mass assignment, voir plus bas) |
| Object-level authz (Chef de Projet) | permission globale suffisait | scope owner_id projets + tâches | prod : CP voit 65/350, non-possédé 403, possédé 200 | PASS (prod) | scope hérité risques/jalons non testé une à une |
| Révocation de session | JWT 24h, aucune révocation | perm_version + claim pv, token 8h, bump = 401 immédiat | prod : bump→401, re-login pv+1 | PASS (prod) | pas de denylist par jti / logout serveur |
| Isolation cross-tenant | spot-check partiel | campagne exhaustive 12 entités (list/GET/PUT/DELETE) + 5 exports/PDF + budget | test_cross_tenant 53/53 (Preview altair/betacorp) | PASS (Preview) | prod n'a qu'1 tenant client peuplé → non rejoué en prod |
| CORS | défaut `*` + allow_credentials=True (MEDIUM) | jamais wildcard+credentials ; allowlist explicite prod | prod : evil.com sans ACAO, marcel-ppm.com autorisé | PASS (prod, commit 3f1df01) | — |
| SSRF (connecteurs Jira/SAP/ServiceNow + webhooks) | base_url/URL sans validation (MEDIUM) | garde `validate_public_url` : https only, blocage loopback/RFC1918/link-local/metadata + résolution DNS | 7/7 unitaires (metadata/127/10.x/localhost/ftp bloqués, hôtes publics OK) | PASS (prod) | SSO OIDC endpoints non couverts (fournisseur de confiance) |
| Uploads/imports (CSV/Excel/MPP) | `await file.read()` non borné (DoS mémoire) | extension allowlist + lecture bornée 15 Mo → 413 | Preview + prod : .txt 400, csv 200, 16 Mo 413 | PASS (prod, commit 801c6d6) | pas d'antivirus/contenu ; MPP via MPXJ/JRE non fuzzé |
| Backups | marcel-backup INEXISTANT (échec silencieux), aucun backup, pas de cron, pas de chiffrement | mongodump chiffré AES-256 PBKDF2, symlink réparé, cron quotidien 03h30, rétention 30j, backup préventif au déploiement | restore_test PASS (350 proj/8 users/2 tenants/700 risks/4229 tasks identiques), déploiement crée backup | PASS (prod) | clé co-localisée sur le VPS ; PAS off-site ; restore hebdo à surveiller |
| SBOM | inexistant | CycloneDX 1.6, 155 composants backend | sbom_backend.cdx.json généré + artefact CI | PASS | SBOM frontend non généré |
| Scan CVE | inexistant | pip-audit + yarn audit capturés + job CI dependency-scan (non bloquant) | rapports memory/security/*.txt | PARTIAL | dépendances vulnérables non patchées (voir plus bas) |
| Secret scanning CI | ajouté Phase 1 (Gitleaks) | inchangé | ci.yml | PARTIAL | exécution CI réelle à valider (GitHub en retard) |

---
## Risques résiduels (NON bloquants pour un pentest, à traiter avant prod commerciale)

### HIGH
- **Dépendances vulnérables non patchées.** pip-audit : PyJWT 2.11.0 (transitif — l'app signe via python-jose, non affecté directement), python-multipart 0.0.22 (DoS multipart → maintenant borné en amont par la garde uploads), pillow 12.1.1, aiohttp 3.13.3 (transitif). yarn audit : 343 advisories, très majoritairement transitives de react-scripts (build-time, non exposées au navigateur) ; runtime réel à cibler : axios, react-router. → planifier montée de version testée (python-multipart, pillow ; axios côté front) avec régression.
- **Backups non off-site + clé co-localisée.** La sauvegarde chiffrée réside sur le même VPS que la donnée et la clé. → externaliser (S3/Scaleway Object Storage chiffré) + garde de clé séparée.
- **SPOF / pas de DR.** VPS unique + Mongo single-node. → PRA/PCA documenté, réplication ou restauration hors-site testée, RPO/RTO définis.
- **Chiffrement Mongo at-rest absent (probable).** Mono-node sans chiffrement disque/DB évident. → chiffrement volume/DB.
- **RGPD technique.** Pas d'endpoint d'export/rectification/suppression des données d'une personne, ni de suppression complète d'un tenant. → implémenter data-subject requests + purge tenant + registre des traitements ; DPA sous-traitants (LLM US via emergentintegrations, GitHub US).

### MEDIUM
- **Mass assignment.** 76 endpoints `data: dict` (22 modules) acceptent des dictionnaires non typés. → schémas Pydantic stricts sur les écritures sensibles (budget/projects/forecast en priorité).
- **Audit trail incomplet.** Couvre user/project/budget/décisions/bénéfices mais PAS login/échec login/logout/exports/changements de droits, et n'enregistre pas l'IP. → étendre + IP + immuabilité/rétention. (Modif du flux login = passer par integration_expert.)
- **Rate limiting login in-memory.** Non partagé multi-instance, pas de lockout. → backend Redis + lockout + throttling MFA.
- **TLS connecteurs SAP/ServiceNow `verify=False`.** Vérification TLS désactivée sur les appels sortants. → activer la vérification / CA custom.
- **Monitoring/SIEM.** /api/health expose error_counts ; pas d'alerting ni d'export SIEM. Sentry câblé si DSN (non configuré). → logs JSON structurés + alerting.

### LOW
- **CSP** contient unsafe-inline/unsafe-eval (contrainte CRA). → durcir à terme.
- **Historique Git** contient d'anciens secrets (JWT rotaté, mots de passe démo, token GitHub expiré). → git filter-repo/BFG après coordination (opération destructive, non exécutée).
- **frontend/.env git-tracké** (ne contient que l'URL publique). → dé-tracker.
- **requirements.txt** embarque des outils dev (black/pytest) en prod. → séparer requirements-dev.

---
## Actions humaines / externes requises
- Rotation des mots de passe des comptes existants (altair/betacorp) via l'app — historiquement publics.
- Décision hébergement DR/redondance + Object Storage chiffré off-site pour les backups.
- DPA sous-traitants + décision transferts hors UE (LLM) ou option UE-only.
- Pentest tiers + éventuel DPO/avocat pour le volet RGPD.

## Preuves & artefacts
- Scripts : `/app/scripts/verify_rbac_prod.py` (21/21 prod), `/app/scripts/test_cross_tenant.py` (53/53), `/app/scripts/test_rbac.py` (16/16 Preview), `/app/backend/tests/test_jwt_security.py` (8/8), `/app/scripts/backup.sh` + `/app/scripts/restore_test.sh` (RESTORE_TEST_PASS).
- Rapports : `/app/memory/MARCEL_RBAC_SECURITY_REPORT.md`, `/app/memory/MARCEL_SECURITY_READINESS_REPORT.md`, `/app/memory/security/{pip_audit.txt,sbom_backend.cdx.json,npm_audit.json}`.
- Commits déployés prod : 83d0727 (RBAC), 3f1df01 (CORS+SSRF), 801c6d6 (backups+uploads+CI).
