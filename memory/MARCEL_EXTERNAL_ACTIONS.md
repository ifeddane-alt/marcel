# MARCEL — Actions externes requises (hors périmètre agent : coût / credentials / infra / juridique)

Ces éléments ne peuvent PAS être réalisés en autonomie (nécessitent un achat, des credentials,
une action infra risquée pour les données, ou une décision juridique). Le code applicatif qui peut
les exploiter est déjà en place et gated par configuration.

## 1. Backups off-site (Object Storage) — HIGH
- **État** : le code d'upload off-site est implémenté dans `scripts/backup.sh` (chiffrement AES-256 AVANT upload,
  vérification de présence, statut consigné). Il s'active dès que la configuration est fournie. Actuellement inactif.
- **Action requise (utilisateur)** :
  1. Créer un bucket privé S3-compatible (ex. Scaleway Object Storage, région fr-par — reste en UE).
  2. Générer une paire de clés API (accès restreint au bucket).
  3. Renseigner dans `/opt/marcel/.env` : `S3_BACKUP_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
     et `S3_ENDPOINT_URL=https://s3.fr-par.scw.cloud` (pour Scaleway).
  4. Installer l'AWS CLI sur le VPS : `apt-get install -y awscli` (ou `pip install awscli`).
  5. Vérifier le bucket : accès public **désactivé**, versioning activé, règle de rétention (ex. 30–90 j).
  6. La clé de chiffrement des backups (`/opt/marcel/secrets/backup.key`) doit être sauvegardée **séparément**
     du bucket (coffre/here gestionnaire de secrets), sinon la restauration serait impossible en cas de perte du VPS.
- **Coût** : quelques € / mois (non engagé sans validation).

## 2. Chiffrement MongoDB at-rest — HIGH
- **État** : NON actif. VPS Scaleway, FS root ext4 **sans LUKS**, volume Docker `marcel_mongo_data`
  sur le FS clair. MongoDB Community (mongo:7) → pas de chiffrement natif (réservé à l'édition Enterprise).
  Compensation en place : les **backups sont chiffrés** (AES-256), donc le vol d'une sauvegarde est couvert.
  Le vol des fichiers de données vivants resterait exploitable.
- **Action requise (infra, à froid, avec sauvegarde préalable)** — au choix :
  - (a) Provisionner un **volume Scaleway chiffré** et y migrer `/var/lib/docker/volumes/marcel_mongo_data`
        (arrêt propre + rsync + remontage). Migration à risque → fenêtre de maintenance + backup vérifié avant.
  - (b) Mettre en place **LUKS** sur un volume dédié monté sous `/var/lib/docker/volumes`.
  - (c) Migrer vers **MongoDB Atlas** (chiffrement at-rest géré, région UE) — implique coût + revue transferts.
- **Ne pas exécuter en autonomie** : risque de perte de données.

## 3. SPOF / DR (résilience) — HIGH
- **État** : VPS unique + MongoDB single-node = point de défaillance unique. Pas de DR externe.
  En place : sauvegarde chiffrée quotidienne + test de restauration hebdomadaire + swap + watchdog réseau.
- **Action requise (infra + décision)** :
  - Définir RPO/RTO cibles.
  - Option réplication : replica set MongoDB (≥3 nœuds) ou Atlas.
  - Restauration hors-site testée périodiquement (dépend du point 1).
  - Documenter PRA/PCA.

## 4. Sentry / alerting externe (monitoring) — MEDIUM
- **État** : hooks Sentry déjà câblés (init si `SENTRY_DSN`). Monitoring local disponible via
  `GET /api/admin/monitoring` (DB, disque, âge du dernier backup + alerte, erreurs, scheduler).
- **Action requise** : renseigner `SENTRY_DSN` (compte Sentry) pour l'alerting externe ; brancher une sonde
  externe (UptimeRobot/Healthchecks) sur `/api/health` et sur l'âge du backup.

## 5. Rotation des credentials de démo — MEDIUM
- Les mots de passe des comptes existants (altair/betacorp) étaient historiquement publics.
  L'agent ne les change pas (risque de lockout). **Action utilisateur** : changer via l'app.

## 6. DPA / transferts hors UE (juridique) — HIGH (RGPD)
- Les données projet peuvent transiter par des LLM (OpenAI/Anthropic/Google, US) via emergentintegrations.
- **Action requise** : DPA sous-traitants, registre des traitements, décision transferts hors UE ou option UE-only,
  avis DPO/juridique. Le socle technique RGPD (export / anonymisation / suppression tenant) est implémenté côté app.

## 7. Purge de l'historique Git (secrets anciens) — LOW/MEDIUM
- L'historique Git contient d'anciens secrets (JWT déjà rotaté, mots de passe démo, token GitHub expiré).
- **Action requise (coordonnée, destructive)** : `git filter-repo`/BFG + rotation de tout secret encore valide,
  après sauvegarde et coordination. Non exécuté en autonomie.
