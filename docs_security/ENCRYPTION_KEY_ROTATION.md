# Rotation de la clé ENCRYPTION_KEY (credentials connecteurs)

`ENCRYPTION_KEY` (base64 URL-safe, 32 octets — format Fernet) chiffre les credentials
des connecteurs (Jira/SAP/ServiceNow) stockés dans `connector_configs.auth_credentials_enc`.
Elle vit uniquement dans le `.env` du serveur (jamais dans le repo).

## Quand tourner la clé
- Suspicion de compromission du serveur ou d'un backup non chiffré
- Départ d'une personne ayant eu accès au `.env`
- Politique périodique (recommandé : 12 mois)

## Procédure (sans casser les connecteurs existants)

1. **Backup préalable** : `marcel-backup`
2. **Générer la nouvelle clé** (sur le VPS) :
   ```bash
   python3 -c "import base64, os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
   ```
3. **Sauvegarder l'ancienne clé** en lieu sûr le temps de la rotation
   (elle reste nécessaire pour déchiffrer l'existant).
4. **Mettre la NOUVELLE clé** dans `/opt/marcel/.env` (`ENCRYPTION_KEY=...`).
5. **Redémarrer le backend** : `cd /opt/marcel && docker compose up -d backend`
6. **Ré-chiffrer l'existant** avec le script de rotation :
   ```bash
   cd /opt/marcel
   docker compose exec -e OLD_ENCRYPTION_KEY='<ANCIENNE_CLE>' -T backend \
     python /app/scripts/rotate_encryption_key.py
   ```
   Sortie attendue : `Rotation terminée: N ré-chiffré(s), 0 échec(s)`.
7. **Valider** : ouvrir Admin → Connecteurs et lancer un « test de connexion »
   sur chaque connecteur actif (les credentials doivent se déchiffrer).
8. **Détruire l'ancienne clé** une fois la validation faite.

## Notes
- Le script est idempotent : relançable sans risque (les documents déjà chiffrés
  avec la nouvelle clé sont ignorés).
- En cas d'échec partiel (`N échec(s)`), NE PAS détruire l'ancienne clé :
  les documents en échec sont probablement chiffrés avec une clé antérieure —
  relancer avec cette clé dans `OLD_ENCRYPTION_KEY`.
- La clé de chiffrement des BACKUPS est distincte : `/opt/marcel/secrets/backup.key`
  (voir `scripts/backup.sh`). Sa rotation n'affecte que les backups futurs.
