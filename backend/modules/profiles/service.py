"""Service Profils & Habilitations — Système de permissions granulaire.

Les permissions sont stockées dans permissions[] du profil.
Le middleware ne regarde JAMAIS le code du profil, uniquement permissions[].
"""
from fastapi import HTTPException
from datetime import datetime, timezone
import uuid

from core.database import db
from core.auth import TokenPayload
from .schemas import ProfileCreate, ProfileUpdate, ProfileDuplicate

# ─── Liste exhaustive de toutes les permissions disponibles ──────────────────

ALL_PERMISSIONS = [
    # Tableau de bord
    {"key": "dashboard.view",              "label": "Voir le tableau de bord",        "module": "Dashboard"},
    # Portefeuille
    {"key": "portfolio.view",              "label": "Voir le portefeuille",           "module": "Portefeuille"},
    # Projets
    {"key": "projects.create",             "label": "Créer des projets",              "module": "Projets"},
    {"key": "projects.edit",               "label": "Modifier des projets",           "module": "Projets"},
    {"key": "projects.delete",             "label": "Supprimer des projets",          "module": "Projets"},
    # Export
    {"key": "export.ppt",                  "label": "Exporter COPIL (PPT)",           "module": "Export"},
    # Tâches
    {"key": "tasks.create",                "label": "Créer des tâches",               "module": "Tâches"},
    {"key": "tasks.edit",                  "label": "Modifier des tâches",            "module": "Tâches"},
    # Jalons
    {"key": "milestones.create",           "label": "Créer des jalons",               "module": "Jalons"},
    {"key": "milestones.edit",             "label": "Modifier des jalons",            "module": "Jalons"},
    {"key": "milestones.set_attribute",    "label": "Définir attribut critical/strategic", "module": "Jalons"},
    # Roadmap
    {"key": "roadmap.view",                "label": "Voir la roadmap",                "module": "Roadmap"},
    # Dépendances
    {"key": "dependencies.create",         "label": "Créer des dépendances",          "module": "Dépendances"},
    # Ressources
    {"key": "resources.create",            "label": "Créer des ressources",           "module": "Ressources"},
    {"key": "resources.edit",              "label": "Modifier des ressources",        "module": "Ressources"},
    # Équipes
    {"key": "teams.create",                "label": "Créer des équipes",              "module": "Équipes"},
    {"key": "teams.edit",                  "label": "Modifier des équipes",           "module": "Équipes"},
    {"key": "teams.view",                  "label": "Voir les équipes",               "module": "Équipes"},
    # Allocations
    {"key": "allocations.create",          "label": "Créer des allocations",          "module": "Allocations"},
    # Budget
    {"key": "budget.view",                 "label": "Voir les budgets",               "module": "Budget"},
    {"key": "budget.edit",                 "label": "Modifier les budgets",           "module": "Budget"},
    {"key": "budget.revise_eac",           "label": "Réviser EAC",                    "module": "Budget"},
    {"key": "budget.set_envelope",         "label": "Définir enveloppe budgétaire",   "module": "Budget"},
    # RAF
    {"key": "raf.view",                    "label": "Voir le RAF",                    "module": "RAF"},
    # Timesheets
    {"key": "timesheets.submit",           "label": "Soumettre ses timesheets",       "module": "Timesheets"},
    {"key": "timesheets.validate_step2",   "label": "Valider N+1 (Valideur)",         "module": "Timesheets"},
    {"key": "timesheets.validate_step3",   "label": "Valider finale (Chef de Projet)","module": "Timesheets"},
    {"key": "timesheets.modify",           "label": "Modifier timesheets (avec tracé)","module": "Timesheets"},
    {"key": "timesheets.view_all",         "label": "Voir tous les timesheets",       "module": "Timesheets"},
    # Congés
    {"key": "leaves.submit",               "label": "Saisir ses congés",              "module": "Congés"},
    {"key": "leaves.validate",             "label": "Valider les congés",             "module": "Congés"},
    # Risques
    {"key": "risks.create",                "label": "Créer des risques",              "module": "Risques"},
    {"key": "risks.view",                  "label": "Voir les risques",               "module": "Risques"},
    # Décisions
    {"key": "decisions.create",            "label": "Créer des décisions",            "module": "Décisions"},
    {"key": "decisions.view",              "label": "Voir les décisions",             "module": "Décisions"},
    # Gouvernance
    {"key": "governance.view",             "label": "Voir la gouvernance",            "module": "Gouvernance"},
    {"key": "governance.edit",             "label": "Modifier la gouvernance",        "module": "Gouvernance"},
    # Conformité
    {"key": "compliance.view",             "label": "Voir la conformité",             "module": "Conformité"},
    # Demandes
    {"key": "demands.submit",              "label": "Soumettre des demandes",         "module": "Demandes"},
    {"key": "demands.qualify",             "label": "Qualifier/Prioriser/Accepter les demandes", "module": "Demandes"},
    {"key": "demands.convert",             "label": "Convertir en projet",            "module": "Demandes"},
    {"key": "demands.view_own",            "label": "Voir ses propres demandes",      "module": "Demandes"},
    # SAFe
    {"key": "trains.create",               "label": "Créer des trains SAFe",          "module": "SAFe"},
    {"key": "trains.edit",                 "label": "Modifier des trains SAFe",       "module": "SAFe"},
    {"key": "trains.view",                 "label": "Voir les trains SAFe",           "module": "SAFe"},
    {"key": "capabilities.create",         "label": "Créer des capabilities",         "module": "SAFe"},
    # Scope
    {"key": "scope.arbitrate",             "label": "Arbitrer le scope",              "module": "Scope"},
    {"key": "scope.freeze",                "label": "Geler le scope",                 "module": "Scope"},
    {"key": "scope.receive",               "label": "Recevoir le scope",              "module": "Scope"},
    {"key": "scope.simulate",              "label": "Simuler le scope",               "module": "Scope"},
    # Fournisseurs
    {"key": "vendors.view",                "label": "Voir les fournisseurs",          "module": "Fournisseurs"},
    {"key": "vendors.edit_consumed",       "label": "Mettre à jour consommé forfait", "module": "Fournisseurs"},
    {"key": "vendors.view_contracts",      "label": "Voir les contrats",              "module": "Fournisseurs"},
    # Administration
    {"key": "admin.users",                 "label": "Gérer les utilisateurs",         "module": "Administration"},
    {"key": "admin.profiles",              "label": "Gérer les profils",              "module": "Administration"},
    {"key": "admin.config",                "label": "Configuration du tenant",        "module": "Administration"},
    {"key": "import.csv",                  "label": "Importer CSV",                   "module": "Import"},
]

# ─── 12 Profils par défaut ────────────────────────────────────────────────────

DEFAULT_PROFILES = [
    {
        "code": "ADMIN",
        "name": "Administrateur",
        "description": "Accès complet, configuration du tenant. Ne peut pas être modifié.",
        "is_system": True,
        "permissions": ["*"],
    },
    {
        "code": "CIO",
        "name": "Direction SI",
        "description": "Lecture totale, exports, zéro écriture",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "export.ppt", "roadmap.view",
            "teams.view", "budget.view", "raf.view", "timesheets.view_all",
            "risks.view", "decisions.view", "governance.view", "compliance.view",
            "demands.view_own", "trains.view", "scope.receive", "scope.simulate",
            "vendors.view", "vendors.view_contracts",
        ],
    },
    {
        "code": "PORTFOLIO",
        "name": "PMO Portefeuille",
        "description": "Pilote tout le portefeuille projets",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "projects.create", "projects.edit",
            "export.ppt", "tasks.create", "tasks.edit", "milestones.create",
            "milestones.edit", "milestones.set_attribute", "roadmap.view",
            "dependencies.create", "resources.create", "resources.edit",
            "teams.create", "teams.edit", "teams.view", "allocations.create",
            "budget.view", "budget.edit", "budget.revise_eac", "budget.set_envelope",
            "raf.view", "timesheets.submit", "timesheets.validate_step2",
            "timesheets.validate_step3", "timesheets.modify", "timesheets.view_all",
            "leaves.submit", "leaves.validate", "risks.create", "risks.view",
            "decisions.create", "decisions.view", "governance.view", "governance.edit",
            "compliance.view", "demands.submit", "demands.qualify", "demands.convert",
            "demands.view_own", "trains.view", "capabilities.create", "scope.arbitrate",
            "scope.freeze", "scope.receive", "scope.simulate", "vendors.view",
            "vendors.view_contracts", "import.csv",
        ],
    },
    {
        "code": "CHEF_DE_PROJET",
        "name": "Chef de Projet",
        "description": "CRUD sur ses projets (owner). Valide timesheets finales.",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "export.ppt", "tasks.create",
            "tasks.edit", "milestones.create", "milestones.edit", "roadmap.view",
            "dependencies.create", "teams.view", "allocations.create",
            "budget.view", "budget.edit", "budget.revise_eac", "raf.view",
            "timesheets.submit", "timesheets.validate_step3", "leaves.submit",
            "risks.create", "risks.view", "decisions.create", "decisions.view",
            "governance.view", "compliance.view", "demands.submit", "demands.view_own",
            "capabilities.create", "scope.receive", "vendors.view",
        ],
    },
    {
        "code": "MANAGER",
        "name": "Manager d'équipe",
        "description": "Responsable d'équipe. Valide timesheets N+1 et congés.",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "roadmap.view", "teams.view",
            "teams.edit", "resources.edit", "raf.view", "timesheets.submit",
            "timesheets.validate_step2", "timesheets.view_all", "leaves.submit",
            "leaves.validate", "risks.view", "decisions.view", "demands.submit",
            "demands.view_own",
        ],
    },
    {
        "code": "RTE",
        "name": "Release Train Engineer",
        "description": "Pilote le train SAFe. Gère PIs, sprints, capabilities.",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "export.ppt", "milestones.create",
            "milestones.edit", "roadmap.view", "dependencies.create", "teams.view",
            "budget.view", "raf.view", "timesheets.submit", "leaves.submit",
            "risks.create", "risks.view", "decisions.create", "decisions.view",
            "compliance.view", "demands.submit", "demands.view_own", "trains.create",
            "trains.edit", "trains.view", "capabilities.create", "scope.receive",
        ],
    },
    {
        "code": "ARCHITECTE",
        "name": "Architecte",
        "description": "Vue technique transverse. Lecture + dépendances.",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "roadmap.view", "dependencies.create",
            "teams.view", "budget.view", "raf.view", "timesheets.submit",
            "leaves.submit", "risks.create", "risks.view", "compliance.view",
            "demands.submit", "demands.view_own", "trains.view", "scope.receive",
        ],
    },
    {
        "code": "SECURITE",
        "name": "Sécurité / RSSI",
        "description": "Conformité réglementaire. Risques sécurité.",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "roadmap.view", "compliance.view",
            "risks.create", "risks.view", "governance.view", "demands.submit",
            "demands.view_own",
        ],
    },
    {
        "code": "FINANCE",
        "name": "Finance / Contrôle de gestion",
        "description": "Budgets, EAC, RAF. Lecture timesheets.",
        "is_system": True,
        "permissions": [
            "dashboard.view", "portfolio.view", "export.ppt", "teams.view",
            "budget.view", "budget.revise_eac", "budget.set_envelope", "raf.view",
            "timesheets.view_all", "risks.view", "compliance.view", "demands.view_own",
            "trains.view", "scope.simulate", "vendors.view", "vendors.view_contracts",
        ],
    },
    {
        "code": "ACHATS",
        "name": "Achats / Procurement",
        "description": "Suivi fournisseurs, forfaits, contrats.",
        "is_system": True,
        "permissions": [
            "budget.view", "raf.view", "vendors.view", "vendors.edit_consumed",
            "vendors.view_contracts",
        ],
    },
    {
        "code": "DEMANDEUR",
        "name": "Demandeur / Sponsor métier",
        "description": "Soumet et suit ses demandes projets.",
        "is_system": True,
        "permissions": [
            "dashboard.view", "demands.submit", "demands.view_own",
        ],
    },
    {
        "code": "USER",
        "name": "Contributeur",
        "description": "Saisie timesheets et congés uniquement.",
        "is_system": True,
        "permissions": [
            "timesheets.submit", "leaves.submit",
        ],
    },
]

# Mapping fallback: ancien role → permissions equivalentes
_ROLE_FALLBACK = {
    "TENANT_ADMIN": ["*"],
    "PMO_USER": [p["code"] for p in DEFAULT_PROFILES if p["code"] == "PORTFOLIO"][0],
    "READ_ONLY": [],
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── CRUD ─────────────────────────────────────────────────────────────────────

async def list_profiles(user: TokenPayload) -> list:
    return await db.profiles.find(
        {"tenant_id": user.tenant_id}, {"_id": 0}
    ).sort("name", 1).to_list(None)


async def get_profile(profile_id: str, user: TokenPayload) -> dict:
    p = await db.profiles.find_one(
        {"profile_id": profile_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not p:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    return p


async def get_profile_by_code(code: str, tenant_id: str) -> dict | None:
    return await db.profiles.find_one(
        {"code": code, "tenant_id": tenant_id}, {"_id": 0}
    )


async def create_profile(data: ProfileCreate, user: TokenPayload) -> dict:
    _require_admin(user)
    # Code unique par tenant
    existing = await db.profiles.find_one({"code": data.code, "tenant_id": user.tenant_id})
    if existing:
        raise HTTPException(400, f"Un profil avec le code '{data.code}' existe déjà")
    now = _now()
    doc = {
        "profile_id": str(uuid.uuid4()),
        "tenant_id":  user.tenant_id,
        "is_system":  False,
        "created_at": now,
        "updated_at": now,
        **data.model_dump(),
    }
    await db.profiles.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def update_profile(profile_id: str, data: ProfileUpdate, user: TokenPayload) -> dict:
    _require_admin(user)
    p = await get_profile(profile_id, user)
    # ADMIN profile: permissions cannot be changed
    if p.get("code") == "ADMIN":
        raise HTTPException(400, "Le profil ADMIN ne peut pas être modifié")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return p
    updates["updated_at"] = _now()
    await db.profiles.update_one(
        {"profile_id": profile_id, "tenant_id": user.tenant_id}, {"$set": updates}
    )
    return await get_profile(profile_id, user)


async def delete_profile(profile_id: str, user: TokenPayload) -> dict:
    _require_admin(user)
    p = await get_profile(profile_id, user)
    if p.get("is_system"):
        raise HTTPException(400, "Les profils système ne peuvent pas être supprimés")
    # Check no users have this profile
    user_count = await db.users.count_documents(
        {"profile_id": profile_id, "tenant_id": user.tenant_id}
    )
    if user_count > 0:
        raise HTTPException(400, f"{user_count} utilisateur(s) ont ce profil. Réaffectez-les d'abord.")
    await db.profiles.delete_one({"profile_id": profile_id, "tenant_id": user.tenant_id})
    return {"ok": True}


async def duplicate_profile(profile_id: str, data: ProfileDuplicate, user: TokenPayload) -> dict:
    _require_admin(user)
    p = await get_profile(profile_id, user)
    existing = await db.profiles.find_one({"code": data.new_code, "tenant_id": user.tenant_id})
    if existing:
        raise HTTPException(400, f"Un profil avec le code '{data.new_code}' existe déjà")
    now = _now()
    doc = {
        "profile_id":  str(uuid.uuid4()),
        "tenant_id":   user.tenant_id,
        "name":        data.new_name,
        "code":        data.new_code,
        "description": data.description or p.get("description", ""),
        "permissions": list(p.get("permissions", [])),
        "is_system":   False,
        "created_at":  now,
        "updated_at":  now,
    }
    await db.profiles.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def get_all_permissions() -> list:
    """Retourne la liste exhaustive des permissions disponibles."""
    return ALL_PERMISSIONS


async def get_permissions_for_user(user_id: str, tenant_id: str) -> list[str]:
    """Retourne les permissions effectives d'un utilisateur (depuis son profil ou son role)."""
    user = await db.users.find_one(
        {"user_id": user_id, "tenant_id": tenant_id},
        {"_id": 0, "profile_id": 1, "role": 1}
    )
    if not user:
        return []
    profile_id = user.get("profile_id")
    if profile_id:
        profile = await db.profiles.find_one(
            {"profile_id": profile_id, "tenant_id": tenant_id},
            {"_id": 0, "permissions": 1}
        )
        if profile:
            return profile.get("permissions", [])
    # Fallback au role
    return _role_to_permissions(user.get("role", "READ_ONLY"), tenant_id)


def _role_to_permissions(role: str, tenant_id: str = "") -> list[str]:
    """Fallback : convertit l'ancien role en liste de permissions."""
    if role == "TENANT_ADMIN":
        return ["*"]
    if role == "PMO_USER":
        # Retourner les permissions PORTFOLIO par défaut
        portfolio = next((p for p in DEFAULT_PROFILES if p["code"] == "PORTFOLIO"), None)
        return portfolio["permissions"] if portfolio else []
    # READ_ONLY: permissions de base (lecture seulement)
    return [
        "dashboard.view", "portfolio.view", "roadmap.view", "teams.view",
        "risks.view", "decisions.view", "governance.view", "compliance.view",
        "demands.view_own", "budget.view", "raf.view", "trains.view",
    ]


# ─── Seed des 12 profils par défaut ──────────────────────────────────────────

async def seed_default_profiles(tenant_id: str) -> dict:
    """Seed les 12 profils par défaut. Idempotent."""
    existing = await db.profiles.count_documents({"tenant_id": tenant_id})
    if existing >= 12:
        return {"seeded": 0, "message": "Profils déjà présents"}

    now = _now()
    docs = []
    for p in DEFAULT_PROFILES:
        docs.append({
            "profile_id": str(uuid.uuid4()),
            "tenant_id":  tenant_id,
            "is_system":  p["is_system"],
            "name":       p["name"],
            "code":       p["code"],
            "description": p["description"],
            "permissions": p["permissions"],
            "created_at": now,
            "updated_at": now,
        })

    # Vider les profils existants du tenant et ré-insérer
    await db.profiles.delete_many({"tenant_id": tenant_id})
    await db.profiles.insert_many(docs)

    return {"seeded": len(docs), "profiles": [d["code"] for d in docs]}


async def seed_full_profiles_and_users(tenant_id: str) -> dict:
    """
    Seed complet :
    1. 12 profils par défaut
    2. Réaffectation des 3 users existants
    3. Création de 4 nouveaux users (cp, manager, user, achats)
    """
    import bcrypt

    # Step 1: Seed profils
    await seed_default_profiles(tenant_id)

    # Charger les profils pour récupérer les IDs
    profiles = {
        p["code"]: p["profile_id"]
        async for p in db.profiles.find({"tenant_id": tenant_id}, {"_id": 0, "code": 1, "profile_id": 1})
    }

    # Step 2: Mettre à jour les 3 users existants
    role_to_profile = {
        "TENANT_ADMIN": profiles.get("ADMIN"),
        "PMO_USER":     profiles.get("PORTFOLIO"),
        "READ_ONLY":    profiles.get("CIO"),  # viewer → CIO (vue SI)
    }
    updated = 0
    for role, profile_id in role_to_profile.items():
        if profile_id:
            res = await db.users.update_many(
                {"tenant_id": tenant_id, "role": role, "profile_id": {"$exists": False}},
                {"$set": {"profile_id": profile_id}}
            )
            updated += res.modified_count

    # Step 3: Nouveaux utilisateurs
    def pw(p: str) -> str:
        return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

    new_users = [
        {
            "user_id":      str(uuid.uuid4()),
            "tenant_id":    tenant_id,
            "email":        "cp@altair.fr",
            "name":         "Claire Dupont",
            "role":         "PMO_USER",  # fallback role
            "profile_id":   profiles.get("CHEF_DE_PROJET"),
            "password_hash": pw("Altair2026!"),
        },
        {
            "user_id":      str(uuid.uuid4()),
            "tenant_id":    tenant_id,
            "email":        "manager@altair.fr",
            "name":         "Stéphane Renard",
            "role":         "PMO_USER",
            "profile_id":   profiles.get("MANAGER"),
            "password_hash": pw("Altair2026!"),
        },
        {
            "user_id":      str(uuid.uuid4()),
            "tenant_id":    tenant_id,
            "email":        "user@altair.fr",
            "name":         "Lucie Martin",
            "role":         "READ_ONLY",
            "profile_id":   profiles.get("USER"),
            "password_hash": pw("Altair2026!"),
        },
        {
            "user_id":      str(uuid.uuid4()),
            "tenant_id":    tenant_id,
            "email":        "achats@altair.fr",
            "name":         "Bruno Leroy",
            "role":         "READ_ONLY",
            "profile_id":   profiles.get("ACHATS"),
            "password_hash": pw("Altair2026!"),
        },
    ]

    created = 0
    for u in new_users:
        existing = await db.users.find_one({"email": u["email"], "tenant_id": tenant_id})
        if not existing:
            await db.users.insert_one(u)
            created += 1

    return {
        "profiles_seeded": 12,
        "users_updated": updated,
        "users_created": created,
        "new_users": [u["email"] for u in new_users[:created]],
    }


def _require_admin(user: TokenPayload) -> None:
    perms = getattr(user, "permissions", None) or []
    if "*" in perms or "admin.profiles" in perms:
        return
    if user.role == "TENANT_ADMIN":
        return
    raise HTTPException(status_code=403, detail="Droits administrateur requis")


# ─── Gestion utilisateurs (admin) ────────────────────────────────────────────

async def list_users(user: TokenPayload, profile_id: str | None = None) -> list:
    _require_admin(user)
    query: dict = {"tenant_id": user.tenant_id}
    if profile_id:
        query["profile_id"] = profile_id
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).to_list(None)
    # Enrichir avec le nom du profil
    profiles_map = {
        p["profile_id"]: p
        for p in await db.profiles.find({"tenant_id": user.tenant_id}, {"_id": 0}).to_list(None)
    }
    for u in users:
        pid = u.get("profile_id")
        u["profile"] = profiles_map.get(pid) if pid else None
    return users


async def update_user_profile(
    user_id: str, profile_id: str | None, user: TokenPayload
) -> dict:
    _require_admin(user)
    target = await db.users.find_one(
        {"user_id": user_id, "tenant_id": user.tenant_id}, {"_id": 0}
    )
    if not target:
        raise HTTPException(404, "Utilisateur introuvable")
    if profile_id:
        p = await db.profiles.find_one(
            {"profile_id": profile_id, "tenant_id": user.tenant_id}
        )
        if not p:
            raise HTTPException(400, "Profil introuvable")
    await db.users.update_one(
        {"user_id": user_id, "tenant_id": user.tenant_id},
        {"$set": {"profile_id": profile_id, "updated_at": _now()}}
    )
    updated = await db.users.find_one(
        {"user_id": user_id, "tenant_id": user.tenant_id},
        {"_id": 0, "password_hash": 0}
    )
    return updated
