# CSV Import — constantes et schémas

IMPORT_TEMPLATES = {
    "projects": {
        "fields": ["name", "methodology", "status_rag", "budget_total", "budget_consumed",
                   "budget_forecast", "jh_planned", "jh_consumed", "start_date",
                   "end_date_baseline", "end_date_forecast", "program_name", "source_id"],
        "required": ["name", "methodology", "status_rag", "budget_total", "budget_forecast",
                     "jh_planned", "start_date", "end_date_baseline", "end_date_forecast"],
        "sample": [["Projet Alpha", "waterfall", "green", "500000", "200000", "480000", "1000", "400",
                    "2025-01-01", "2025-12-31", "2025-12-31", "Mon Programme", "PRJ-001"]],
    },
    "tasks": {
        "fields": ["project_name", "name", "type", "status", "date_start_planned",
                   "date_end_planned", "date_start_actual", "date_end_actual",
                   "budget_planned_k", "budget_consumed_k", "jh_planned", "jh_consumed",
                   "resource_name"],
        "required": ["project_name", "name", "type"],
        "sample": [["Projet Alpha", "Cadrage stratégique", "tâche", "in_progress",
                    "2025-01-01", "2025-03-31", "2025-01-15", "", "100", "40", "200", "80", "Alice Dupont"]],
    },
    "resources": {
        "fields": ["name", "role", "capacity_jh_month", "tjm_eur", "availability_rate", "team", "team_id", "email"],
        "required": ["name", "role"],
        "sample": [["Alice Dupont", "Chef de projet", "15", "Équipe Digital", "alice@altair.fr"]],
    },
}

FIELD_ALIASES: dict = {
    "projects": {
        "name": ["name", "nom", "projet", "project", "titre", "title"],
        "methodology": ["methodology", "méthodologie", "methodo", "method", "methodologie"],
        "status_rag": ["status_rag", "rag", "statut_rag", "statut", "status"],
        "budget_total": ["budget_total", "budget", "montant_total", "cout_total", "cout"],
        "budget_consumed": ["budget_consumed", "consomme", "depense", "budget_consomme"],
        "budget_forecast": ["budget_forecast", "forecast", "eac", "estimation"],
        "jh_planned": ["jh_planned", "jh_prevus", "charge_prevue", "jh", "hommes_jours"],
        "jh_consumed": ["jh_consumed", "jh_consommes", "charge_reelle"],
        "start_date": ["start_date", "date_debut", "debut", "date_start"],
        "end_date_baseline": ["end_date_baseline", "date_fin_baseline", "fin_baseline", "baseline"],
        "end_date_forecast": ["end_date_forecast", "date_fin", "fin_prevue", "fin"],
        "program_name": ["program_name", "programme", "program"],
        "source_id": ["source_id", "id", "reference", "ref", "identifiant"],
    },
    "tasks": {
        "project_name": ["project_name", "projet", "project", "nom_projet"],
        "name": ["name", "nom", "titre", "tache", "task"],
        "type": ["type", "type_tache", "categorie"],
        "status": ["status", "statut", "etat"],
        "date_start_planned": ["date_start_planned", "debut_prevu", "date_debut"],
        "date_end_planned": ["date_end_planned", "fin_prevue", "date_fin"],
        "date_start_actual": ["date_start_actual", "debut_reel"],
        "date_end_actual": ["date_end_actual", "fin_reelle"],
        "budget_planned_k": ["budget_planned_k", "budget_prevu", "budget_k", "budget"],
        "budget_consumed_k": ["budget_consumed_k", "budget_consomme", "consomme_k"],
        "jh_planned": ["jh_planned", "jh_prevus", "jours_hommes"],
        "jh_consumed": ["jh_consumed", "jh_consommes"],
        "resource_name": ["resource_name", "responsable", "ressource", "owner"],
    },
    "resources": {
        "name": ["name", "nom", "prenom_nom"],
        "role": ["role", "poste", "fonction", "titre"],
        "capacity_jh_month": ["capacity_jh_month", "capacite", "dispo", "jh_mois"],
        "tjm_eur": ["tjm_eur", "tjm", "taux_journalier", "daily_rate"],
        "availability_rate": ["availability_rate", "taux_dispo", "disponibilite", "dispo_pct"],
        "team_id": ["team_id"],
        "team": ["team", "equipe", "departement", "service"],
        "email": ["email", "mail", "adresse_email"],
    },
}

VALID_VALUES = {
    "projects": {
        "methodology": ["waterfall", "agile", "safe"],
        "status_rag": ["green", "orange", "red"],
    },
    "tasks": {
        "type": ["tâche", "feature", "epic", "user_story"],
        "status": ["not_started", "in_progress", "completed", "delayed", "cancelled"],
    },
}
