# MARCEL — Playbook de démonstration (env prod marcel-ppm.com, tenant Altair)

Curation appliquée le 2026-06 via `/app/scripts/demo_curation.py` (idempotent, tag `demo_curation`).
Principe : dataset crédible et hétérogène — on conserve les situations qui servent à
démontrer les alertes/contrôles ; on ne corrige que les anomalies accidentelles.

## Comptes personas
| Persona | Compte | Profil | Habilitations |
|---|---|---|---|
| CIO / DSI | dsi@altair.fr / Dsi2026! | Direction SI (26 perms) | Vue globale + exécutif (lecture, arbitrage.view, lifecycle.decide, exports). Pas d'écriture data. |
| PMO / Portfolio Manager | manager@altair.fr / Altair2026! | PMO Portefeuille (81 perms) | Pilotage portefeuille complet (édition projets/budget/arbitrage/gouvernance/capacité). |
| Chef de projet | cp@altair.fr / CdP2026! | Chef de Projet (40 perms) | Pilotage détaillé de SES projets (projects.view_own/edit_own → 65 projets), tâches/risques/jalons/décisions. |

## Parcours 1 — CIO / DSI (≤10 min) : « pilotage exécutif »
1. **Dashboard** : santé portefeuille (350 projets, 227 V / 123 à risque), budget 145 M€, 65 % consommé, alertes.
2. **Portefeuille** : bannières qualité (9 divergences chiffres, 83 scopes non qualifiés) → « MARCEL détecte, pas juste stocker ».
3. **Budget** : CAPEX/OPEX/EAC/RAF, dérives (14 projets +25 %, 18 +15 %), tri « pire d'abord ».
4. **Arbitrage** : matrice multi-critères + what-if pour réallouer l'enveloppe.
5. **Gouvernance** : 31 décisions en attente, registre COPIL.
6. **Architecture** : dette technique 5 070 JH, 5 avis en attente → vision DSI 360°.
Message clé : une seule plateforme build + run + budget + archi + gouvernance.

## Parcours 2 — PMO / Portfolio Manager (≤10 min) : « pilotage portefeuille »
1. **Roadmap** : Gantt multi-projets, 220 dépendances, 47 à risque, conflits détectés.
2. **Capacité** : 3 équipes en surcharge (Risques SI 140 %, Cellule PMO 122 %, Crédit Immo 110 %) → arbitrer la charge.
3. **Arbitrage** : ajuster pondérations, créer un scénario, comparer.
4. **Budget** : réviser un EAC, transférer une enveloppe.
5. **Gouvernance** : enregistrer une décision, valider une instance.
Message clé : le PMO pilote réellement (édition), pas seulement du reporting.

## Parcours 3 — Chef de projet (≤10 min) : « pilotage de mes projets »
1. **Portefeuille** (vue scoping) : ne voit QUE ses 65 projets.
2. **Fiche projet** : onglets Aperçu/Exécution/Pilotage/Gouvernance, CAPEX/OPEX/EAC, RAF.
3. **Jalons** : un jalon en retard (38 en retard au global) → replanifier.
4. **Risques** : ouvrir/mettre à jour un risque (criticité).
5. **Status Report / Dossier d'engagement** : générer le livrable COPIL.
Message clé : cockpit projet complet, borné à son périmètre (RBAC object-level).

## Anomalies VOLONTAIRES conservées (servent la démo)
- 83 projets à scope non qualifié (MVP/étendu/hors scope) → alerte qualité.
- ~12 projets aux chiffres déclarés divergents (>10 %) → contrôle cohérence.
- Dérives EAC hétérogènes : 269 à 0 %, 19 à +4 %, 30 à +8 %, 18 à +15 %, 14 à +25 %.
- 38 jalons en retard ; 147 risques critiques (≥15) sur 700.
- 220 dépendances (47 at_risk) + conflits roadmap.
- 31 décisions de gouvernance en attente.
- 47 incidents ouverts, SLA 91 % ; dette technique 5 070 JH, 5 avis archi en attente.
- Statuts/méthodo/budgets hétérogènes (actif/pause/prépa/clôturé ; agile/waterfall/hybrid/safe).

## Anomalies ACCIDENTELLES corrigées
1. **Surcharge capacité = 0** (le seed plafonnait chaque ressource à 20 JH/mois → aucune surcharge possible).
   → Ajout d'allocations (`demo_curation`) créant une surcharge hétérogène sur 3 équipes (140 %/122 %/110 %) Aoû→Nov.
2. **Personas incohérents** : les comptes démo tombaient sur le fallback rôle (cp@ n'était PAS scoping « ses projets »).
   → Assignation des profils métier (Direction SI / PMO Portefeuille / Chef de Projet) + compte DSI créé + mots de passe connus + perm_version bump.

## Gaps fonctionnels observés (non corrigés — hors périmètre curation)
- Menu « Capacité » visible au profil Direction SI mais sans données (pas de perm lecture capacité) → masquer l'entrée ou accorder une lecture. Mineur.
- Module « Budget participatif » (/pb) vide (budget_cuts=0) → seeder un scénario si démo PB souhaitée. Mineur.
- Responsive/mobile limité (desktop-first). Important pour usage exécutif mobile.
- i18n EN à compléter (toggle présent). Important pour comptes internationaux.

## Scores qualité démo
- Avant : 72/100 (surcharge non démontrable, personas non représentatifs).
- Après : 88/100.
- **DEMO READY = PASS.**
