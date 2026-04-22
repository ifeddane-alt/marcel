/**
 * TenantConfigContext — Fournit la configuration tenant à toute l'application.
 * Chargée une fois après login, avec fallback sur les valeurs par défaut.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { adminConfigAPI } from "@/api";
import { useAuth } from "./AuthContext";

const TenantConfigContext = createContext(null);

// ─── Valeurs par défaut ───────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  modules_enabled: ["safe", "demands", "timesheets", "leaves", "vendors", "compliance", "roadmap"],
  workflows: {
    timesheet: { validation_steps: 2, cp_timeout_days: 3, auto_validate_on_timeout: true },
    demands:   { active_statuses: ["qualifiee", "priorisee", "acceptee", "refusee", "convertie"] },
  },
  enums: {
    milestone_types: {},
    risk_categories: [],
    dependency_natures: [],
    project_statuses: [],
    demand_urgencies: [],
  },
  holidays: [],
  thresholds: {
    capacity_orange_pct: 70,
    capacity_red_pct: 85,
    forfait_orange_pct: 80,
    forfait_red_pct: 95,
    tjm_variance_pct: 10,
    regulatory_days: 90,
    eac_ratio: 1.10,
  },
  ppt_branding: {
    primary_color: "#0B2545",
    secondary_color: "#134074",
    accent_color: "#10B981",
    company_name: "Groupe Altair Industries",
    font: "Arial",
    logo_base64: null,
  },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TenantConfigProvider({ children }) {
  const { token } = useAuth();
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) { setConfig(DEFAULT_CONFIG); setLoading(false); return; }
    try {
      const res = await adminConfigAPI.get();
      if (res.data && typeof res.data === "object" && !Array.isArray(res.data)) {
        setConfig({ ...DEFAULT_CONFIG, ...res.data });
      }
    } catch {
      // Fallback sur les défauts si non admin ou config absente
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { reload(); }, [reload]);

  const isModuleEnabled = (moduleName) => {
    const enabled = config.modules_enabled || DEFAULT_CONFIG.modules_enabled;
    return enabled.includes(moduleName);
  };

  return (
    <TenantConfigContext.Provider value={{ config, loading, reload, isModuleEnabled }}>
      {children}
    </TenantConfigContext.Provider>
  );
}

export function useTenantConfig() {
  return useContext(TenantConfigContext);
}
