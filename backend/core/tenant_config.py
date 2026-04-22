"""
Helper centralisé pour lire la configuration tenant depuis MongoDB.
Toutes les valeurs ont des fallbacks sur les défauts système.
"""
from fastapi import Depends, HTTPException
from core.database import db
from core.auth import TokenPayload, get_current_user

# ─── Constantes ──────────────────────────────────────────────────────────────

ALL_TOGGLEABLE_MODULES = [
    "safe", "demands", "timesheets", "leaves",
    "vendors", "compliance", "roadmap",
]

DEFAULT_MODULES = list(ALL_TOGGLEABLE_MODULES)

DEFAULT_THRESHOLDS = {
    "capacity_orange_pct": 70,
    "capacity_red_pct": 85,
    "forfait_orange_pct": 80,
    "forfait_red_pct": 95,
    "tjm_variance_pct": 10,
    "regulatory_days": 90,
    "eac_ratio": 1.10,
}

# ─── Accès tenant config ──────────────────────────────────────────────────────

async def get_tenant_config(tenant_id: str) -> dict:
    """Retourne tenant.settings avec {} comme fallback."""
    tenant = await db.tenants.find_one(
        {"tenant_id": tenant_id}, {"_id": 0, "settings": 1}
    )
    if not tenant:
        return {}
    return tenant.get("settings") or {}


async def get_thresholds(tenant_id: str) -> dict:
    """Retourne les seuils d'alerte avec valeurs par défaut."""
    config = await get_tenant_config(tenant_id)
    overrides = config.get("thresholds") or {}
    return {**DEFAULT_THRESHOLDS, **overrides}


async def get_enabled_modules(tenant_id: str) -> list:
    """Retourne la liste des modules activés."""
    config = await get_tenant_config(tenant_id)
    return config.get("modules_enabled") or DEFAULT_MODULES


async def get_tenant_enums(tenant_id: str) -> dict:
    """Retourne les enums du tenant (avec fallback vide → composant utilise ses propres défauts)."""
    config = await get_tenant_config(tenant_id)
    return config.get("enums") or {}


async def get_tenant_holidays(tenant_id: str) -> list:
    """Retourne les jours fériés du tenant ou [] (le module shared/holidays sert de fallback)."""
    config = await get_tenant_config(tenant_id)
    return config.get("holidays") or []


# ─── Dépendance FastAPI pour vérification module ──────────────────────────────

def require_module(module_name: str):
    """Factory: retourne un Depends qui vérifie que le module est activé."""
    async def _check(current_user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
        modules = await get_enabled_modules(current_user.tenant_id)
        if module_name not in modules:
            raise HTTPException(
                status_code=403,
                detail=f"Module '{module_name}' désactivé par l'administrateur",
            )
        return current_user
    return _check
