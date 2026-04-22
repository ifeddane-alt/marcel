from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# ─── Enums ────────────────────────────────────────────────────────────────────

class EnumItem(BaseModel):
    value: str
    label: str
    is_system: bool = False
    order: int = 0


class MilestoneFamily(BaseModel):
    label: str
    types: List[EnumItem] = []


# ─── Workflows ────────────────────────────────────────────────────────────────

class TimesheetWorkflow(BaseModel):
    validation_steps: int = 2          # 2 ou 3
    cp_timeout_days: int = 3
    auto_validate_on_timeout: bool = True


class DemandsWorkflow(BaseModel):
    active_statuses: List[str] = [
        "qualifiee", "priorisee", "acceptee", "refusee", "convertie"
    ]


class WorkflowsConfig(BaseModel):
    timesheet: TimesheetWorkflow = TimesheetWorkflow()
    demands: DemandsWorkflow = DemandsWorkflow()


# ─── Enums tenant ─────────────────────────────────────────────────────────────

class TenantEnums(BaseModel):
    milestone_types: Dict[str, MilestoneFamily] = {}
    risk_categories: List[EnumItem] = []
    dependency_natures: List[EnumItem] = []
    project_statuses: List[EnumItem] = []
    demand_urgencies: List[EnumItem] = []


# ─── Jours fériés ─────────────────────────────────────────────────────────────

class HolidayItem(BaseModel):
    date: str          # YYYY-MM-DD
    name: str
    country: str = "FR"


# ─── Seuils d'alerte ─────────────────────────────────────────────────────────

class AlertThresholds(BaseModel):
    capacity_orange_pct: float = 70
    capacity_red_pct: float = 85
    forfait_orange_pct: float = 80
    forfait_red_pct: float = 95
    tjm_variance_pct: float = 10
    regulatory_days: int = 90
    eac_ratio: float = 1.10


# ─── Charte PPT ───────────────────────────────────────────────────────────────

class PPTBranding(BaseModel):
    primary_color: str = "#0B2545"
    secondary_color: str = "#134074"
    accent_color: str = "#10B981"
    company_name: str = "Groupe Altair Industries"
    font: str = "Arial"
    logo_base64: Optional[str] = None   # base64 PNG/SVG


# ─── Config globale ───────────────────────────────────────────────────────────

class TenantConfig(BaseModel):
    modules_enabled: List[str] = [
        "safe", "demands", "timesheets", "leaves",
        "vendors", "compliance", "roadmap",
    ]
    workflows: WorkflowsConfig = WorkflowsConfig()
    enums: TenantEnums = TenantEnums()
    holidays: List[HolidayItem] = []
    thresholds: AlertThresholds = AlertThresholds()
    ppt_branding: PPTBranding = PPTBranding()


# ─── Update schemas ────────────────────────────────────────────────────────────

class ModulesUpdate(BaseModel):
    modules_enabled: List[str]


class WorkflowsUpdate(BaseModel):
    workflows: WorkflowsConfig


class EnumsUpdate(BaseModel):
    enums: TenantEnums


class HolidaysUpdate(BaseModel):
    holidays: List[HolidayItem]


class ThresholdsUpdate(BaseModel):
    thresholds: AlertThresholds


class PPTBrandingUpdate(BaseModel):
    ppt_branding: PPTBranding
