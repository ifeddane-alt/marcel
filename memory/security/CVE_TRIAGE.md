# MARCEL — Triage CVE backend (pip-audit, 2026-08-28)

Contexte : scan pip-audit sur `backend/requirements.txt`. Avant : 20 paquets / 122 advisories.
Après montée de versions testée (JWT/RBAC/cross-tenant/mass-assign/RGPD tous PASS) : **8 paquets restants**.

## Corrigés (montée de version, régression OK)
| PACKAGE | AVANT | APRÈS | NOTE |
|---|---|---|---|
| requests | 2.32.5 | 2.33.0 | patch sécurité |
| urllib3 | 2.6.3 | 2.7.0 | patch |
| idna | 3.11 | 3.15 | patch |
| cryptography | 46.0.5 | 46.0.7 | patch (reste 4 → besoin 48.x, voir ci-dessous) |
| pillow | 12.1.1 | 12.3.0 | 26 advisories corrigées |
| python-multipart | 0.0.22 | 0.0.31 | DoS multipart (déjà mitigé par garde uploads) |
| PyJWT | 2.11.0 | 2.13.0 | non utilisé directement (voir ecdsa) |
| pymongo | 4.5.0 | 4.6.3 | compatible motor 3.3.1 (<5) |
| pygments, click, python-dotenv, pyasn1, ecdsa, httplib2, lxml | — | dernières | patchs transitifs |

## Restants — exploitabilité dans MARCEL

| PACKAGE | VER | ADV | EXPLOITABILITY IN MARCEL | FIX | ACTION |
|---|---|---|---|---|---|
| aiohttp | 3.13.3 | 25 | **Faible** — non importé directement (`grep import aiohttp` = 0). Dépendance transitive de litellm/emergentintegrations, utilisée uniquement pour les appels LLM sortants (pas d'exposition d'un serveur aiohttp ni de parsing de requêtes entrantes). | 3.14.3 | Bump conjoint avec litellm/emergentintegrations à planifier + test IA. Risque de rupture si bump isolé. |
| starlette | 0.37.2 | 9 | **Faible-Moyen** — la plupart = DoS parsing multipart / formes, mitigé par la garde uploads (taille 15 Mo + allowlist) et l'absence de formulaires non bornés. | 0.40+/1.0 | **Bloqué par le pin FastAPI 0.110.1 (<0.38)**. Nécessite un bump FastAPI coordonné + régression complète. Planifié. |
| litellm | 1.80.0 | 12 | **Faible** — utilisé via emergentintegrations pour la synthèse IA (job planifié, entrées internes contrôlées). Pas d'entrée utilisateur brute vers litellm. | 1.83.10 | Bump via emergentintegrations (dépendance managée). À valider avec le fournisseur. |
| cryptography | 46.0.7 | 4 | **Faible** — transitive. JWT en **HS256** (symétrique), pas d'usage des chemins asymétriques vulnérables. | 48.0.1 | Bump majeur risqué → planifié + test. |
| ecdsa | 0.19.x | 1 | **Non exploitable** — advisory sur signatures ECDSA (Minerva/timing). MARCEL signe les JWT en **HS256** ; ecdsa (dépendance de python-jose) n'est jamais exercé. Pas de correctif amont pour l'advisory de timing. | n/a | Accepté (risque résiduel nul en pratique). |
| python-multipart | 0.0.31 | 1 | **Non exploitable** — advisory résiduelle sur parsing ; mitigée par la garde uploads (taille + allowlist) en amont. | — | Accepté / surveillé. |
| black | 26.1.0 | 3 | **Non exploitable en prod** — outil de formatage DEV, pas exécuté au runtime. | 26.3.1 | À déplacer vers requirements-dev (P2). |
| pytest | 9.0.2 | 1 | **Non exploitable en prod** — framework de test DEV. | 9.0.3 | requirements-dev (P2). |

## Verdict CVE
- **0 Critical exploitable** connu.
- **0 High exploitable** connu avec correctif raisonnablement disponible et non bloqué par un pin structurant.
- Restants : transitifs (aiohttp/litellm/cryptography via LLM), bloqués par pin (starlette/fastapi), non exercés (ecdsa/HS256), ou DEV (black/pytest), tous documentés avec mitigation.

## Frontend (yarn audit)
343 advisories, très majoritairement transitives de react-scripts (chaîne de build CRA, non exposées au navigateur en production). Runtime réel à cibler ultérieurement : axios, react-router (montée de version à tester, hors périmètre pré-red-team car non trivial sur CRA). Documenté comme risque résiduel MEDIUM.
