# MARCEL — Audit produit (marcel-ppm.com, commit c0e0417)

Perspective : CIO/DSI · Head of PMO · Portfolio Manager · Sécu/Exploitation · Acheteur PPM.
Méthode : parcours écran par écran sur prod (données réelles : 350 projets, 13 programmes, ~4 300 tâches). Read-only, aucun code modifié.

## Scores
- Produit global : 76/100
- UX : 77/100
- Couverture PPM : 86/100
- Niveau entreprise : 70/100
- Exploitabilité : 82/100
- **Verdict : SELLABLE WITH GAPS**

## Modules audités
Home, Dashboard, Portfolio, Arbitrage, ProjectDetail, Roadmap, Budget, Capacité, Gouvernance, Run, Architecture, Admin config, mobile.

## Top 10 priorités
1. Responsive/mobile (Important, L)
2. Complétude i18n EN (Important, M)
3. Self-service SSO/SCIM provisioning entreprise (Important, L)
4. Reporting/BI builder + rapports planifiés (Important, L)
5. Accessibilité WCAG AA (Important, M/L)
6. Ouverture API publique + webhooks documentés (Important, M)
7. Multi-devise + types de coûts/refacturation (Important, M)
8. Cohérence libellés statuts + glyphes (Mineur, S)
9. Persistance onboarding + empty states premium (Mineur, S/M)
10. Page statut/SLA + dashboard ops in-app (Important, M)

## Top 10 forces
1. Couverture PPM très large (portefeuille→projet→tâches→jalons→dépendances)
2. Module Run/Exploitation intégré (différenciateur vs PPM pur)
3. Module Architecture d'entreprise (flux, standards, dette, radar) — différenciateur
4. Arbitrage multi-critères + what-if + scénarios versionnés
5. Budget CAPEX/OPEX/EAC/RAF + pluriannuel + reforecast
6. Gouvernance : COPIL, registre décisions, sanity checks
7. Agent IA PMO contextuel + rapports IA
8. Qualité données proactive (divergence chiffres, scope non qualifié)
9. Exports natifs COMEX/COPIL PPTX/Excel/PDF
10. Sécurité/exploitation : RBAC fin, SSO/MFA, audit, Mongo auth, backups, CI, alerting (Red Team PASS)

Rapport complet dans l'historique de conversation.
