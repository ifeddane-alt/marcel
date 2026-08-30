# MARCEL — Enterprise readiness & scale (diagnostic 2026-06, read-only)

Base : commit c0e0417 (prod=GitHub). ~55 modules backend, 400+ endpoints. Aucun code modifié.

## Scores
- Intégrations / API : 45/100
- Reporting avancé : 60/100
- Internationalisation : 25/100
- Provisioning entreprise (SSO/SCIM) : 50/100
- Préparation commerciale : 55/100

## Verdict : READY TO SELL, NOT YET TO SCALE

---

## Axe 1 — API / Intégrations (45/100)
Existe : 3 connecteurs réels Jira/SAP/ServiceNow (config, mapping, test durci SSRF, sync, remote-projects, status, logs) ; feed BI PowerBI (X-API-Key par tenant, 6 endpoints read : projects/resources/timesheets/budget/risks/milestones) ; webhooks sortants par tenant (SSRF-guardés) ; imports/exports fichiers (Excel, CSV, MS Project) ; isolation tenant systématique ; OpenAPI /docs /redoc exposés (mais internes).
Partiel : webhooks (1 URL/tenant, events limités) ; clé API tenant existe mais PowerBI-only.
Manque : programme d'API publique (tokens par tenant + scopes), versioning /v1, rate-limit par tenant/clé (aujourd'hui slowapi par IP, login only), audit d'usage API, doc contractuelle client, connecteurs finance/RH/ITSM génériques.
MVP proposé : généraliser le pattern X-API-Key → tokens tenant scoped (read/write par domaine), préfixe /api/v1, rate-limit par clé, audit_logs, OpenAPI publié + webhooks sortants multi-events. Endpoints prioritaires : projects, programs, portfolio, budgets, milestones, risks, dependencies, resources/capacity, decisions, applications, incidents/run (les read existent déjà → exposer en lecture d'abord).
Effort : L · Impact : FORT · Dépend : rien de bloquant · Risque : sécurité (scoping tokens) → réutiliser RBAC existant.

## Axe 2 — Reporting (60/100)
Existe : dashboards riches ; exports PPTX (COPIL, roadmap, engagement, event, PB), Excel, PDF ; vues sauvegardées par page (viewsAPI save/list/apply filtres) ; snapshots portefeuille (archivage/versioning KPI) ; seuils d'indicateurs configurables (admin) ; status reports projet.
Manque (enterprise) : report BUILDER (choix champs/regroupements/tris/KPI custom cross-entités), planification + abonnement email, diffusion selon profil, droits d'accès par rapport, archivage de versions de rapports arbitraires, modèles de rapports partagés.
MVP proposé : builder PMO simple = source (projets/portefeuille/programme) → champs → filtres (réutiliser SavedViews) → regroupement/tri → KPI → rendu tableau/graphe → export Excel/PDF/PPTX → planif (APScheduler déjà présent) + envoi email (core/email.py) + droits par profil. Pas de clone Power BI.
Effort : M/L · Impact : FORT (PMO = acheteur clé) · Dépend : APScheduler, email (Resend à configurer).

## Axe 3 — Internationalisation (25/100)
Existe : i18next + react-i18next + language detector ; en.json/fr.json (216 clés miroir) ; ~nav/commons traduits.
Réalité : 1 seule page utilise t() ; 47/47 pages en français en dur ; 71/194 messages backend HTTPException en FR ; emails/exports/statuts/référentiels/onboarding FR.
Couverture EN réelle estimée : ~15-20 %.
Effort couverture exploitable : L (externaliser ~milliers de chaînes sur 47 pages + messages backend + emails + exports + statuts + référentiels).
Impact : FORT pour groupes internationaux, NUL pour cibles FR/EU francophones. → à lancer seulement si un deal international l'exige.

## Axe 4 — Provisioning entreprise / SSO (50/100)
Existe : SSO OIDC (Google, Entra) + SAML 2.0 SP-initiated par tenant (nonce/state, vérif signature, metadata, ACS, anti-replay) ; JIT auto-provisioning (flag auto_provision + default_profile_id, fallback domaine) ; admin user CRUD (POST/PATCH /admin/users, reset-password) ; RBAC profils riches.
Manque : SCIM 2.0 (provisioning/deprovisioning automatisé), mapping groupes IdP (Entra/Google) → profils MARCEL, UI self-service de config SSO pour l'admin tenant, test de connexion SSO + logs d'erreur lisibles, deprovisioning à la révocation IdP.
Verdict besoin : SSO + JIT = suffisant pour la plupart. SCIM/mapping groupes = requis seulement pour GRANDS COMPTES (>500 users, gouvernance IAM stricte). → « utile plus tard / requis certains grands comptes ».
Effort : SCIM = L, mapping groupes = M, UI config SSO + test = M · Impact : MOYEN (fort sur grands comptes).

## Axe 5 — Préparation commerciale (55/100)
Produit réellement différenciant : vision DSI 360° (build + run + architecture d'entreprise + budget pluriannuel + gouvernance + conformité + Agent IA PMO) — rare en un seul outil.
Personas : CIO/DSI, PMO/Portfolio Manager, Chef de projet (+ Architecte SI et Responsable Run comme personas secondaires réels vu les modules).
Table stakes (présents) : portefeuille, projets, budgets, jalons, risques, dépendances, roadmap, gouvernance, RBAC, SSO, exports.
Différenciateurs : Run/exploitation intégré, Architecture d'entreprise (flux/standards/dette/radar), Agent IA PMO, budget participatif SAFe, contrôles qualité de données proactifs, exports COMEX/COPIL natifs.
Ne pas promettre aujourd'hui : API publique complète, EN complet, SCIM, mobile natif, marketplace d'intégrations.
Manque : éditions/packaging, modèle de prix justifié, argumentaire valeur/objections, battlecards concurrents.

### Packaging proposé (à valider)
- Édition unique « MARCEL DSI » + packs modules optionnels (Run, Architecture, SAFe/Budget participatif, Conformité, Connecteurs+API).
- Base tenant (plateforme + sécurité + SSO) + prix par utilisateur ÉDITEUR (CIO/PMO/CP), lecteurs (viewers) inclus ou à faible coût.
- Critères de tarification : nb utilisateurs éditeurs (principal), packs modules, volume projets (palier), connecteurs/API (pack), abonnement annuel.
- Positionnement : entre les outils légers (Monday/Smartsheet, per-seat bas) et les suites lourdes (Planview/Clarity/ServiceNow SPM, 5-6 chiffres/an). MARCEL = challenger EU/français, time-to-value rapide, tout-en-un. Jira Align = Agile-at-scale profond (MARCEL plus léger côté agile, plus large côté DSI). → prix indicatif à valider par des entretiens de découverte, pas fixé arbitrairement.

## Roadmap 3 vagues
- **Vague 1 (indispensable)** : API publique MVP en lecture (tokens tenant scoped + /v1 + rate-limit + audit + OpenAPI client) sur endpoints prioritaires ; UI self-service config SSO + test connexion ; packaging & argumentaire commercial.
- **Vague 2 (amélioration forte)** : Reporting builder PMO + planification/abonnement email ; API en écriture (projets/risques/jalons) + webhooks multi-events ; mapping groupes IdP → profils.
- **Vague 3 (grands comptes / international)** : SCIM 2.0 (provisioning/deprovisioning) ; internationalisation EN complète (front + back + exports + emails) ; connecteurs additionnels (ITSM/finance/RH génériques) / marketplace.

## TOP 5 prochains chantiers
1. API publique MVP lecture (tokens scoped + /v1 + rate-limit + OpenAPI). FORT.
2. Packaging & pricing justifiés + argumentaire/objections. FORT.
3. UI self-service SSO (config + test + logs) pour admin tenant. MOYEN/FORT.
4. Reporting builder PMO + envoi planifié. FORT.
5. Mapping groupes IdP → profils (pré-SCIM). MOYEN.

## TOP 5 à NE PAS faire maintenant
1. SCIM 2.0 complet (attendre un grand compte qui l'exige).
2. Internationalisation EN complète (attendre un deal international).
3. Marketplace d'intégrations / dizaines de connecteurs.
4. Clone Power BI / moteur BI générique.
5. Mobile natif / refonte responsive lourde.
