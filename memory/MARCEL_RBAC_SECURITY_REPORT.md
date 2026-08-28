# MARCEL — Rapport de sécurité RBAC (déployé prod le 2026-08-28, commit 83d0727)

## Contexte
- Avant : `require_write` accordait TOUTE écriture dès qu'un token portait une permission d'écriture quelconque (escalade intra-tenant, HIGH).
- Après : 74 fonctions d'écriture (20 modules) exigent une permission explicite (`permission_required("<module>.edit|create|delete")` / `permission_required_any`), suppression distincte de la modification, scope objet pour Chef de Projet (owner_id), révocation immédiate via `perm_version` (claim `pv`, token 8h max).
- Preuve gate code : `grep require_write` hors définitions = 0 occurrence.

## Environnements testés
- **Preview** : campagne `/app/scripts/test_rbac.py` — **16/16 PASS** (utilisateurs de test créés puis désactivés, projets/programmes temporaires supprimés). Régression JWT `backend/tests/test_jwt_security.py` — **8/8 PASS**.
- **Production marcel-ppm.com** : déployée via `/opt/marcel/scripts/update.sh` (backup préalable, rebuild Docker, reload nginx, sync permissions 2 tenants). Migration `perm_version=1` appliquée aux 8 utilisateurs existants. Campagne `/app/scripts/verify_rbac_prod.py` — **17/17 PASS** + 3 tests de scope Chef de Projet + 1 test de restauration = **21/21 PASS**. Frontend prod vérifié (login → /home).

## Matrice de tests

| PROFILE | PERMISSION | SCOPE | POSITIVE TEST | NEGATIVE TEST | STATUS |
|---|---|---|---|---|---|
| READ_ONLY (Viewer) | portfolio.view | tenant | GET /api/projects → 200 (preview + prod) | — | PASS |
| READ_ONLY (Viewer) | projects.edit (absente) | — | — | PUT /api/projects/{id} → 403 (preview + prod) | PASS |
| READ_ONLY (Viewer) | projects.create (absente) | — | — | POST /api/projects → 403 (prod) | PASS |
| READ_ONLY (Viewer) | projects.delete (absente) | — | — | DELETE /api/projects/{id} → 403 (prod) | PASS |
| READ_ONLY (Viewer) | tasks.create (absente) | — | — | POST /api/tasks → 403 (preview) | PASS |
| READ_ONLY (Viewer) | risks.create (absente) | — | — | POST /api/risks → 403 (prod) | PASS |
| READ_ONLY (Viewer) | timesheet.self.write / leave.self.write (retirées) | — | — | permissions du token sans timesheets.submit ni leaves.submit (preview) | PASS |
| PORTFOLIO (PMO) | projects.edit | tenant (transverse) | PUT projet quelconque du tenant → 200 (preview + prod cp@=PMO_USER) | — | PASS |
| PORTFOLIO (PMO) | programs.create | tenant | POST /api/programs → 201 (preview, nettoyé) | — | PASS |
| CHEF_DE_PROJET | projects.view_own | owner_id | GET /api/projects → ne voit QUE ses 65 projets sur 350 (prod) | 0 projet non-possédé visible (prod) | PASS |
| CHEF_DE_PROJET | projects.edit_own | owner_id | PUT SON projet → 200 (preview + prod) | PUT projet d'un autre (même tenant) → 403 (preview + prod) | PASS |
| CHEF_DE_PROJET | tasks.create (scopé projet) | owner_id du projet parent | POST tâche sur SON projet → 201 (preview) | POST tâche sur projet d'un autre → 403 (preview) | PASS |
| CHEF_DE_PROJET | projects.delete (absente) | — | — | DELETE projet → 403 — delete ≠ update (preview) | PASS |
| TENANT_ADMIN | * (wildcard) | tenant | POST /api/risks payload valide → 201 puis DELETE → 204 (prod — retest du 422 smoke : c'était un payload invalide, pas un défaut RBAC) ; objective/application create 201 + cleanup 204 (preview) | — | PASS |
| Tous | révocation perm_version | token | re-login après bump → nouveau token pv incrémenté accepté (prod : pv=2) | bump perm_version en DB → ancien token → 401 immédiat (preview + prod) | PASS |
| Tous | anti auto-élévation | user courant | — | changement de son propre profil/désactivation refusé (gardes profiles/service.py, testé preview) | PASS |
| Cross-tenant | isolation | tenant_id | betacorp voit ses données (preview) | GET/PUT projets/tâches Altair depuis betacorp → 404/vide (preview) ; prod mono-tenant client : non applicable, admin@example.com isolé par tenant_id | PASS (preview) / PARTIAL (prod, pas de 2e tenant peuplé) |
| Sans authentification | — | — | — | GET /api/projects sans token → 403 (prod) | PASS |

## Détails techniques vérifiés en production
- Claim `pv` présent dans les tokens login (pv=1 puis incréments observés jusqu'à 3 lors des tests).
- Durée de vie token : 8,0 h (bornée).
- `is_ownership_restricted` : wildcard `*` = accès complet ; `projects.view_own`/`projects.edit_own` = filtre `owner_id` (list/get/update).
- Sync des profils par défaut exécutée pour les 2 tenants prod (dont profil « Chef de Projet », 40 permissions, scopes `projects.view_own`, `projects.edit_own`).
- Test scope prod réalisé par affectation TEMPORAIRE du profil Chef de Projet à cp@altair.fr (bump pv), puis restauration complète vérifiée (rôle PMO_USER, 350 projets visibles, perm_version=3).

## Limites
- L'isolation cross-tenant en écriture n'a pas de 2e tenant peuplé en prod pour un test dynamique complet (couvert 16/16 en Preview ; campagne cross-tenant exhaustive planifiée au lot P1 suivant).
- MFA + SSO : claim `pv` câblé dans les 3 flux (login/MFA/SSO), mais flux MFA/SSO complets non rejoués post-RBAC (pas de credentials IdP réels).
- Aucune certification (ISO/SOC2/RGPD) déclarée. Objectif courant : READY FOR EXTERNAL PENTEST.
