# Audit de complétude fonctionnelle MARCEL — Juin 2026

Posture : directeur du pilotage stratégique DSI. Base : inventaire code exhaustif (40 modules backend, ~180 endpoints, 32 pages) + navigation des 36 écrans.

## Verdict
~85 % de couverture d'un PPM d'entreprise. Cœur métier fort (arbitrage, portefeuille, ressources, SAFe, reporting). 3 trous bloquants exploitation réelle + 2 manques stratégiques.

## P0 — Bloquants exploitation réelle
1. Cycle de vie utilisateur : PAS de création d'utilisateur via app/API (seed uniquement — profiles/router.py n'a que GET/PATCH /admin/users, le PATCH ne change que profile_id). Pas de désactivation, pas de changement/reset mot de passe (grep négatif sur tout le backend), pas de page « Mon compte », pas de 2FA.
2. Audit trail : aucun module (grep "audit" négatif). Exigence conformité DSI.
3. Emails réels : RESEND_API_KEY absente preview + prod → aucune alerte/relance ne part. Pas de relance automatique timesheets retardataires.

## P1 — Manques métier pilotage stratégique
4. Bénéfices/business case : aucun suivi attendu vs réalisé, ROI post-projet.
5. Planification pluriannuelle : pas d'exercices fiscaux, pas de forecast mensualisé, pas de plan N+1/N+2. Budget = CAPEX/OPEX + révisions seulement.
6. Objectifs stratégiques : scoring alignement existe (arbitrage w1=20 %) mais pas de référentiel d'objectifs DSI ; OKRs confinés au module SAFe (OKRDashboard monté uniquement dans TrainsSafe.jsx).
7. Instances de gouvernance : pas de gestion COPIL/comités (agenda, ODJ, relevés rattachés).
8. Dépendances inter-projets : backend complet (modules/project_dependencies, 5 endpoints CRUD) mais AUCUNE UI frontend (grep négatif). Quick win.

## P2 — Maturité
9. Documents/pièces jointes projets : rien. Commentaires/collaboration : rien. Fil d'activité : rien.
10. 2FA, politique mot de passe.
11. Compétences/skills matching ressources.
12. Diffusion planifiée des rapports (hebdo email).
13. Connecteurs Jira/SAP/ServiceNow/Azure DevOps mockés (sync non réels).
14. Workflow demande de ressource (affectation → validation manager).
15. Baselines multiples formalisées (seuls les snapshots scope existent).

## Points forts confirmés (au niveau ou au-dessus du marché)
- Arbitrage : scoring 6 critères pondérés, enveloppes, simulateur, scénarios + comparaison.
- SAFe : trains/PIs/sprints/capabilities/WSJF.
- Reporting : PDF COMEX, PPT COPIL brandé tenant, Excel 9 sections, Power BI 6 endpoints + template ZIP.
- Ressources : contrats + alertes expiration (cron 06:00 UTC), heatmap capacité, congés.
- Multi-tenant, SSO (Google/Entra/SAML), profils/permissions granulaires.
- Météo projet + rapports flash (status_report, intégré ProjectDetail).
