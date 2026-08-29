# MARCEL — Security Hardening v2

Date: 2026-08-29

## Statut

Cette version corrige les écarts prioritaires identifiés lors de la revue pré-Red-Team. Elle n'est pas déclarée « Red-Team ready » tant que les tests d'intégration ne sont pas rejoués contre une stack Mongo/API démarrée.

## Corrections appliquées

- RBAC trajectoire Architecture : les écritures exigent désormais `architecture.manage`; `portfolio.view` reste lecture seule.
- `SimpleCrud` : suppression de l'autorisation générique par rôle `PMO_USER`; toute écriture nécessite une permission métier explicite.
- Référentiels Architecture : `architecture.manage`.
- Référentiels Sécurité : `security.manage`.
- Applications / Run / Objectifs : contrôles d'écriture basés sur `applications.manage`, `run.manage`, `objectives.manage`.
- Jalons : création/édition par permissions explicites; attribut critical/strategic protégé par `milestones.set_attribute`.
- Dépendances : écritures protégées par `dependencies.create` au lieu du rôle global.
- Participatory budgeting : permission `pb.manage` ajoutée aux écritures.
- Chiffrement connecteurs : `ENCRYPTION_KEY` invalide/absente provoque un fail-fast en production; fallback uniquement hors production.
- JWT/permission version : fail-closed (HTTP 503) si la vérification de révocation en base est indisponible.
- MFA : ticket ramené à 5 minutes, `jti` one-shot côté base, maximum 5 essais par challenge, rate-limit HTTP, backup codes renforcés à 128 bits.
- OIDC : signature RS256 validée à partir du JWKS du fournisseur; `kid` vérifié; nonce obligatoire.
- SSO : `PUBLIC_BASE_URL` obligatoire en production.
- Mongo : authentification root activée dans Docker Compose et URI backend authentifiée.
- Endpoint `/demands/seed` : réservé à `admin.config`.
- Formulaire public : rate-limit + échappement HTML des données injectées dans les notifications email.
- `SimpleCrud.update` : lecture de retour maintient explicitement le filtre `tenant_id`.

## Vérifications effectuées

- `python -m compileall -q backend` : PASS.
- `python scripts/test_hardening_v2_static.py` : PASS.
- Tests pytest existants : non exécutables complètement dans cet environnement sans stack API/Mongo. `test_jwt_security.py` contient en outre un chemin `/app/backend` codé en dur; les tests HTTP attendent une API déjà démarrée.

## Points à rejouer avant fermeture du gate

1. Démarrer la stack avec des secrets Mongo/JWT/chiffrement réels et `MARCEL_ENV=production`.
2. Rejouer la matrice RBAC complète, particulièrement Viewer, Architecte, Sécurité, PMO et Chef de Projet.
3. Rejouer cross-tenant/IDOR sur toutes les routes de mutation.
4. Tester le challenge MFA : expiration, 5 erreurs, replay après succès, backup code one-shot.
5. Tester OIDC Google/Entra avec rotation de `kid` et tokens invalides.
6. Rejouer SSRF/DNS rebinding et tests de connecteurs.
7. Rejouer les tests de charge/rate-limit du formulaire public.

## Remarque

Deux contrôles par rôle subsistent dans `timesheets/service.py`. Ils sont liés à la logique métier de vue PMO/validation et non au CRUD DSI générique. Ils doivent néanmoins être couverts explicitement par les tests RBAC de workflow avant validation finale.
