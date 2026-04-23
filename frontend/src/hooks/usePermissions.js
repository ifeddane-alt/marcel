import { useAuth } from "@/contexts/AuthContext";
import { useTenantConfig } from "@/contexts/TenantConfigContext";

/**
 * Hook centralisant la vérification des permissions frontend.
 * Source unique de vérité pour tous les contrôles d'accès UI.
 *
 * Règle : lit UNIQUEMENT permissions[] du user stocké. JAMAIS le rôle legacy.
 * Si profile_id est null (fallback), le comportement pré-profil est conservé.
 */
export function usePermissions() {
  const { user } = useAuth();
  const { isModuleEnabled } = useTenantConfig();
  const perms = user?.permissions || [];

  /**
   * Vérifie si l'utilisateur possède la permission donnée.
   * Le wildcard "*" donne accès à tout.
   */
  function hasPermission(perm) {
    if (!perm) return false;
    if (perms.includes("*")) return true;
    return perms.includes(perm);
  }

  /**
   * Vérifie si l'utilisateur possède AU MOINS UNE des permissions listées.
   */
  function hasAnyPermission(...permList) {
    return permList.some((p) => hasPermission(p));
  }

  /**
   * Vérifie l'accès à une entrée de navigation :
   *   - L'utilisateur doit avoir la/les permission(s)
   *   - Si moduleKey fourni, le module doit être activé dans la config tenant
   *
   * @param {string|string[]} permOrPerms  permission(s) requise(s) — OR logique si tableau
   * @param {string|null}     moduleKey    clé de module (optionnel)
   */
  function canAccessNav(permOrPerms, moduleKey) {
    const ok = Array.isArray(permOrPerms)
      ? hasAnyPermission(...permOrPerms)
      : hasPermission(permOrPerms);
    if (!ok) return false;
    if (moduleKey && !isModuleEnabled(moduleKey)) return false;
    return true;
  }

  return { hasPermission, hasAnyPermission, canAccessNav };
}
