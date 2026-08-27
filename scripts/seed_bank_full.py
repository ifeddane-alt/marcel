"""Seed MARCEL « full opérationnel » — univers Banque/Assurance.
100 applications, 13 programmes, 350 projets, ~5 500 tâches, adhérences, tous modules peuplés.
Purge les données métier du tenant Altair (préserve users/profils/référentiels/préférences).
Reproductible : random.seed(42). Usage : python seed_bank_full.py
"""
import os, sys, uuid, asyncio, random
from datetime import datetime, timezone, timedelta, date

sys.path.insert(0, "/app/backend")
try:
    from dotenv import load_dotenv
    load_dotenv("/app/backend/.env")
except Exception:
    pass
from motor.motor_asyncio import AsyncIOMotorClient

random.seed(42)
NOW = datetime.now(timezone.utc).isoformat()
TODAY = date.today()
uid = lambda: str(uuid.uuid4())
iso = lambda d: d.strftime("%Y-%m-%d")


def add_months(d, n):
    m = d.month - 1 + n
    return date(d.year + m // 12, m % 12 + 1, min(d.day, 28))


FIRST = ["Sophie", "Thomas", "Marie", "Nicolas", "Isabelle", "Julien", "Camille", "Antoine", "Claire", "Pierre",
         "Émilie", "Laurent", "Nathalie", "Olivier", "Caroline", "Vincent", "Aurélie", "Sébastien", "Hélène", "Franck",
         "Delphine", "Guillaume", "Sandrine", "Mathieu", "Valérie", "Alexandre", "Céline", "Stéphane", "Laura", "David",
         "Anne", "Romain", "Karine", "Fabien", "Elodie", "Christophe", "Manon", "Damien", "Audrey", "Benoît"]
LAST = ["Martin", "Dubois", "Leclerc", "Petit", "Bernard", "Girard", "Moreau", "Laurent", "Simon", "Michel",
        "Lefebvre", "Garcia", "Roux", "Fournier", "Morel", "André", "Mercier", "Blanc", "Guérin", "Boyer",
        "Chevalier", "Faure", "Gauthier", "Perrin", "Robin", "Clément", "Morin", "Nicolas", "Henry", "Rousseau",
        "Mathieu", "Gautier", "Masson", "Marchand", "Duval", "Denis", "Dumont", "Marie", "Lemaire", "Noël",
        "Meyer", "Dufour", "Meunier", "Brun", "Blanchard"]

ROLES = [("Développeur", 500, 700, 62), ("Tech Lead", 700, 850, 18), ("Business Analyst", 550, 750, 28),
         ("Product Owner", 650, 850, 22), ("Scrum Master", 600, 750, 12), ("Architecte SI", 850, 1100, 12),
         ("Chef de projet", 650, 900, 34), ("Testeur QA", 450, 600, 22), ("Data Engineer", 600, 800, 16),
         ("Ingénieur DevOps", 650, 850, 16), ("Expert Sécurité", 800, 1000, 8), ("UX Designer", 550, 700, 10)]

TEAM_NAMES = ["Squad Crédit Immo", "Squad Crédit Conso", "Squad Comptes & Dépôts", "Squad Épargne", "Squad Assurance Vie",
              "Squad IARD", "Squad Paiements SEPA", "Squad Monétique", "Squad Mobile Banking", "Squad Portail Web",
              "Squad CRM & Distribution", "Équipe Data Platform", "Équipe IA & Scoring", "Équipe Décisionnel",
              "Équipe Conformité SI", "Équipe LCB-FT", "Équipe Risques SI", "Équipe Core Banking",
              "Équipe Flux & Intégration", "Équipe Cloud & Infra", "Équipe Sécurité Opérationnelle", "Équipe Poste de travail",
              "Équipe API & Open Banking", "Équipe RH & Finance SI", "Cellule Architecture", "Cellule PMO",
              "Équipe Support N2", "Équipe Exploitation"]

# 13 programmes (name, description, budget_keur, nb_projets)
PROGRAMS = [
    ("Transformation Digitale & Distribution", "Refonte des parcours de vente et de la relation client omnicanale.", 28500, 45),
    ("Core Banking Modernisation", "Modernisation du système bancaire cœur : comptes, crédits, dépôts.", 32000, 40),
    ("Conformité Réglementaire & LCB-FT", "DORA, NIS2, MiCA, LCB-FT : mise en conformité du SI et des processus.", 18500, 38),
    ("Paiements & Monétique", "Instant payment, monétique, wallets et conformité DSP3.", 21000, 35),
    ("Data, IA & Décisionnel", "Plateforme data groupe, IA générative, scoring et pilotage.", 16500, 30),
    ("Cybersécurité & Résilience", "Renforcement cyber, IAM, résilience opérationnelle et PRA.", 12800, 28),
    ("Expérience Client & Mobile", "Applications mobiles, selfcare et signature électronique.", 14200, 26),
    ("Assurance Vie & Épargne", "Modernisation des chaînes vie, épargne retraite et PER.", 13500, 25),
    ("IARD & Indemnisation", "Refonte gestion des sinistres et tarification IARD.", 11000, 22),
    ("Cloud & Infrastructure", "Migration cloud, landing zones, FinOps et modern workplace.", 15500, 20),
    ("Open Banking & API", "APIsation du SI, portail développeurs et écosystème fintech.", 8200, 16),
    ("Fonctions Support (RH-Finance-Achats)", "Modernisation des SI RH, finance et achats du groupe.", 7400, 14),
    ("Obsolescence & Dette Technique", "Décommissionnement legacy et résorption de la dette.", 9800, 11),
]

PROJECT_BASES = {
    0: ["Refonte du portail conseiller NOVA", "Vente à distance crédit conso", "Parcours entrée en relation digitale",
        "Signature électronique généralisée", "CRM 360 conseiller", "Refonte site vitrine et prise de RDV",
        "Selfcare succession et clôtures", "Agrégation de comptes externes", "Pilotage commercial temps réel",
        "Refonte des éditions client", "Visio-conseiller banque privée", "Marketing automation & ciblage"],
    1: ["Migration core banking SAB vers Amplitude", "Refonte chaîne crédit immobilier", "Nouveau moteur de calcul d'intérêts",
        "Refonte tenue de compte entreprises", "Digitalisation des garanties et sûretés", "Refonte chaîne crédit consommation",
        "Modernisation moteur de frais et commissions", "Migration référentiel tiers unique", "Refonte des éditions réglementaires comptes",
        "Découplage core banking / distribution", "Gestion des successions automatisée", "Refonte prélèvements et mandats"],
    2: ["Programme conformité DORA", "Mise en conformité NIS2", "Refonte dispositif LCB-FT",
        "Filtrage sanctions temps réel", "KYC périodique automatisé", "Reporting réglementaire COREP/FINREP",
        "Conformité MiCA actifs numériques", "RGPD : purge et anonymisation", "Trajectoire résilience opérationnelle",
        "Registre des prestataires critiques", "Dispositif abus de marché MAR", "Refonte questionnaires MIF2"],
    3: ["Déploiement Instant Payment SEPA", "Migration monétique vers processeur cloud", "Refonte 3-D Secure v2.3",
        "Wallet mobile et paiement sans contact", "Refonte des automates bancaires", "Plateforme de paiements internationaux ISO 20022",
        "Request to Pay", "Tokenisation des cartes", "Refonte acquisition commerçants", "Lutte fraude paiements par IA",
        "Virements de masse entreprises", "Refonte back-office monétique"],
    4: ["Plateforme data groupe sur Snowflake", "Scoring crédit nouvelle génération", "IA générative service client",
        "Dataviz pilotage COMEX", "Référentiel données uniques (MDM)", "Moteur de recommandation produits",
        "Data quality et gouvernance", "Migration du décisionnel legacy", "Détection churn par ML",
        "Assistant IA conseiller", "Datamart risques BCBS239", "Catalogue de données d'entreprise"],
    5: ["Programme IAM groupe", "SOC nouvelle génération", "Refonte PRA/PCA", "Bastion d'administration",
        "Chiffrement des données sensibles", "Micro-segmentation réseau", "Gestion des vulnérabilités industrialisée",
        "MFA généralisé collaborateurs", "Sécurisation des API exposées", "Cyber-entraînement et purple team",
        "DLP données clients", "Sauvegarde immuable anti-ransomware"],
    6: ["Nouvelle app mobile particuliers", "App mobile pro & entreprises", "Notifications push transactionnelles",
        "Onboarding mobile 100% digital", "Chatbot service client", "Accessibilité RGAA des parcours",
        "Refonte espace client web", "Paiement mobile P2P", "Crédit express in-app", "Selfcare assurance mobile"],
    7: ["Refonte chaîne assurance vie", "Plateforme PER individuel", "Automatisation des rachats vie",
        "Refonte des arbitrages en ligne", "Migration portefeuille vie legacy", "Tarificateur épargne nouvelle génération",
        "Digitalisation des bénéficiaires", "Robo-advisor épargne", "Refonte éditique contrats vie", "Conformité DDA distribution"],
    8: ["Refonte gestion des sinistres auto", "Déclaration sinistre en ligne", "Expertise à distance par photo",
        "Tarification IARD dynamique", "Lutte fraude sinistres par IA", "Refonte contrats habitation",
        "Plateforme partenaires réparateurs", "Indemnisation instantanée", "Refonte back-office IARD"],
    9: ["Migration landing zone Azure", "FinOps et optimisation cloud", "Conteneurisation des applications",
        "Modern workplace et poste de travail", "Refonte du réseau agences SD-WAN", "Sortie du mainframe — étude et pilote",
        "Observabilité et supervision unifiée", "Automatisation infrastructure as code", "Migration datacenter secondaire"],
    10: ["API Platform groupe", "Portail développeurs externes", "Conformité DSP3 accès aux comptes",
         "Monétisation des API", "Partenariats fintech — intégration", "Event mesh & streaming temps réel",
         "Refonte gateway API", "Open insurance API"],
    11: ["Migration SIRH vers Workday", "Refonte SI achats et e-procurement", "Dématérialisation factures fournisseurs",
         "Consolidation financière groupe", "Refonte paie et GTA", "Pilotage budgétaire DSI (FinIT)"],
    12: ["Décommissionnement Siebel", "Migration Oracle 12c vers 19c", "Sortie de Java 8 — vague applicative",
         "Rationalisation des ETL legacy", "Décommissionnement GED historique", "Archivage légal du legacy",
         "Migration AIX vers Linux", "Réduction du parc serveurs Windows 2012"],
}
SUFFIXES = ["", "", "", "", " — Vague 2", " — Vague 3", " — Phase 2", " — Pilote", " — Généralisation",
            " — Banque Privée", " — Entreprises", " — Réseau Agences", " — Filiales Europe", " — MVP", " — Extension"]

APP_DOMAINS = [
    ("Core Banking", "critique", ["Sopra Banking", "Temenos", "Interne", "SAB"], ["Cobol / DB2", "Java / Oracle", "ABAP"], "on_premise"),
    ("Crédits", "critique", ["Interne", "Sopra Banking", "Tietoevry"], ["Java / Oracle", "Cobol / DB2"], "on_premise"),
    ("Paiements", "critique", ["Worldline", "ACI", "Interne"], ["Java / Kafka", "C++ / Oracle"], "on_premise"),
    ("Monétique", "critique", ["Worldline", "HPS PowerCARD", "Interne"], ["Java", "C / Tandem"], "hybride"),
    ("Épargne & Vie", "haute", ["Interne", "Sapiens", "Prima"], ["Java / Oracle", "Cobol / DB2"], "on_premise"),
    ("IARD & Sinistres", "haute", ["Guidewire", "Interne", "Sapiens"], ["Java / PostgreSQL", "Gosu"], "hybride"),
    ("Distribution & CRM", "haute", ["Salesforce", "Microsoft", "Interne"], ["Apex / Lightning", ".NET / Azure"], "saas"),
    ("Digital & Mobile", "haute", ["Interne", "Backbase"], ["React Native", "Kotlin / Swift", "React / Node"], "cloud_public"),
    ("Conformité & Risques", "haute", ["NICE Actimize", "Moody's", "Interne", "SAS"], ["Java", "SAS", "Python"], "on_premise"),
    ("Data & Décisionnel", "moyenne", ["Snowflake", "Microsoft", "Interne", "SAP"], ["SQL / Python", "PowerBI", "Informatica"], "cloud_public"),
    ("Fonctions Support", "moyenne", ["Workday", "SAP", "Coupa", "Interne"], ["SaaS", "ABAP"], "saas"),
    ("Infra & Sécurité", "haute", ["Microsoft", "CyberArk", "Splunk", "Interne"], ["SaaS", "Linux"], "hybride"),
]
APP_NAMES = {
    "Core Banking": ["Amplitude Core Banking", "SAB AT (legacy)", "Tenue de compte Entreprises KORDA", "Référentiel Tiers UNIK",
                     "Moteur Intérêts & Agios CALC", "Successions AUREA", "Éditions bancaires EDIT+", "Mandats & Prélèvements SEPA-M",
                     "Comptes sur Livret LIVRETIS", "Frais & Commissions FEEMAX"],
    "Crédits": ["Chaîne Crédit Immo CREDIMMO", "Crédit Conso FASTLOAN", "Garanties & Sûretés GARDIA", "Octroi Entreprises CREDPRO",
                "Recouvrement RECOV", "Scoring Octroi SCORINN", "Assurance Emprunteur ADE-Link", "Rachats de Crédits REGROUP"],
    "Paiements": ["Hub Paiements PAYHUB", "Instant Payment IPFAST", "Virements Internationaux SWIFTNET", "Flux ISO20022 GATEWAY",
                  "Anti-Fraude Paiements FRAUDSTOP", "Request to Pay R2P", "Virements de masse MASSPAY", "Chèques & Images CHQSCAN"],
    "Monétique": ["Autorisations Cartes AUTHX", "Gestion Cartes CARDMGR", "3-D Secure ACS", "Acquisition Commerçants ACQNET",
                  "Automates & GAB ATMNET", "Tokenisation TOKENV", "Litiges Cartes CHARGEBACK"],
    "Épargne & Vie": ["Chaîne Vie VITALIS", "PER & Retraite PERSPECTIV", "Arbitrages en ligne ARBITRA", "Tarificateur Épargne TARIFEP",
                      "Éditique Contrats CONTRATDOC", "Gestion Bénéficiaires BENEF+", "Robo-Advisor INVESTIA", "Épargne Salariale SALEP"],
    "IARD & Sinistres": ["Sinistres Auto SINAUTO", "Sinistres MRH SINHAB", "Tarification IARD PRICING-X", "Expertise Distance VISIOEXP",
                         "Partenaires Réparateurs REPARNET", "Contrats IARD POLIS", "Fraude Sinistres FRAUDCLAIM"],
    "Distribution & CRM": ["CRM Conseiller NOVA360", "Campagnes Marketing CAMPAIGN+", "Prise de RDV AGENDA-C", "Portail Conseiller PULSE",
                           "Base Prospection PROSPECTA", "Vente à Distance TELVENTE", "Siebel CRM (legacy)", "Réclamations Clients CLAIMDESK"],
    "Digital & Mobile": ["App Mobile Particuliers MOBI", "App Mobile Pro MOBIPRO", "Espace Client Web WEBSELF", "Onboarding Digital ONBOARD",
                         "Chatbot LISA", "Signature Électronique SIGN-IT", "Notifications Push PUSHER", "Agrégateur AGGREG8", "Simulateurs en ligne SIMULEO"],
    "Conformité & Risques": ["LCB-FT SENTINEL", "Filtrage Sanctions SCREENER", "KYC Périodique KYCLOOP", "Reporting COREP/FINREP REGREP",
                             "Risques de Crédit RISKAL", "BCBS239 Datamart RISKDATA", "Abus de Marché MARWATCH", "MIF2 Questionnaires PROFILR"],
    "Data & Décisionnel": ["Plateforme Data LAKEHOUSE", "Décisionnel Legacy DWH-FIN", "MDM Référentiels MASTERLINK", "Dataviz COMEX BOARDVIEW",
                           "Scoring ML SCOREFACT", "Data Quality DQCHECK", "Catalogue Données DATACAT", "Churn ML PREDICT-C", "Reporting ESG GREENDATA"],
    "Fonctions Support": ["SIRH Workday", "Paie & GTA PAYROLL+", "Achats e-Procurement COUPA", "Factures Fournisseurs INVOICE-D",
                          "Consolidation Groupe CONSO-G", "Pilotage Budgétaire DSI FINIT", "GED Groupe DOCBASE", "Notes de Frais EXPENSY"],
    "Infra & Sécurité": ["IAM Groupe IDENTIA", "Bastion ADMIN-VAULT", "SOC & SIEM SPLUNK-SEC", "Supervision OBSERVA",
                         "Sauvegardes BACKUPR", "MFA Collaborateurs AUTHENTIC", "Poste de Travail WORKPLACE", "API Gateway APIM",
                         "Portail Développeurs DEVPORTAL", "Streaming Événements EVENTMESH"],
}

TASK_TEMPLATES = {
    "cadrage": ["Cadrage fonctionnel", "Étude d'opportunité", "Business case et ROI", "Cartographie de l'existant", "Cadrage sécurité et conformité"],
    "conception": ["Spécifications fonctionnelles détaillées", "Architecture technique cible", "Dossier de conception", "Maquettes UX et parcours", "Modèle de données"],
    "realisation": ["Développement lot 1", "Développement lot 2", "Développement lot 3", "Intégration des flux", "Reprise de données",
                    "Développement des API", "Paramétrage progiciel", "Interfaces comptables", "Moteur de règles", "Batchs et traitements de masse"],
    "recette": ["Tests d'intégration SIT", "Recette métier UAT", "Tests de performance", "Homologation sécurité", "Tests de non-régression", "Recette comptable"],
    "deploiement": ["Préparation bascule et cut-over", "Formation des utilisateurs", "Déploiement pilote", "Généralisation réseau", "Conduite du changement", "Documentation d'exploitation", "VSR et stabilisation"],
}
MILESTONE_SETS = [("kick_off", "Kick-off projet"), ("general_design", "Dossier de conception validé"),
                  ("sit", "Fin des tests d'intégration"), ("uat", "Recette métier validée"),
                  ("go_live", "Mise en production"), ("roll_out", "Généralisation"), ("review", "Bilan de fin de projet")]
RISK_TITLES = ["Disponibilité des ressources métier insuffisante en recette", "Dépendance à l'éditeur sur les correctifs critiques",
               "Complexité de la reprise de données sous-estimée", "Adhérence forte avec le legacy non documentée",
               "Retard sur l'environnement de recette mutualisé", "Charge réglementaire concurrente sur les mêmes équipes",
               "Performance des traitements de masse non validée", "Risque de non-conformité à l'échéance réglementaire",
               "Turnover sur les compétences rares (Cobol, monétique)", "Retard fournisseur sur les développements spécifiques",
               "Sécurité : exposition d'API sensibles à durcir", "Budget de licences supérieur à l'estimation initiale"]
DIRECTIONS = ["Direction de la Distribution", "Direction des Risques", "Direction Financière", "Direction Conformité",
              "Direction Assurances", "Direction des Paiements", "Direction Digitale", "DSI", "Direction des Opérations", "DRH"]

PURGE_TENANT = ["projects", "programs", "tasks", "milestones", "risks", "resources", "teams", "work_allocations",
                "timesheets", "leaves", "applications", "app_interfaces", "incidents", "releases", "vulnerabilities",
                "compliance_requirements", "security_reviews", "architecture_standards", "architecture_exemptions",
                "architecture_reviews", "tech_radar", "tech_debt", "run_activities", "run_allocations",
                "project_dependencies", "lifecycle_gates", "decisions", "demands", "governance", "events",
                "budget_transfers", "portfolio_envelopes", "strategic_envelopes", "strategic_objectives",
                "strategic_themes", "trajectory_milestones", "trains", "pis", "sprints", "project_sprints",
                "pb_sessions", "pb_votes", "okrs", "capabilities", "budget_cuts", "cut_scenarios", "forecasts",
                "portfolio_snapshots", "phase_history", "scope_snapshots", "notifications", "gate_attestations",
                "ai_status_reports", "ai_portfolio_reports", "ai_insights", "project_weather_reports", "incidents"]


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    admin = await db.users.find_one({"email": "admin@altair.fr"}, {"tenant_id": 1})
    t = admin["tenant_id"]
    users = [u async for u in db.users.find({"tenant_id": t, "email": {"$regex": "altair"}}, {"user_id": 1, "name": 1, "email": 1})]
    owner_users = [u for u in users if u["email"] in ("admin@altair.fr", "pmo@altair.fr", "cp@altair.fr", "manager@altair.fr", "user@altair.fr")]

    print("Purge des données métier…")
    for c in set(PURGE_TENANT):
        await db[c].delete_many({"tenant_id": t})
    # allocations n'a pas de tenant_id → purge totale (mono-données démo)
    await db.allocations.delete_many({})

    # ── Équipes & ressources ─────────────────────────────────────────────
    teams = [{"team_id": uid(), "tenant_id": t, "name": n, "manager_resource_id": None,
              "train_id": None, "created_at": NOW} for n in TEAM_NAMES]
    role_pool = [r for r in ROLES for _ in range(r[3])]
    names = random.sample([f"{f} {l}" for f in FIRST for l in LAST], 260)
    resources = []
    for i, nm in enumerate(names):
        role, lo, hi, _ = role_pool[i % len(role_pool)]
        team = teams[i % len(teams)]
        resources.append({"resource_id": uid(), "tenant_id": t, "name": nm, "role": role,
                          "capacity_jh_month": random.choice([18, 19, 20, 20]), "team": team["name"],
                          "team_id": team["team_id"], "tjm_eur": random.randrange(lo, hi + 1, 25),
                          "availability_rate": random.choice([100, 100, 100, 80, 50]),
                          "skills": [], "validator_resource_id": None})
    for tm in teams:
        members = [r for r in resources if r["team_id"] == tm["team_id"]]
        tm["manager_resource_id"] = members[0]["resource_id"] if members else None
    await db.teams.insert_many(teams)
    await db.resources.insert_many(resources)
    cdps = [r for r in resources if r["role"] == "Chef de projet"] or resources[:20]
    archis = [r for r in resources if r["role"] == "Architecte SI"] or resources[:5]

    # ── 100 applications + interfaces ────────────────────────────────────
    apps, code_seq = [], {}
    domain_specs = {d[0]: d for d in APP_DOMAINS}
    for domain, app_names in APP_NAMES.items():
        _, crit_base, editors, technos, hosting = domain_specs[domain]
        for nm in app_names:
            legacy = "legacy" in nm.lower() or random.random() < 0.12
            crit = crit_base if random.random() < 0.6 else random.choice(["critique", "haute", "moyenne", "basse"])
            code_seq[domain] = code_seq.get(domain, 0) + 1
            prefix = "".join(w[0] for w in domain.split()[:2]).upper()
            comps = []
            if legacy or random.random() < 0.3:
                tech, ver, end = random.choice([("Java", "8", "2025-03-31"), ("Oracle Database", "12c", "2024-07-31"),
                                                ("Windows Server", "2012", "2023-10-10"), ("AIX", "7.1", "2026-04-30"),
                                                ("Cobol CICS", "5.x", "2027-12-31"), ("Angular", "11", "2024-05-31")])
                comps.append({"name": tech, "version": ver, "support_end": end})
            apps.append({"application_id": uid(), "tenant_id": t, "name": nm, "code": f"{prefix}-{code_seq[domain]:02d}",
                         "description": f"Application du domaine {domain}.",
                         "status": "decommissionnement" if legacy else "production",
                         "criticality": crit,
                         "time_rating": "eliminate" if legacy else random.choice(["invest", "invest", "tolerate", "migrate"]),
                         "editor": random.choice(editors), "technology": random.choice(technos), "hosting": hosting,
                         "data_sensitivity": random.choice(["reglementee", "confidentielle", "confidentielle", "interne"]),
                         "business_owner": random.choice(names), "it_owner": random.choice(names),
                         "users_count": random.choice([25, 60, 120, 300, 800, 1500, 3000, 4500]),
                         "tco_annual": random.randrange(40, 900) * 1000,
                         "business_capabilities": [domain], "components": comps, "project_ids": [],
                         "created_at": NOW, "updated_at": NOW})
    apps = apps[:100]
    await db.applications.insert_many(apps)
    ifaces = []
    for _ in range(160):
        s, tg = random.sample(apps, 2)
        ifaces.append({"interface_id": uid(), "tenant_id": t,
                       "name": f"Flux {s['code']} → {tg['code']}",
                       "source_application_id": s["application_id"], "target_application_id": tg["application_id"],
                       "protocol": random.choice(["API", "ETL", "Fichier", "MQ", "API", "ETL"]),
                       "frequency": random.choice(["temps_reel", "quotidien", "quotidien", "hebdomadaire", "mensuel"]),
                       "criticality": random.choice(["critique", "haute", "haute", "moyenne", "basse"]),
                       "data_desc": random.choice(["Référentiel clients", "Écritures comptables", "Positions et soldes",
                                                   "Événements de paiement", "Contrats", "Alertes conformité", "Données RH"]),
                       "created_at": NOW})
    await db.app_interfaces.insert_many(ifaces)

    # ── Programmes ───────────────────────────────────────────────────────
    programs = []
    for i, (nm, desc, keur, _) in enumerate(PROGRAMS):
        programs.append({"program_id": uid(), "tenant_id": t, "name": nm, "description": desc,
                         "owner": random.choice(names), "start_date": "2024-01-01", "end_date": "2027-12-31",
                         "budget_keur": keur, "status": "active"})
    await db.programs.insert_many(programs)

    # ── Objectifs stratégiques ───────────────────────────────────────────
    objectives = [
        ("Réduire le coût du run IT de 15 %", "Efficience des coûts", 15.0, 8.0, "%"),
        ("100 % des parcours clients clés digitalisés", "Expérience client", 100.0, 62.0, "%"),
        ("Conformité DORA totale avant l'échéance", "Conformité & résilience", 100.0, 71.0, "%"),
        ("Réduire le time-to-market des offres à 3 mois", "Agilité", 3.0, 5.2, "mois"),
        ("Décommissionner 25 applications legacy", "Dette technique", 25.0, 9.0, "apps"),
        ("70 % des workloads éligibles migrés en cloud", "Cloud", 70.0, 38.0, "%"),
        ("Zéro incident P1 de plus de 4 h", "Résilience", 0.0, 3.0, "incidents"),
        ("NPS digital supérieur à 40", "Expérience client", 40.0, 31.0, "pts"),
    ]
    obj_docs = [{"objective_id": uid(), "tenant_id": t, "title": ti, "description": "", "pillar": pi,
                 "horizon": "2026-2028", "owner": "DSI", "status": "actif", "created_at": NOW, "updated_at": NOW,
                 "target_baseline": 0.0, "target_current": cur, "target_history": [], "target_unit": u,
                 "target_value": tv} for ti, pi, tv, cur, u in objectives]
    await db.strategic_objectives.insert_many(obj_docs)

    # ── 350 projets + tâches + jalons + risques ──────────────────────────
    print("Génération des 350 projets…")
    projects, all_tasks, all_ms, all_risks, name_seen = [], [], [], [], set()
    proj_seq = 0
    for pi_idx, (pname, _, _, count) in enumerate(PROGRAMS):
        prog = programs[pi_idx]
        bases = PROJECT_BASES[pi_idx]
        for _ in range(count):
            proj_seq += 1
            base = random.choice(bases)
            name = base + random.choice(SUFFIXES)
            while name in name_seen:
                name = base + random.choice(SUFFIXES) or base + f" — Lot {random.randint(2, 9)}"
                if name in name_seen:
                    name = f"{base} — Lot {random.randint(2, 19)}"
            name_seen.add(name)
            r = random.random()
            status = "actif" if r < 0.54 else "en_preparation" if r < 0.67 else "en_pause" if r < 0.73 else "cloture"
            metho = random.choices(["agile", "waterfall", "hybrid", "safe"], [35, 30, 25, 10])[0]
            if status == "cloture":
                start = date(2024, random.randint(1, 12), random.randint(1, 28))
                end_b = add_months(start, random.randint(6, 18))
                end_f = add_months(end_b, random.choice([0, 0, 1, 2]))
                end_a = min(end_f, add_months(TODAY, -random.randint(1, 8)))
                phase, progress = "run", 1.0
            elif status == "en_preparation":
                start = add_months(TODAY, random.randint(0, 4))
                end_b = add_months(start, random.randint(6, 20))
                end_f, end_a, phase, progress = end_b, None, "cadrage", 0.0
            else:
                start = add_months(TODAY, -random.randint(3, 22))
                end_b = add_months(start, random.randint(8, 24))
                drift = random.choices([0, 0, 0, 1, 2, 3, 4, 6], [50, 18, 10, 9, 6, 4, 2, 1])[0]
                end_f = add_months(end_b, drift)
                end_a = None
                elapsed = (TODAY - start).days / max((end_f - start).days, 1)
                progress = min(max(elapsed * random.uniform(0.75, 1.05), 0.05), 0.92)
                phase = ("cadrage" if progress < 0.12 else "conception" if progress < 0.3 else
                         "realisation" if progress < 0.65 else "recette" if progress < 0.85 else "deploiement")
            cdp = random.choice(cdps)
            impacted = random.sample(apps, random.randint(1, 4))
            proj = {"project_id": uid(), "tenant_id": t, "code": f"P{pi_idx+1:02d}-{proj_seq:03d}",
                    "source_id": None, "source_tool": None, "name": name, "methodology": metho,
                    "status": status, "status_rag": "green", "rag_reasons": [],
                    "description": f"{base}. Projet du programme « {pname} » porté par la {random.choice(DIRECTIONS)}.",
                    "expected_result": random.choice(["Réduction des délais de traitement de 30 %.",
                                                      "Mise en conformité à l'échéance réglementaire.",
                                                      "Amélioration du NPS et des parcours clients.",
                                                      "Décommissionnement du composant legacy associé.",
                                                      "Réduction des coûts d'exploitation annuels.",
                                                      "Sécurisation d'un processus critique."]),
                    "benefits": "", "outcome": "", "income": None, "leading_indicators": [],
                    "direction": random.choice(DIRECTIONS), "program_id": prog["program_id"],
                    "lifecycle_phase": phase, "owner_id": random.choice(owner_users)["user_id"],
                    "metadata": {"chef_de_projet": cdp["name"]},
                    "start_date": iso(start), "end_date_baseline": iso(end_b), "end_date_forecast": iso(end_f),
                    "end_date_actual": iso(end_a) if end_a else None,
                    "strategic_alignment": random.randint(2, 5), "business_value": random.randint(2, 5),
                    "roi_estimated": random.randint(1, 5), "urgency": random.randint(1, 5),
                    "risk_score": random.randint(1, 5), "complexity": random.randint(1, 5),
                    "objective_ids": [random.choice(obj_docs)["objective_id"]] if random.random() < 0.6 else [],
                    "impacted_application_ids": [a["application_id"] for a in impacted],
                    "budget_revision_history": [], "jira_sync": False, "last_sync_at": None,
                    "created_at": NOW, "updated_at": NOW, "_progress": progress}
            for a in impacted:
                a["project_ids"].append(proj["project_id"])
            # Tâches
            n_tasks = random.randint(8, 22) if status == "actif" else random.randint(3, 8) if status == "en_preparation" else random.randint(6, 14)
            qualif_mode = random.choices(["full", "partial", "bad"], [58, 27, 15])[0]
            team_pool = random.sample(resources, min(random.randint(3, 8), len(resources)))
            phases_avail = ["cadrage", "conception", "realisation", "recette", "deploiement"]
            proj_tasks = []
            for ti_ in range(n_tasks):
                ph = phases_avail[min(int(ti_ / max(n_tasks, 1) * 5), 4)]
                tname = random.choice(TASK_TEMPLATES[ph])
                if any(x["name"] == tname for x in proj_tasks):
                    tname = f"{tname} — lot {random.randint(2, 6)}"
                frac = (ti_ + 0.5) / n_tasks
                jh_p = random.choice([10, 15, 20, 25, 30, 40, 50, 60, 80, 90])
                if status == "cloture" or frac < progress - 0.08:
                    tstat, cons = ("done", jh_p)
                elif frac < progress + 0.1:
                    tstat, cons = ("in_progress", round(jh_p * random.uniform(0.2, 0.8)))
                else:
                    tstat, cons = (random.choice(["todo", "not_started"]), 0)
                if status == "en_pause" and tstat == "in_progress" and random.random() < 0.5:
                    tstat = "delayed"
                rest = max(jh_p - cons, 0)
                if tstat == "in_progress" and random.random() < 0.3:
                    rest = round(rest * random.uniform(1.05, 1.4))  # ré-estimation à la hausse
                scope = None
                if tstat not in ("done",):
                    if qualif_mode == "full":
                        scope = random.choices(["sec", "etendu", "out"], [55, 38, 7])[0]
                    elif qualif_mode == "partial":
                        scope = random.choices(["sec", "etendu", None], [45, 35, 20])[0]
                    else:
                        scope = random.choices([None, "sec"], [80, 20])[0]
                ts = add_months(start, int((end_f or end_b) and ((add_months(end_f, 0) - start).days / 30) * (ti_ / max(n_tasks, 1))))
                te = add_months(ts, random.randint(1, 3))
                res = random.choice(team_pool)
                task = {"task_id": uid(), "tenant_id": t, "project_id": proj["project_id"], "name": tname,
                        "type": random.choices(["tâche", "feature", "user_story", "epic"], [55, 25, 15, 5])[0],
                        "status": tstat, "date_start_planned": iso(ts), "date_end_planned": iso(te),
                        "date_start_actual": iso(ts) if cons > 0 else None,
                        "date_end_actual": iso(te) if tstat == "done" else None,
                        "budget_planned_k": round(jh_p * res["tjm_eur"] / 1000),
                        "budget_consumed_k": round(cons * res["tjm_eur"] / 1000),
                        "budget_restant_estime": round(rest * res["tjm_eur"] / 1000),
                        "jh_planned": jh_p, "jh_consumed": cons, "jh_restants_estimes": rest,
                        "resource_id": res["resource_id"], "gantt_source": None, "phase_estimates": [],
                        "created_at": NOW}
                if scope:
                    task["scope_status"] = scope
                proj_tasks.append(task)
            all_tasks.extend(proj_tasks)
            # Agrégats projet cohérents avec les tâches (12 projets volontairement divergents)
            jh_p_sum = sum(x["jh_planned"] for x in proj_tasks)
            jh_c_sum = sum(x["jh_consumed"] for x in proj_tasks)
            tjm_moy = 640
            divergent = proj_seq % 30 == 0
            proj["jh_planned"] = round(jh_p_sum * (1.35 if divergent else 1.0))
            proj["jh_consumed"] = round(jh_c_sum * (1.25 if divergent else 1.0))
            budget = round(jh_p_sum * tjm_moy * random.uniform(1.1, 1.45), -3)
            consumed = round(budget * (jh_c_sum / max(jh_p_sum, 1)) * random.uniform(0.9, 1.05), -3)
            over = random.choices([1.0, 1.0, 1.0, 1.04, 1.08, 1.15, 1.25], [55, 12, 10, 8, 7, 5, 3])[0]
            eac = round(budget * over, -3)
            capex_share = random.uniform(0.3, 0.6)
            proj.update({"budget_total": budget, "budget_consumed": min(consumed, eac),
                         "budget_forecast": eac, "eac": eac,
                         "capex_planned": round(budget * capex_share, -3),
                         "capex_consumed": round(min(consumed, eac) * capex_share, -3),
                         "opex_planned": round(budget * (1 - capex_share), -3),
                         "opex_consumed": round(min(consumed, eac) * (1 - capex_share), -3)})
            # Jalons
            n_ms = random.randint(4, 7)
            late_target = random.choices([0, 0, 0, 1, 2, 3], [65, 15, 8, 7, 3, 2])[0] if status == "actif" else 0
            span = max(((end_f or end_b) - start).days, 60)
            for mi, (mtype, mlabel) in enumerate(MILESTONE_SETS[:n_ms]):
                md = start + timedelta(days=int(span * (mi + 1) / (n_ms + 1)))
                passed = md < TODAY
                is_late = passed and late_target > 0 and mi >= n_ms - 3
                if is_late:
                    late_target -= 1
                mstatus = "achieved" if (passed and not is_late) or status == "cloture" else "pending"
                all_ms.append({"milestone_id": uid(), "project_id": proj["project_id"], "tenant_id": t,
                               "name": mlabel, "date_baseline": iso(md),
                               "date_forecast": iso(md if not is_late else md + timedelta(days=random.randint(10, 60))),
                               "date_actual": iso(md) if mstatus == "achieved" else None,
                               "status": mstatus, "is_governance": mtype in ("go_live", "general_design"),
                               "family": "delivery", "type": mtype, "attribute": None,
                               "comment": "", "owner_resource_id": cdp["resource_id"],
                               "deliverable": mlabel, "is_blocking": mtype == "go_live"})
            # Risques
            for _ in range(random.choices([0, 1, 2, 3, 4, 6], [15, 25, 25, 18, 12, 5])[0]):
                prob, imp = random.randint(1, 5), random.randint(1, 5)
                if status != "actif":
                    rstat = "clos"
                else:
                    rstat = random.choices(["identifié", "en cours", "mitigé", "clos"], [35, 25, 25, 15])[0]
                all_risks.append({"risk_id": uid(), "tenant_id": t, "project_id": proj["project_id"],
                                  "title": random.choice(RISK_TITLES),
                                  "description": "", "category": random.choice(["technique", "planning", "budget", "rh", "réglementaire", "fournisseur"]),
                                  "probability": prob, "impact": imp, "criticality": prob * imp,
                                  "status": rstat, "mitigation_plan": "Plan d'action suivi en COPIL projet.",
                                  "owner": cdp["name"], "due_date": iso(add_months(TODAY, random.randint(1, 6))),
                                  "created_at": NOW})
            projects.append(proj)
    for p in projects:
        p.pop("_progress", None)
    await db.projects.insert_many(projects)
    await db.tasks.insert_many(all_tasks)
    await db.milestones.insert_many(all_ms)
    await db.risks.insert_many(all_risks)
    await db.applications.delete_many({"tenant_id": t})  # ré-insert avec project_ids peuplés
    await db.applications.insert_many(apps)
    active = [p for p in projects if p["status"] == "actif"]

    # ── Adhérences : dépendances inter-projets ───────────────────────────
    deps, seen_pairs = [], set()
    for _ in range(220):
        s, tg = random.sample(projects, 2)
        if (s["project_id"], tg["project_id"]) in seen_pairs:
            continue
        seen_pairs.add((s["project_id"], tg["project_id"]))
        deps.append({"dependency_id": uid(), "tenant_id": t,
                     "source_project_id": s["project_id"], "target_project_id": tg["project_id"],
                     "source_milestone_id": None, "target_milestone_id": None,
                     "nature": random.choice(["technical", "functional", "resource", "regulatory"]),
                     "direction": "outbound",
                     "description": f"« {s['name'][:48]} » dépend d'un livrable de « {tg['name'][:48]} ».",
                     "target_date": iso(add_months(TODAY, random.randint(-2, 8))),
                     "status": random.choice(["identified", "in_progress", "in_progress", "resolved", "at_risk"]),
                     "impact": random.choice(["critical", "high", "high", "medium", "low"]),
                     "created_by": "seed", "created_at": NOW})
    await db.project_dependencies.insert_many(deps)

    # ── Allocations mensuelles (capacité) ────────────────────────────────
    print("Allocations & feuilles de temps…")
    allocs, res_month_load = [], {}
    months_2026 = [date(2026, m, 1) for m in range(1, 13)]
    for p in active:
        ptasks = [x for x in all_tasks if x["project_id"] == p["project_id"]]
        rids = list({x["resource_id"] for x in ptasks})[:6]
        p_start = datetime.strptime(p["start_date"], "%Y-%m-%d").date()
        p_end = datetime.strptime(p["end_date_forecast"], "%Y-%m-%d").date()
        for rid in rids:
            for m in months_2026:
                if not (p_start <= add_months(m, 1) and m <= p_end) or random.random() < 0.35:
                    continue
                key = (rid, iso(m))
                cap = 20
                used = res_month_load.get(key, 0)
                if used >= cap - 1:
                    continue
                jh = min(random.choice([3, 5, 8, 10, 12]), cap - used)
                res_month_load[key] = used + jh
                allocs.append({"allocation_id": uid(), "project_id": p["project_id"], "resource_id": rid,
                               "period_month": iso(m), "jh_allocated": jh,
                               "jh_consumed": jh if m < date(TODAY.year, TODAY.month, 1) else round(jh * random.uniform(0, 0.6)),
                               "allocation_rate": min(round((used + jh) / cap * 100), 100)})
    await db.allocations.insert_many(allocs)

    # work_allocations + timesheets sur 30 projets récents
    was, tss = [], []
    for p in random.sample(active, 30):
        ptasks = [x for x in all_tasks if x["project_id"] == p["project_id"] and x["jh_consumed"] > 0][:4]
        for task in ptasks:
            wa = {"work_allocation_id": uid(), "tenant_id": t, "task_id": task["task_id"],
                  "resource_id": task["resource_id"], "phase": "realisation",
                  "planned_md": float(task["jh_planned"]), "consumed_md": float(task["jh_consumed"]), "created_at": NOW}
            was.append(wa)
            for _ in range(random.randint(3, 8)):
                d = TODAY - timedelta(days=random.randint(5, 120))
                if d.weekday() >= 5:
                    d -= timedelta(days=2)
                tss.append({"timesheet_id": uid(), "tenant_id": t, "resource_id": task["resource_id"],
                            "work_allocation_id": wa["work_allocation_id"], "date": iso(d),
                            "jh_value": random.choice([0.5, 1.0, 1.0, 2.0]), "status": "validated", "accounted": True,
                            "submitted_at": NOW, "validated_at": NOW, "validated_by": None,
                            "rejection_reason": None, "created_at": NOW})
    await db.work_allocations.insert_many(was)
    await db.timesheets.insert_many(tss)
    leaves = [{"leave_id": uid(), "tenant_id": t, "resource_id": random.choice(resources)["resource_id"],
               "date": iso(date(2026, random.choice([2, 5, 7, 8, 8, 12]), random.randint(1, 28))),
               "value": random.choice([0.5, 1.0, 1.0]), "created_at": NOW, "created_by": admin.get("user_id"),
               "updated_at": NOW} for _ in range(180)]
    await db.leaves.insert_many(leaves)

    # ── Run / Sécurité / Architecture ────────────────────────────────────
    print("Run, sécurité, architecture…")
    crit_apps = [a for a in apps if a["criticality"] in ("critique", "haute")]
    act_types = ["mco", "support", "supervision", "maintenance_evolutive", "patching", "sauvegardes"]
    acts = []
    for a in random.sample(crit_apps, min(50, len(crit_apps))):
        ba = random.randrange(60, 500) * 1000
        acts.append({"activity_id": uid(), "tenant_id": t, "name": f"{random.choice(['MCO', 'Support N2/N3', 'Maintenance évolutive'])} {a['name'].split()[0]}",
                     "type": random.choice(act_types), "application_id": a["application_id"],
                     "team_id": random.choice(teams)["team_id"], "owner": "", "description": "",
                     "recurrence": "continue", "status": "active", "budget_annual": ba,
                     "budget_consumed": round(ba * random.uniform(0.4, 0.75), -3), "created_at": NOW, "updated_at": NOW})
    for nm, ty in [("Patching & sécurité des socles", "patching"), ("Sauvegardes & PRA", "sauvegardes"),
                   ("Supervision & astreintes infra", "supervision")]:
        acts.append({"activity_id": uid(), "tenant_id": t, "name": nm, "type": ty, "application_id": None,
                     "team_id": random.choice(teams)["team_id"], "owner": "", "description": "", "recurrence": "continue",
                     "status": "active", "budget_annual": 150000, "budget_consumed": 82000, "created_at": NOW, "updated_at": NOW})
    await db.run_activities.insert_many(acts)
    ras = [{"run_allocation_id": uid(), "tenant_id": t, "activity_id": a["activity_id"],
            "resource_id": random.choice(resources)["resource_id"], "month": iso(date(2026, m, 1)),
            "days_allocated": random.randint(2, 8)} for a in random.sample(acts, 30) for m in range(5, 10)]
    await db.run_allocations.insert_many(ras)

    incidents = []
    for _ in range(260):
        a = random.choice(crit_apps if random.random() < 0.7 else apps)
        sev = random.choices(["P1", "P2", "P3", "P4"], [8, 22, 45, 25])[0]
        sla = {"P1": 4, "P2": 8, "P3": 24, "P4": 72}[sev]
        opened = datetime.now(timezone.utc) - timedelta(days=random.randint(0, 365), hours=random.randint(0, 23))
        resolved = random.random() < 0.85
        rt = opened + timedelta(hours=random.uniform(0.5, sla * (1.6 if random.random() < 0.25 else 0.9)))
        incidents.append({"incident_id": uid(), "tenant_id": t,
                          "title": f"{random.choice(['Indisponibilité', 'Lenteurs', 'Erreurs en série', 'Batch en échec', 'Flux bloqué', 'Anomalie de données'])} — {a['name']}",
                          "application_id": a["application_id"], "severity": sev,
                          "status": "resolu" if resolved else random.choice(["ouvert", "en_cours"]),
                          "opened_at": opened.isoformat(), "resolved_at": rt.isoformat() if resolved else None,
                          "sla_target_hours": sla, "description": "", "created_at": NOW})
    await db.incidents.insert_many(incidents)
    rels = [{"release_id": uid(), "tenant_id": t, "name": f"MEP {random.choice(apps)['name'].split()[0]} v{random.randint(1, 6)}.{random.randint(0, 9)}",
             "date": iso(TODAY + timedelta(days=random.randint(-90, 120))), "end_date": None, "type": "mep",
             "status": "planifiee", "application_id": random.choice(apps)["application_id"],
             "project_id": random.choice(projects)["project_id"], "created_at": NOW} for _ in range(60)]
    rels.append({"release_id": uid(), "tenant_id": t, "name": "Gel de fin d'année (freeze)", "date": "2026-12-15",
                 "end_date": "2027-01-05", "type": "gel", "status": "planifiee", "application_id": None,
                 "project_id": None, "created_at": NOW})
    await db.releases.insert_many(rels)
    vulns = [{"vuln_id": uid(), "tenant_id": t,
              "title": random.choice(["CVE critique non patchée", "Injection SQL détectée en pentest", "Certificats TLS expirés",
                                      "Comptes génériques partagés", "Version obsolète sans correctifs", "Secrets en clair dans les scripts",
                                      "Droits excessifs sur partages", "Headers de sécurité manquants"]) + f" — {random.choice(apps)['name'].split()[0]}",
              "application_id": random.choice(apps)["application_id"],
              "severity": random.choices(["critique", "haute", "moyenne", "basse"], [12, 30, 38, 20])[0],
              "source": random.choice(["scan", "pentest", "audit", "bug_bounty"]),
              "status": random.choices(["ouverte", "en_remediation", "corrigee", "acceptee"], [30, 30, 30, 10])[0],
              "discovered_at": iso(TODAY - timedelta(days=random.randint(5, 300))),
              "due_date": iso(TODAY + timedelta(days=random.randint(10, 120))), "description": "", "created_at": NOW}
             for _ in range(90)]
    await db.vulnerabilities.insert_many(vulns)
    frameworks = [("DORA", ["Art. 5", "Art. 6", "Art. 11", "Art. 17", "Art. 28"]), ("NIS2", ["Art. 20", "Art. 21", "Art. 23"]),
                  ("RGPD", ["Art. 30", "Art. 32", "Art. 33"]), ("ISO27001", ["A.5", "A.8", "A.12"]),
                  ("LCB-FT", ["Ord. 2020", "Lignes directrices ACPR"]), ("DSP3", ["RTS SCA"])]
    reqs = [{"req_id": uid(), "tenant_id": t, "framework": fw, "ref": ref,
             "title": f"Exigence {fw} {ref}", "status": random.choices(["conforme", "partiel", "non_conforme"], [45, 38, 17])[0],
             "application_id": random.choice(apps)["application_id"] if random.random() < 0.5 else None,
             "action_plan": "", "due_date": iso(TODAY + timedelta(days=random.randint(30, 400))), "owner": "", "created_at": NOW}
            for fw, refs in frameworks for ref in refs]
    await db.compliance_requirements.insert_many(reqs)
    sec_rev = [{"review_id": uid(), "tenant_id": t, "project_id": p["project_id"],
                "status": random.choices(["favorable", "favorable_reserves", "en_attente", "defavorable"], [40, 30, 25, 5])[0],
                "reviewer": "RSSI", "review_date": iso(TODAY - timedelta(days=random.randint(5, 200))),
                "comments": "", "created_at": NOW} for p in random.sample(active, 35)]
    await db.security_reviews.insert_many(sec_rev)
    stds = [("API-first pour toute nouvelle interface", "integration"), ("Chiffrement AES-256 des données au repos", "securite"),
            ("SSO obligatoire via l'IdP groupe", "securite"), ("Infrastructure as Code", "infra"),
            ("Revue de code obligatoire", "dev"), ("Conteneurisation des nouveaux services", "infra"),
            ("Journalisation centralisée SIEM", "securite"), ("Données personnelles pseudonymisées hors prod", "data"),
            ("Pas de nouveau développement Cobol", "dev"), ("Résilience multi-AZ pour les apps critiques", "infra"),
            ("Documentation OpenAPI systématique", "integration"), ("Scan de vulnérabilités en CI/CD", "securite")]
    std_docs = [{"standard_id": uid(), "tenant_id": t, "title": ti, "category": c,
                 "description": f"Standard d'architecture groupe : {ti.lower()}.", "status": "actif", "created_at": NOW}
                for ti, c in stds]
    await db.architecture_standards.insert_many(std_docs)
    await db.architecture_exemptions.insert_many([
        {"exemption_id": uid(), "tenant_id": t, "standard_id": random.choice(std_docs)["standard_id"],
         "scope_label": random.choice(apps)["name"], "justification": "Application en décommissionnement — investissement non justifié.",
         "expiry": iso(TODAY + timedelta(days=random.randint(90, 500))), "status": "active", "created_at": NOW} for _ in range(6)])
    arch_rev = [{"review_id": uid(), "tenant_id": t, "project_id": p["project_id"],
                 "status": random.choices(["favorable", "favorable_reserves", "en_attente"], [45, 30, 25])[0],
                 "reviewer": random.choice(archis)["name"], "review_date": iso(TODAY - timedelta(days=random.randint(5, 200))),
                 "comments": "", "created_at": NOW} for p in random.sample(active, 40)]
    await db.architecture_reviews.insert_many(arch_rev)
    radar = [("Kubernetes", "adopt", "plateformes"), ("Terraform", "adopt", "outils"), ("React", "adopt", "langages"),
             ("Kafka", "adopt", "plateformes"), ("Snowflake", "adopt", "plateformes"), ("OpenAPI 3.1", "adopt", "techniques"),
             ("LLM / IA générative", "trial", "techniques"), ("FinOps", "trial", "techniques"), ("Rust", "assess", "langages"),
             ("Service mesh", "assess", "plateformes"), ("DuckDB", "assess", "outils"), ("Platform engineering", "trial", "techniques"),
             ("Angular", "hold", "langages"), ("Cobol (nouveaux dev)", "hold", "langages"), ("ETL propriétaires legacy", "hold", "outils"),
             ("Serveurs physiques dédiés", "hold", "plateformes")]
    await db.tech_radar.insert_many([{"item_id": uid(), "tenant_id": t, "techno": te, "ring": r, "category": c,
                                      "note": "", "created_at": NOW} for te, r, c in radar])
    debts = [{"debt_id": uid(), "tenant_id": t,
              "description": random.choice(["Migration Oracle 12c → 19c", "Sortie Java 8 → 17", "Refonte des batchs Cobol",
                                            "Documentation des interfaces legacy", "Suppression comptes techniques partagés",
                                            "Montée de version middleware", "Refonte module non maintenable",
                                            "Remplacement ETL propriétaire", "Migration Windows Server 2012"]) + f" — {a['name'].split()[0]}",
              "application_id": a["application_id"], "effort_jh": random.choice([10, 20, 40, 60, 90, 120, 200]),
              "priority": random.choices(["haute", "moyenne", "basse"], [35, 45, 20])[0],
              "status": random.choices(["identifiee", "planifiee", "en_cours", "traitee"], [40, 30, 15, 15])[0],
              "created_at": NOW} for a in random.sample(apps, 70)]
    await db.tech_debt.insert_many(debts)

    # ── Gouvernance : comités, gates, décisions, demandes, événements ────
    print("Gouvernance…")
    govs = []
    for m in range(1, 13):
        govs.append({"governance_id": uid(), "tenant_id": t, "name": f"COPIL Portefeuille — {date(2026, m, 1).strftime('%B %Y').capitalize()}",
                     "type": "copil", "date_scheduled": f"2026-{m:02d}-15T14:00:00Z",
                     "projects_scope": [p["project_id"] for p in random.sample(active, 8)],
                     "sanity_check_status": "passed", "sanity_check_report": {"checks": []},
                     "status": "tenu" if date(2026, m, 15) < TODAY else "planifie"})
    for q, m in [("T1", 3), ("T2", 6), ("T3", 9), ("T4", 12)]:
        govs.append({"governance_id": uid(), "tenant_id": t, "name": f"Comité d'investissement {q} 2026",
                     "type": "comite_investissement", "date_scheduled": f"2026-{m:02d}-05T09:00:00Z",
                     "projects_scope": [], "sanity_check_status": "passed", "sanity_check_report": {"checks": []},
                     "status": "tenu" if date(2026, m, 5) < TODAY else "planifie"})
    await db.governance.insert_many(govs)
    PH = ["cadrage", "conception", "realisation", "recette", "deploiement", "run"]
    gates = []
    for p in random.sample(active, 90):
        idx = PH.index(p["lifecycle_phase"])
        if idx == 0:
            continue
        frm = PH[idx - 1]
        gstat = random.choices(["go", "go", "go", "conditional", "pending"], [50, 15, 10, 15, 10])[0]
        gates.append({"gate_id": uid(), "tenant_id": t, "project_id": p["project_id"], "project_name": p["name"],
                      "project_code": p["code"], "from_phase": frm, "to_phase": p["lifecycle_phase"],
                      "governance_id": random.choice(govs)["governance_id"], "agenda_item_id": None,
                      "target_date": iso(TODAY - timedelta(days=random.randint(10, 200))) if gstat != "pending" else iso(TODAY + timedelta(days=random.randint(5, 60))),
                      "status": gstat,
                      "deliverables": [{"key": "note_cadrage", "label": "Note de cadrage", "validator": "PMO",
                                        "provided": gstat != "pending", "reference": "",
                                        "review_status": "valide" if gstat != "pending" else "en_attente", "review_comment": ""}],
                      "decision": {"outcome": gstat, "comment": "", "decided_by_name": "Sophie Martin",
                                   "decided_at": NOW} if gstat in ("go", "conditional") else None,
                      "requested_by": admin.get("user_id"), "requested_by_name": "Sophie Martin",
                      "created_at": NOW, "updated_at": NOW})
    await db.lifecycle_gates.insert_many(gates)
    decisions = [{"decision_id": uid(), "tenant_id": t, "project_id": random.choice(projects)["project_id"],
                  "title": random.choice(["Go / No-Go lancement de la vague suivante", "Arbitrage périmètre MVP",
                                          "Validation du budget complémentaire", "Choix de la solution cible",
                                          "Report de l'échéance de généralisation", "Renfort de l'équipe projet",
                                          "Passage en run anticipé", "Dérogation au standard d'architecture"]),
                  "description": "", "category": random.choice(["stratégique", "budget", "planning", "périmètre", "rh"]),
                  "status": random.choices(["prise", "en_attente"], [70, 30])[0],
                  "decision_date": iso(TODAY - timedelta(days=random.randint(0, 250))),
                  "due_date": iso(TODAY + timedelta(days=random.randint(10, 90))),
                  "owner": random.choice(names), "impact": "", "governance_id": random.choice(govs)["governance_id"],
                  "created_at": NOW} for _ in range(130)]
    await db.decisions.insert_many(decisions)
    demands = [{"demand_id": uid(), "tenant_id": t,
                "title": random.choice(["Extension du selfcare aux professionnels", "Automatisation des contrôles KYC",
                                        "Nouveau parcours crédit auto", "Intégration partenaire assurtech",
                                        "Tableau de bord ESG", "Dématérialisation des courriers entrants",
                                        "Robot d'aide à la saisie back-office", "Portail de gestion des délégations",
                                        "Application de gestion des legs", "Espace notaires en ligne",
                                        "Refonte simulateurs épargne", "API restitution données DSP3"]) + random.choice(["", "", " (filiale)", " — étude"]),
                "description": "Demande métier en instruction par le PMO.",
                "requester": random.choice(names), "requester_department": random.choice(DIRECTIONS),
                "business_value": "Gains de productivité et amélioration de l'expérience client.",
                "estimated_budget": random.randrange(80, 2500) * 1000,
                "urgency": random.choices(["low", "medium", "high"], [25, 45, 30])[0],
                "status": random.choices(["nouvelle", "en_analyse", "validee", "refusee", "convertie"], [30, 28, 18, 12, 12])[0],
                "priority_score": random.choice([None, round(random.uniform(1, 5), 1)]),
                "created_at": (datetime.now(timezone.utc) - timedelta(days=random.randint(0, 180))).isoformat()} for _ in range(45)]
    await db.demands.insert_many(demands)
    etypes = [e async for e in db.event_types.find({"tenant_id": t}, {"event_type_id": 1, "name": 1, "level": 1})]
    events = []
    if etypes:
        for m in range(1, 13):
            for et in etypes:
                n_ev = 1 if et["level"] != "projet" else random.randint(2, 5)
                for _ in range(n_ev):
                    d = date(2026, m, random.randint(2, 27))
                    events.append({"event_id": uid(), "tenant_id": t, "event_type_id": et["event_type_id"],
                                   "title": et["name"], "level": et["level"], "date": iso(d),
                                   "status": "tenu" if d < TODAY else "planifie", "notes": "", "created_at": NOW})
        await db.events.insert_many(events)

    # ── SAFe : trains, PIs, sprints, capabilities, PB ────────────────────
    print("SAFe & PB…")
    train_defs = [("ART Digital & Distribution", "Expérience client et distribution omnicanale", teams[8:13]),
                  ("ART Core Banking & Paiements", "Modernisation du cœur bancaire et des paiements", teams[0:5]),
                  ("ART Data & Conformité", "Data platform, IA et conformité réglementaire", teams[11:16])]
    trains = [{"train_id": uid(), "tenant_id": t, "name": nm, "description": d, "vision": d,
               "team_ids": [x["team_id"] for x in tms], "created_at": NOW} for nm, d, tms in train_defs]
    await db.trains.insert_many(trains)
    pis = []
    for tr in trains:
        for i, (s, e, st) in enumerate([("2026-04-06", "2026-07-03", "completed"), ("2026-07-06", "2026-10-02", "active"),
                                        ("2026-10-05", "2027-01-08", "planning")]):
            pis.append({"pi_id": uid(), "tenant_id": t, "train_id": tr["train_id"], "name": f"PI-{i+2} 2026",
                        "start_date": s, "end_date": e, "objectives": [], "status": st, "created_at": NOW})
    await db.pis.insert_many(pis)
    active_pi = next(p for p in pis if p["status"] == "active")
    sprints = [{"sprint_id": uid(), "tenant_id": t, "pi_id": active_pi["pi_id"], "train_id": active_pi["train_id"],
                "name": f"Sprint {i+1}", "start_date": iso(date(2026, 7, 6) + timedelta(days=14 * i)),
                "end_date": iso(date(2026, 7, 19) + timedelta(days=14 * i)), "capacity_jh": 120.0,
                "velocity_planned": random.randint(38, 48), "velocity_actual": random.randint(32, 50) if i < 3 else None,
                "status": "completed" if i < 3 else "active" if i == 3 else "planned", "created_at": NOW} for i in range(6)]
    await db.sprints.insert_many(sprints)
    safe_projects = [p for p in active if p["methodology"] in ("safe", "agile")]
    caps = [{"capability_id": uid(), "tenant_id": t, "train_id": random.choice(trains)["train_id"],
             "pi_id": random.choice([p for p in pis if p["status"] in ("active", "planning")])["pi_id"],
             "name": random.choice(["Onboarding digital", "Paiement instantané", "KYC automatisé", "Scoring temps réel",
                                    "Signature électronique", "Selfcare sinistres", "Agrégation de comptes", "Alerting conformité",
                                    "Portail API partenaires", "Vision 360 client", "Détection fraude ML", "Coffre-fort numérique"]) + f" v{random.randint(1, 3)}",
             "description": "Capability priorisée en PI planning.",
             "status": random.choices(["backlog", "in_progress", "done"], [40, 40, 20])[0],
             "business_value": random.choice([1, 2, 3, 5, 8, 13, 21]), "time_criticality": random.choice([1, 2, 3, 5, 8, 13]),
             "risk_reduction": random.choice([1, 2, 3, 5, 8]), "job_size": random.choice([1, 2, 3, 5, 8, 13]),
             "wsjf": 0.0, "linked_project_ids": [random.choice(safe_projects)["project_id"]] if safe_projects else [],
             "created_at": NOW} for _ in range(30)]
    for c in caps:
        c["wsjf"] = round((c["business_value"] + c["time_criticality"] + c["risk_reduction"]) / c["job_size"], 1)
    await db.capabilities.insert_many(caps)
    top_caps = sorted(caps, key=lambda c: -c["wsjf"])[:8]
    await db.pb_sessions.insert_many([
        {"session_id": uid(), "tenant_id": t, "name": "PB PI-3 2026", "envelope": 2500000.0, "deadline": "2026-06-20",
         "status": "closed", "items": [{"item_id": uid(), "label": c["name"], "cost": float(c["job_size"] * 90000), "ref": ""} for c in top_caps[:5]],
         "created_by": admin.get("user_id"), "created_by_name": "Sophie Martin", "created_at": NOW, "updated_at": NOW},
        {"session_id": uid(), "tenant_id": t, "name": "PB PI-4 2026", "envelope": 3000000.0, "deadline": "2026-09-20",
         "status": "open", "items": [{"item_id": uid(), "label": c["name"], "cost": float(c["job_size"] * 95000), "ref": ""} for c in top_caps[3:]],
         "created_by": admin.get("user_id"), "created_by_name": "Sophie Martin", "created_at": NOW, "updated_at": NOW}])
    okrs = [{"okr_id": uid(), "tenant_id": t, "train_id": random.choice(trains)["train_id"],
             "objective": ob, "description": "",
             "key_results": [{"kr_id": uid(), "description": kr, "target_value": tv, "current_value": cv, "unit": u}],
             "linked_capability_ids": [random.choice(caps)["capability_id"]],
             "status": random.choices(["on_track", "at_risk", "behind", "achieved"], [45, 25, 15, 15])[0],
             "created_at": NOW}
            for ob, kr, tv, cv, u in [
                ("Accélérer l'onboarding digital", "Taux de complétion du parcours", 85, 71, "%"),
                ("Fiabiliser les paiements instantanés", "Taux de succès IP", 99.5, 98.9, "%"),
                ("Réduire les faux positifs LCB-FT", "Taux de faux positifs", 60, 78, "%"),
                ("Industrialiser le déploiement continu", "Fréquence de MEP par squad", 4, 2.5, "/mois"),
                ("Améliorer la satisfaction conseillers", "CSAT outil NOVA360", 4.2, 3.8, "/5"),
                ("Réduire le lead time des features", "Lead time moyen", 21, 34, "jours"),
                ("Couvrir les API critiques par des tests", "Couverture de tests", 80, 64, "%"),
                ("Diminuer les incidents post-MEP", "Incidents P1/P2 post-MEP", 1, 2.4, "/trim"),
                ("Monter en charge la data platform", "Domaines migrés", 12, 7, "domaines"),
                ("Automatiser les contrôles conformité", "Contrôles automatisés", 50, 28, "%"),
                ("Réduire le coût unitaire des paiements", "Coût par transaction", 0.04, 0.055, "€"),
                ("Déployer l'IA générative au support", "Tickets déviés par l'IA", 30, 12, "%")]]
    await db.okrs.insert_many(okrs)

    # ── Budget portefeuille ──────────────────────────────────────────────
    total_active_budget = sum(p["budget_total"] for p in active)
    capex_t = round(sum(p["capex_planned"] for p in active), -4)
    opex_t = round(sum(p["opex_planned"] for p in active), -4)
    await db.portfolio_envelopes.insert_many([
        {"envelope_id": uid(), "tenant_id": t, "year": 2026, "label": "Enveloppe Portefeuille 2026",
         "capex_envelope": round(capex_t * 1.08, -4), "opex_envelope": round(opex_t * 1.08, -4),
         "total_envelope": round((capex_t + opex_t) * 1.08, -4), "created_at": NOW, "updated_at": NOW},
        {"envelope_id": uid(), "tenant_id": t, "year": 2027, "label": "Enveloppe Portefeuille 2027 (pré-cadrage)",
         "capex_envelope": round(capex_t * 0.95, -4), "opex_envelope": round(opex_t * 1.02, -4),
         "total_envelope": round((capex_t * 0.95 + opex_t * 1.02), -4), "created_at": NOW, "updated_at": NOW}])
    await db.strategic_envelopes.insert_many([
        {"envelope_id": uid(), "tenant_id": t, "year": 2026, "axis": "programme", "ref_id": pr["program_id"],
         "amount": float(pr["budget_keur"] * 1000 // 3), "created_at": NOW, "updated_at": NOW} for pr in programs])
    transfers = []
    for _ in range(8):
        a, b = random.sample(active, 2)
        transfers.append({"transfer_id": uid(), "tenant_id": t, "from_project_id": a["project_id"],
                          "from_project_name": a["name"], "to_project_id": b["project_id"], "to_project_name": b["name"],
                          "amount": float(random.randrange(50, 400) * 1000),
                          "reason": random.choice(["Réallocation suite à arbitrage COPIL", "Report de charge vers la vague 2",
                                                   "Financement du surcoût réglementaire", "Optimisation de fin d'année"]),
                          "created_by": "admin@altair.fr", "created_at": NOW})
    await db.budget_transfers.insert_many(transfers)
    fdocs = []
    for p in random.sample(active, 40):
        scope_v = round(sum(x["jh_restants_estimes"] for x in all_tasks if x["project_id"] == p["project_id"]) * 640, -2)
        fdocs.append({"forecast_id": uid(), "tenant_id": t, "project_id": p["project_id"], "quarter": "2026-Q2",
                      "scope_value": scope_v, "adjustment": float(random.randrange(-40, 60) * 500),
                      "final_value": scope_v, "status": "valide", "validated_at": NOW, "validated_by": "pmo@altair.fr"})
    await db.forecasts.insert_many(fdocs)

    # ── Snapshots portefeuille (8 mois d'historique) ─────────────────────
    n_act = len(active)
    snaps = []
    for i, m in enumerate(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]):
        frac = 0.35 + i * 0.06
        snaps.append({"snapshot_id": uid(), "tenant_id": t, "month": m,
                      "budget_total": round(total_active_budget, -4),
                      "budget_consumed": round(total_active_budget * frac, -4),
                      "eac_total": round(total_active_budget * random.uniform(1.02, 1.06), -4),
                      "n_projects": n_act - random.randint(0, 12),
                      "phases": {"cadrage": 30, "conception": 45, "realisation": 70, "recette": 25, "deploiement": 18},
                      "rag": {"green": 105 - i, "orange": 55, "red": 28 + i}, "created_at": NOW})
    await db.portfolio_snapshots.insert_many(snaps)

    # ── Index de performance ─────────────────────────────────────────────
    print("Index…")
    await db.tasks.create_index([("tenant_id", 1), ("project_id", 1)])
    await db.tasks.create_index([("project_id", 1), ("status", 1)])
    await db.projects.create_index([("tenant_id", 1), ("status", 1)])
    await db.milestones.create_index([("project_id", 1)])
    await db.risks.create_index([("project_id", 1)])
    await db.allocations.create_index([("project_id", 1)])
    await db.allocations.create_index([("resource_id", 1), ("period_month", 1)])
    await db.incidents.create_index([("tenant_id", 1), ("application_id", 1)])
    await db.events.create_index([("tenant_id", 1), ("date", 1)])
    await db.timesheets.create_index([("tenant_id", 1), ("resource_id", 1)])

    print(f"""SEED OK — tenant Altair :
  {len(programs)} programmes, {len(projects)} projets ({len(active)} actifs), {len(all_tasks)} tâches,
  {len(all_ms)} jalons, {len(all_risks)} risques, {len(deps)} dépendances,
  {len(apps)} applications, {len(ifaces)} interfaces, {len(incidents)} incidents, {len(vulns)} vulnérabilités,
  {len(resources)} ressources, {len(teams)} équipes, {len(allocs)} allocations, {len(tss)} timesheets,
  {len(gates)} gates, {len(decisions)} décisions, {len(demands)} demandes, {len(events)} événements,
  {len(trains)} trains, {len(pis)} PIs, {len(caps)} capabilities, {len(okrs)} OKRs.""")


asyncio.run(main())
