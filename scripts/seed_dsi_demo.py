"""Seed démo DSI (APM, Run, Sécurité, Architecture) pour le tenant Altair — idempotent."""
import os, sys, uuid, asyncio
from datetime import datetime, timezone

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from motor.motor_asyncio import AsyncIOMotorClient

NOW = datetime.now(timezone.utc).isoformat()
uid = lambda: str(uuid.uuid4())


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    admin = await db.users.find_one({"email": "admin@altair.fr"}, {"tenant_id": 1})
    t = admin["tenant_id"]

    if await db.applications.count_documents({"tenant_id": t}) > 0:
        print("Seed déjà présent — rien à faire.")
        return

    projects = {p["name"]: p["project_id"] async for p in db.projects.find({"tenant_id": t}, {"project_id": 1, "name": 1})}
    teams = [tm async for tm in db.teams.find({"tenant_id": t}, {"team_id": 1, "name": 1})]
    resources = [r async for r in db.resources.find({"tenant_id": t}, {"resource_id": 1, "name": 1})]
    team_id = lambda i: teams[i % len(teams)]["team_id"] if teams else None
    pid = lambda frag: next((v for k, v in projects.items() if frag.lower() in k.lower()), None)

    def app_doc(name, code, status, crit, time_r, editor, techno, hosting, sens, tco, users, caps, comps, proj_frags):
        return {
            "application_id": uid(), "tenant_id": t, "name": name, "code": code, "description": "",
            "status": status, "criticality": crit, "time_rating": time_r, "editor": editor,
            "technology": techno, "hosting": hosting, "data_sensitivity": sens,
            "business_owner": "", "it_owner": "", "users_count": users, "tco_annual": tco,
            "business_capabilities": caps, "components": comps,
            "project_ids": [p for p in (pid(f) for f in proj_frags) if p],
            "created_at": NOW, "updated_at": NOW,
        }

    apps = [
        app_doc("SAP S/4HANA", "ERP-01", "production", "critique", "invest", "SAP", "ABAP / HANA", "on_premise", "reglementee", 850000, 1200,
                ["Finance", "Achats", "Logistique"],
                [{"name": "SAP ECC 6.0", "version": "6.0", "support_end": "2027-12-31"},
                 {"name": "Oracle Database", "version": "12c", "support_end": "2024-07-31"},
                 {"name": "SAP HANA", "version": "2.0", "support_end": "2028-12-31"}], ["S/4HANA"]),
        app_doc("Salesforce CRM", "CRM-01", "production", "haute", "invest", "Salesforce", "Apex / Lightning", "saas", "confidentielle", 420000, 800,
                ["Ventes", "Service client"], [], ["Salesforce"]),
        app_doc("Microsoft 365", "COLLAB-01", "production", "haute", "tolerate", "Microsoft", "SaaS", "saas", "interne", 380000, 4500,
                ["Collaboration", "Messagerie"], [], ["Microsoft 365"]),
        app_doc("Siebel CRM (legacy)", "CRM-LEG", "decommissionnement", "moyenne", "eliminate", "Oracle", "Siebel", "on_premise", "confidentielle", 310000, 350,
                ["Ventes"],
                [{"name": "Siebel", "version": "8.1", "support_end": "2023-06-30"}], ["SIEBEL"]),
        app_doc("Portail RH", "RH-01", "production", "moyenne", "migrate", "Interne", "Java / Angular", "on_premise", "reglementee", 150000, 3800,
                ["RH", "Self-service"],
                [{"name": "Java", "version": "8", "support_end": "2025-03-31"},
                 {"name": "Angular", "version": "12", "support_end": "2024-05-31"}], ["RH"]),
        app_doc("Datawarehouse Finance", "DATA-01", "production", "haute", "migrate", "Interne", "Oracle / Informatica", "on_premise", "confidentielle", 290000, 150,
                ["Reporting", "Finance"],
                [{"name": "Informatica PowerCenter", "version": "10.2", "support_end": "2026-09-30"}], ["Finance"]),
        app_doc("GED Documentum", "GED-01", "production", "basse", "tolerate", "OpenText", "Documentum", "on_premise", "interne", 95000, 900, ["Documentation"], [], []),
        app_doc("Supervision Centreon", "MON-01", "production", "haute", "invest", "Centreon", "Open source", "on_premise", "interne", 60000, 45, ["Exploitation"], [], []),
    ]
    await db.applications.insert_many(apps)
    aid = {a["code"]: a["application_id"] for a in apps}

    acts = [
        ("MCO ERP SAP", "mco", aid["ERP-01"], 480000, 262000),
        ("Support N2/N3 CRM", "support", aid["CRM-01"], 180000, 96000),
        ("Supervision & astreintes infra", "supervision", aid["MON-01"], 220000, 118000),
        ("Maintenance évolutive Portail RH", "maintenance_evolutive", aid["RH-01"], 140000, 89000),
        ("Patching & sécurité des socles", "patching", None, 90000, 41000),
        ("Sauvegardes & PRA", "sauvegardes", None, 75000, 38000),
    ]
    act_docs = [{
        "activity_id": uid(), "tenant_id": t, "name": n, "type": ty, "application_id": app,
        "team_id": team_id(i), "owner": "", "description": "", "recurrence": "continue",
        "status": "active", "budget_annual": b, "budget_consumed": c, "created_at": NOW, "updated_at": NOW,
    } for i, (n, ty, app, b, c) in enumerate(acts)]
    await db.run_activities.insert_many(act_docs)

    months = ["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"]
    ra = []
    for i, act in enumerate(act_docs[:4]):
        for j, m in enumerate(months):
            res = resources[(i * 2 + j) % len(resources)]
            ra.append({"run_allocation_id": uid(), "tenant_id": t, "activity_id": act["activity_id"],
                       "resource_id": res["resource_id"], "month": m, "days_allocated": 3 + (i + j) % 4})
    await db.run_allocations.insert_many(ra)

    incs = [
        ("Indisponibilité totale ERP — batch nuit bloqué", aid["ERP-01"], "P1", "resolu", "2026-06-02T08:00:00+00:00", "2026-06-02T11:30:00+00:00", 4),
        ("Lenteurs généralisées CRM", aid["CRM-01"], "P2", "resolu", "2026-05-28T09:00:00+00:00", "2026-05-29T15:00:00+00:00", 8),
        ("Interface compta ERP→DWH en échec", aid["DATA-01"], "P2", "en_cours", "2026-06-10T07:30:00+00:00", None, 8),
        ("Erreurs 500 sporadiques Portail RH", aid["RH-01"], "P3", "ouvert", "2026-06-11T14:00:00+00:00", None, 24),
        ("Job de chargement DWH bloqué", aid["DATA-01"], "P1", "en_cours", "2026-06-12T06:00:00+00:00", None, 4),
        ("Demande de purge boîte partagée", aid["COLLAB-01"], "P4", "ouvert", "2026-06-09T10:00:00+00:00", None, 72),
    ]
    await db.incidents.insert_many([{
        "incident_id": uid(), "tenant_id": t, "title": ti, "application_id": app, "severity": s,
        "status": st, "opened_at": o, "resolved_at": r, "sla_target_hours": sla,
        "description": "", "created_at": NOW,
    } for ti, app, s, st, o, r, sla in incs])

    rels = [
        ("MEP CRM v2.4", "2026-06-25", None, "mep", aid["CRM-01"], pid("Salesforce")),
        ("MEP Portail RH 3.1", "2026-07-08", None, "mep", aid["RH-01"], pid("RH")),
        ("Gel estival (période de freeze)", "2026-08-01", "2026-08-20", "gel", None, None),
        ("MEP S/4HANA — Wave 2", "2026-09-15", None, "mep", aid["ERP-01"], pid("S/4HANA")),
    ]
    await db.releases.insert_many([{
        "release_id": uid(), "tenant_id": t, "name": n, "date": d, "end_date": ed, "type": ty,
        "status": "planifiee", "application_id": app, "project_id": pj, "created_at": NOW,
    } for n, d, ed, ty, app, pj in rels])

    vulns = [
        ("CVE critique Oracle DB non patchée", aid["ERP-01"], "critique", "scan", "ouverte", "2026-05-20", "2026-06-30"),
        ("Injection SQL sur module recherche Portail RH", aid["RH-01"], "haute", "pentest", "en_remediation", "2026-04-15", "2026-07-15"),
        ("Certificats TLS expirés sur environnements de recette", aid["DATA-01"], "moyenne", "audit", "ouverte", "2026-05-02", "2026-08-01"),
        ("Comptes génériques partagés en production", aid["ERP-01"], "haute", "audit", "en_remediation", "2026-03-10", "2026-09-30"),
        ("Version Siebel obsolète sans correctifs", aid["CRM-LEG"], "moyenne", "scan", "acceptee", "2026-01-20", None),
        ("Headers de sécurité manquants GED", aid["GED-01"], "basse", "scan", "corrigee", "2026-02-05", None),
    ]
    await db.vulnerabilities.insert_many([{
        "vuln_id": uid(), "tenant_id": t, "title": ti, "application_id": app, "severity": s,
        "source": src, "status": st, "discovered_at": d, "due_date": due, "description": "", "created_at": NOW,
    } for ti, app, s, src, st, d, due in vulns])

    reqs = [
        ("DORA", "Art. 5", "Cadre de gouvernance des risques TIC formalisé", "conforme", None),
        ("DORA", "Art. 11", "Plan de continuité et tests de résilience annuels", "partiel", aid["ERP-01"]),
        ("DORA", "Art. 28", "Registre des prestataires TIC critiques", "non_conforme", None),
        ("NIS2", "Art. 21", "Mesures de gestion des risques cyber", "partiel", None),
        ("NIS2", "Art. 23", "Notification d'incidents sous 24h", "conforme", None),
        ("NIS2", "Art. 20", "Formation cybersécurité des dirigeants", "non_conforme", None),
        ("RGPD", "Art. 30", "Registre des traitements à jour", "conforme", aid["RH-01"]),
        ("RGPD", "Art. 32", "Chiffrement des données personnelles au repos", "partiel", aid["RH-01"]),
        ("ISO27001", "A.8", "Inventaire des actifs informationnels", "conforme", None),
        ("ISO27001", "A.12", "Gestion des vulnérabilités techniques", "partiel", aid["ERP-01"]),
    ]
    await db.compliance_requirements.insert_many([{
        "req_id": uid(), "tenant_id": t, "framework": fw, "ref": ref, "title": ti, "status": st,
        "application_id": app, "action_plan": "", "due_date": None, "owner": "", "created_at": NOW,
    } for fw, ref, ti, st, app in reqs])

    sec_reviews = [
        (pid("S/4HANA"), "favorable_reserves", "RSSI", "2026-05-15", "Chiffrement des flux à renforcer avant Wave 2."),
        (pid("Salesforce"), "favorable", "RSSI", "2026-04-20", ""),
        (pid("DORA"), "en_attente", "", None, ""),
    ]
    await db.security_reviews.insert_many([{
        "review_id": uid(), "tenant_id": t, "project_id": p, "status": st, "reviewer": rv,
        "review_date": d, "comments": c, "created_at": NOW,
    } for p, st, rv, d, c in sec_reviews if p])

    ifaces = [
        ("Comptabilité ERP → DWH Finance", aid["ERP-01"], aid["DATA-01"], "ETL", "quotidien", "critique", "Écritures comptables"),
        ("Synchro clients CRM → ERP", aid["CRM-01"], aid["ERP-01"], "API", "temps_reel", "haute", "Référentiel clients"),
        ("Export paie RH → ERP", aid["RH-01"], aid["ERP-01"], "Fichier", "mensuel", "haute", "Éléments de paie"),
        ("Archivage M365 → GED", aid["COLLAB-01"], aid["GED-01"], "API", "quotidien", "basse", "Documents contractuels"),
        ("Reprise données Siebel → Salesforce", aid["CRM-LEG"], aid["CRM-01"], "ETL", "quotidien", "haute", "Historique client (migration)"),
        ("Ordres de supervision → Centreon", aid["ERP-01"], aid["MON-01"], "MQ", "temps_reel", "moyenne", "Événements techniques"),
    ]
    await db.app_interfaces.insert_many([{
        "interface_id": uid(), "tenant_id": t, "name": n, "source_application_id": s,
        "target_application_id": tg, "protocol": pr, "frequency": f, "criticality": c,
        "data_desc": d, "created_at": NOW,
    } for n, s, tg, pr, f, c, d in ifaces])

    stds = [
        ("API-first pour toute nouvelle interface", "integration", "Toute nouvelle interface doit exposer une API REST documentée (OpenAPI).", "actif"),
        ("Chiffrement des données au repos", "securite", "AES-256 minimum pour toute donnée confidentielle ou réglementée.", "actif"),
        ("SSO obligatoire pour les applications internes", "securite", "Authentification via l'IdP d'entreprise (OIDC/SAML), pas de comptes locaux.", "actif"),
        ("Infrastructure as Code", "infra", "Tout provisioning via Terraform/Ansible versionné.", "actif"),
        ("Revue de code obligatoire", "dev", "Aucun merge en production sans revue par un pair.", "actif"),
    ]
    std_docs = [{"standard_id": uid(), "tenant_id": t, "title": ti, "category": c, "description": d,
                 "status": st, "created_at": NOW} for ti, c, d, st in stds]
    await db.architecture_standards.insert_many(std_docs)
    await db.architecture_exemptions.insert_one({
        "exemption_id": uid(), "tenant_id": t, "standard_id": std_docs[2]["standard_id"],
        "scope_label": "Siebel CRM (legacy)", "justification": "Application en décommissionnement — coût d'intégration SSO non justifié.",
        "expiry": "2026-12-31", "status": "active", "created_at": NOW,
    })

    arch_reviews = [
        (pid("S/4HANA"), "favorable", "Architecte SI", "2026-03-12", ""),
        (pid("Cloud Azure"), "favorable_reserves", "Architecte infra", "2026-05-05", "Prévoir la sortie des données (reversibilité) dans les contrats."),
        (pid("RH"), "en_attente", "", None, ""),
    ]
    await db.architecture_reviews.insert_many([{
        "review_id": uid(), "tenant_id": t, "project_id": p, "status": st, "reviewer": rv,
        "review_date": d, "comments": c, "created_at": NOW,
    } for p, st, rv, d, c in arch_reviews if p])

    radar = [
        ("Kubernetes", "adopt", "plateformes", "Socle de conteneurisation cible."),
        ("Terraform", "adopt", "outils", "Standard IaC groupe."),
        ("React", "adopt", "langages", "Framework front de référence."),
        ("Kafka", "trial", "plateformes", "Pilote sur les flux temps réel ERP."),
        ("LLM / IA générative", "trial", "techniques", "Cas d'usage PMO et support en évaluation."),
        ("Angular", "hold", "langages", "Plus de nouveau projet — migration progressive vers React."),
        ("PHP", "hold", "langages", "Legacy uniquement."),
        ("DuckDB", "assess", "outils", "À évaluer pour l'analytique embarquée."),
    ]
    await db.tech_radar.insert_many([{
        "item_id": uid(), "tenant_id": t, "techno": te, "ring": r, "category": c, "note": n, "created_at": NOW,
    } for te, r, c, n in radar])

    debt = [
        ("Migration Oracle 12c → 19c (fin de support dépassée)", aid["ERP-01"], 120, "haute", "planifiee"),
        ("Montée de version Java 8 → 17 du Portail RH", aid["RH-01"], 60, "haute", "identifiee"),
        ("Refonte des jobs Informatica avant fin de support", aid["DATA-01"], 90, "moyenne", "identifiee"),
        ("Suppression des comptes techniques partagés", aid["ERP-01"], 15, "haute", "planifiee"),
        ("Documentation des interfaces legacy Siebel", aid["CRM-LEG"], 10, "basse", "traitee"),
    ]
    await db.tech_debt.insert_many([{
        "debt_id": uid(), "tenant_id": t, "description": d, "application_id": app,
        "effort_jh": e, "priority": p, "status": st, "created_at": NOW,
    } for d, app, e, p, st in debt])

    print(f"Seed DSI OK — tenant {t}: {len(apps)} apps, {len(act_docs)} activités run, {len(ra)} allocations run, "
          f"{len(incs)} incidents, {len(rels)} MEP, {len(vulns)} vulnérabilités, {len(reqs)} exigences, "
          f"{len(ifaces)} flux, {len(stds)} standards, {len(radar)} radar, {len(debt)} dettes.")


asyncio.run(main())
