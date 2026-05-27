"""Données des templates projets (Waterfall, Agile, SAFe)."""

WATERFALL_TEMPLATE = {
    "name": "Waterfall",
    "methodology": "waterfall",
    "is_default": True,
    "phases": [
        {
            "name": "Cadrage",
            "order": 1,
            "duration_days_default": 30,
            "milestones": [
                {"name": "Kick-off", "family": "governance"},
                {"name": "Validation périmètre", "family": "governance"},
            ],
            "tasks": [
                {"name": "Étude de cadrage", "scope_status": "SEC"},
                {"name": "Rédaction CDC", "scope_status": "SEC"},
                {"name": "Analyse des risques initiaux", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Conception",
            "order": 2,
            "duration_days_default": 30,
            "milestones": [
                {"name": "Design Review", "family": "governance"},
                {"name": "Architecture validée", "family": "delivery"},
            ],
            "tasks": [
                {"name": "Design fonctionnel", "scope_status": "SEC"},
                {"name": "Design technique", "scope_status": "SEC"},
                {"name": "Revue architecture", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Développement",
            "order": 3,
            "duration_days_default": 60,
            "milestones": [
                {"name": "Code Freeze", "family": "delivery"},
                {"name": "SIT Start", "family": "delivery"},
            ],
            "tasks": [
                {"name": "Développement", "scope_status": "SEC"},
                {"name": "Tests unitaires", "scope_status": "SEC"},
                {"name": "Intégration", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Recette",
            "order": 4,
            "duration_days_default": 30,
            "milestones": [
                {"name": "UAT Start", "family": "governance"},
                {"name": "UAT Sign-off", "family": "governance", "attribute": "critical"},
            ],
            "tasks": [
                {"name": "Plan de recette", "scope_status": "SEC"},
                {"name": "Exécution recette", "scope_status": "SEC"},
                {"name": "Corrections", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Mise en production",
            "order": 5,
            "duration_days_default": 14,
            "milestones": [
                {"name": "Go/No-Go", "family": "governance", "attribute": "critical"},
                {"name": "Go-Live", "family": "delivery", "attribute": "critical"},
            ],
            "tasks": [
                {"name": "Plan de bascule", "scope_status": "SEC"},
                {"name": "Migration données", "scope_status": "SEC"},
                {"name": "Cutover", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Hypercare",
            "order": 6,
            "duration_days_default": 30,
            "milestones": [
                {"name": "Fin Hypercare", "family": "delivery"},
                {"name": "Clôture projet", "family": "governance"},
            ],
            "tasks": [
                {"name": "Support post-go-live", "scope_status": "SEC"},
                {"name": "Bilan projet", "scope_status": "SEC"},
            ],
        },
    ],
}

AGILE_TEMPLATE = {
    "name": "Agile",
    "methodology": "agile",
    "is_default": True,
    "phases": [
        {
            "name": "Discovery",
            "order": 1,
            "duration_days_default": 21,
            "milestones": [
                {"name": "Vision validée", "family": "governance"},
                {"name": "Backlog initial prêt", "family": "delivery"},
            ],
            "tasks": [
                {"name": "User Research", "scope_status": "SEC"},
                {"name": "Story Mapping", "scope_status": "SEC"},
                {"name": "MVP Definition", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Sprint 0",
            "order": 2,
            "duration_days_default": 14,
            "milestones": [
                {"name": "Environnement prêt", "family": "delivery"},
                {"name": "CI/CD opérationnel", "family": "delivery"},
            ],
            "tasks": [
                {"name": "Setup environnement", "scope_status": "SEC"},
                {"name": "Setup CI/CD", "scope_status": "SEC"},
                {"name": "Conventions équipe", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Delivery",
            "order": 3,
            "duration_days_default": 90,
            "milestones": [],
            "tasks": [],
        },
        {
            "name": "Release",
            "order": 4,
            "duration_days_default": 14,
            "milestones": [
                {"name": "Feature Freeze", "family": "delivery", "attribute": "critical"},
                {"name": "Go-Live", "family": "delivery", "attribute": "critical"},
            ],
            "tasks": [
                {"name": "Regression testing", "scope_status": "SEC"},
                {"name": "Documentation", "scope_status": "SEC"},
                {"name": "Formation utilisateurs", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Run",
            "order": 5,
            "duration_days_default": 30,
            "milestones": [
                {"name": "Fin stabilisation", "family": "delivery"},
                {"name": "Transfert Run", "family": "governance"},
            ],
            "tasks": [
                {"name": "Monitoring", "scope_status": "SEC"},
                {"name": "Support L2", "scope_status": "SEC"},
                {"name": "Rétrospective finale", "scope_status": "SEC"},
            ],
        },
    ],
}

SAFE_TEMPLATE = {
    "name": "SAFe",
    "methodology": "safe",
    "is_default": True,
    "phases": [
        {
            "name": "PI Planning",
            "order": 1,
            "duration_days_default": 14,
            "milestones": [
                {"name": "PI Objectives validés", "family": "governance", "attribute": "critical"},
                {"name": "Capacity confirmée", "family": "governance"},
            ],
            "tasks": [
                {"name": "Préparer PI Planning", "scope_status": "SEC"},
                {"name": "Identifier dépendances", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Execution",
            "order": 2,
            "duration_days_default": 100,
            "milestones": [],
            "tasks": [],
        },
        {
            "name": "System Demo",
            "order": 3,
            "duration_days_default": 7,
            "milestones": [
                {"name": "Demo System", "family": "governance"},
                {"name": "Inspect & Adapt", "family": "governance"},
            ],
            "tasks": [
                {"name": "Préparer la démo", "scope_status": "SEC"},
                {"name": "Collecter feedbacks", "scope_status": "SEC"},
            ],
        },
        {
            "name": "Release",
            "order": 4,
            "duration_days_default": 14,
            "milestones": [
                {"name": "Release Readiness", "family": "delivery", "attribute": "critical"},
                {"name": "Go-Live", "family": "delivery", "attribute": "critical"},
            ],
            "tasks": [
                {"name": "ART Sync", "scope_status": "SEC"},
                {"name": "Release validation", "scope_status": "SEC"},
            ],
        },
    ],
}

DEFAULT_TEMPLATES = [WATERFALL_TEMPLATE, AGILE_TEMPLATE, SAFE_TEMPLATE]
