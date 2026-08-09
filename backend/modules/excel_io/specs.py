# Spécifications déclaratives export/import Excel par entité

RAG_LABELS = {"green": "Vert", "orange": "Orange", "red": "Rouge"}
METHO_LABELS = {"waterfall": "Waterfall", "agile": "Agile", "safe": "SAFe"}
URGENCY_LABELS = {"low": "Faible", "medium": "Moyenne", "high": "Haute", "critical": "Critique"}
DEMAND_STATUS_LABELS = {
    "nouvelle": "Nouvelle", "qualifiee": "Qualifiée", "priorisee": "Priorisée",
    "acceptee": "Acceptée", "refusee": "Refusée", "convertie": "Convertie",
}
RESOURCE_TYPE_LABELS = {
    "interne": "Interne", "externe_regie": "Externe régie", "externe_forfait": "Externe forfait",
}
MS_FAMILY_LABELS = {
    "epic_lifecycle": "Cycle de vie", "epic_milestone": "Jalon épic", "transversal": "Transversal",
}


def col(field, label, ctype="str", **kw):
    return {"field": field, "label": label, "type": ctype, **kw}


SPECS = {
    "projects": {
        "label": "Projets",
        "match": ["name"],
        "required_new": ["name", "start_date", "end_date_forecast"],
        "columns": [
            col("code", "Code", readonly=True),
            col("name", "Nom du projet"),
            col("methodology", "Méthodologie", "enum", options=METHO_LABELS),
            col("status_rag", "Statut RAG", "enum", options=RAG_LABELS, aliases={"amber": "orange"}),
            col("status", "Statut projet"),
            col("program_name", "Programme"),
            col("description", "Description"),
            col("budget_total", "Budget total (€)", "money"),
            col("budget_consumed", "Budget consommé (€)", "money"),
            col("budget_forecast", "Budget forecast (€)", "money"),
            col("jh_planned", "JH prévus", "number"),
            col("jh_consumed", "JH consommés", "number"),
            col("start_date", "Date début", "date"),
            col("end_date_baseline", "Fin baseline", "date"),
            col("end_date_forecast", "Fin prévue", "date"),
        ],
    },
    "programs": {
        "label": "Programmes",
        "match": ["name"],
        "required_new": ["name"],
        "columns": [
            col("name", "Nom du programme"),
            col("description", "Description"),
            col("owner", "Responsable"),
            col("start_date", "Date début", "date"),
            col("end_date", "Date fin", "date"),
            col("budget_keur", "Budget (k€)", "number"),
            col("status", "Statut"),
        ],
    },
    "teams": {
        "label": "Equipes",
        "match": ["name"],
        "required_new": ["name"],
        "columns": [
            col("name", "Nom de l'équipe"),
            col("manager_name", "Manager"),
            col("members_count", "Nb ressources", "int", readonly=True),
        ],
    },
    "resources": {
        "label": "Ressources",
        "match": ["name"],
        "required_new": ["name", "role"],
        "columns": [
            col("name", "Nom"),
            col("role", "Rôle"),
            col("team", "Équipe"),
            col("email", "Email"),
            col("capacity_jh_month", "Capacité (JH/mois)", "number"),
            col("tjm_eur", "TJM (€)", "money"),
            col("availability_rate", "Disponibilité (%)", "number"),
            col("resource_type", "Type", "enum", options=RESOURCE_TYPE_LABELS),
            col("vendor", "Fournisseur"),
            col("entry_date", "Date d'entrée", "date"),
            col("contract_ref", "Réf. contrat"),
            col("contract_start", "Début contrat", "date"),
            col("contract_end", "Expiration contrat", "date"),
        ],
    },
    "milestones": {
        "label": "Jalons",
        "match": ["project_name", "name"],
        "required_new": ["project_name", "name"],
        "columns": [
            col("project_name", "Projet"),
            col("name", "Jalon"),
            col("status", "Statut"),
            col("date_baseline", "Date baseline", "date"),
            col("date_forecast", "Date prévue", "date"),
            col("date_actual", "Date réelle", "date"),
            col("family", "Famille", "enum", options=MS_FAMILY_LABELS),
            col("type", "Type"),
            col("comment", "Commentaire"),
            col("is_blocking", "Bloquant", "bool"),
        ],
    },
    "risks": {
        "label": "Risques",
        "match": ["project_name", "title"],
        "required_new": ["project_name", "title"],
        "columns": [
            col("project_name", "Projet"),
            col("title", "Titre"),
            col("category", "Catégorie"),
            col("probability", "Probabilité (1-5)", "int"),
            col("impact", "Impact (1-5)", "int"),
            col("criticality", "Criticité", "int", readonly=True),
            col("status", "Statut"),
            col("mitigation_plan", "Plan de mitigation"),
            col("owner", "Responsable"),
            col("due_date", "Échéance", "date"),
            col("description", "Description"),
        ],
    },
    "decisions": {
        "label": "Decisions",
        "match": ["project_name", "title"],
        "required_new": ["project_name", "title"],
        "columns": [
            col("project_name", "Projet"),
            col("title", "Titre"),
            col("category", "Catégorie"),
            col("status", "Statut"),
            col("decision_date", "Date décision", "date"),
            col("due_date", "Échéance", "date"),
            col("owner", "Responsable"),
            col("impact", "Impact"),
            col("description", "Description"),
        ],
    },
    "demands": {
        "label": "Demandes",
        "match": ["title"],
        "required_new": ["title", "requester"],
        "columns": [
            col("title", "Titre"),
            col("description", "Description"),
            col("requester", "Demandeur"),
            col("requester_department", "Département"),
            col("business_value", "Valeur métier"),
            col("estimated_budget", "Budget estimé (€)", "money"),
            col("urgency", "Urgence", "enum", options=URGENCY_LABELS),
            col("status", "Statut", "enum", options=DEMAND_STATUS_LABELS),
        ],
    },
    "budget": {
        "label": "Budget",
        "match": ["name"],
        "required_new": ["name"],
        "update_only": True,
        "columns": [
            col("name", "Projet"),
            col("program_name", "Programme", readonly=True),
            col("capex_planned", "CAPEX prévu (€)", "money"),
            col("capex_consumed", "CAPEX consommé (€)", "money"),
            col("opex_planned", "OPEX prévu (€)", "money"),
            col("opex_consumed", "OPEX consommé (€)", "money"),
            col("eac", "EAC (€)", "money"),
            col("raf", "RAF (€)", "money", readonly=True),
            col("ecart_pct", "Écart (%)", "number", readonly=True),
        ],
    },
    "timesheets": {
        "label": "Timesheets",
        "match": ["resource_name", "task_name", "date"],
        "required_new": ["resource_name", "task_name", "date", "jh_value"],
        "columns": [
            col("resource_name", "Ressource"),
            col("project_name", "Projet", readonly=True),
            col("task_name", "Tâche"),
            col("date", "Date", "date"),
            col("jh_value", "JH", "number"),
            col("status", "Statut", readonly=True),
        ],
    },
}
