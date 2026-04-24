from pydantic import BaseModel
from typing import Optional


class ProjectCreate(BaseModel):
    name: str
    methodology: str
    status_rag: str
    capex_planned: float = 0
    capex_consumed: float = 0
    opex_planned: float = 0
    opex_consumed: float = 0
    eac: Optional[float] = None
    budget_total: float = 0
    budget_consumed: float = 0
    budget_forecast: float = 0
    jh_planned: float
    jh_consumed: float = 0
    start_date: str
    end_date_baseline: str
    end_date_forecast: str
    end_date_actual: Optional[str] = None
    status: str = "actif"
    description: Optional[str] = None
    owner_id: Optional[str] = None
    program_id: Optional[str] = None
    source_id: Optional[str] = None
    source_tool: Optional[str] = None
    metadata: dict = {}
    # Scoring Arbitrage (1–5)
    strategic_alignment: Optional[int] = None
    business_value:      Optional[int] = None
    roi_estimated:       Optional[int] = None
    urgency:             Optional[int] = None
    risk_score:          Optional[int] = None
    complexity:          Optional[int] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    methodology: Optional[str] = None
    status_rag: Optional[str] = None
    status: Optional[str] = None
    capex_planned: Optional[float] = None
    capex_consumed: Optional[float] = None
    opex_planned: Optional[float] = None
    opex_consumed: Optional[float] = None
    eac: Optional[float] = None
    budget_total: Optional[float] = None
    budget_consumed: Optional[float] = None
    budget_forecast: Optional[float] = None
    jh_planned: Optional[float] = None
    jh_consumed: Optional[float] = None
    start_date: Optional[str] = None
    end_date_baseline: Optional[str] = None
    end_date_forecast: Optional[str] = None
    end_date_actual: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[str] = None
    program_id: Optional[str] = None
    # Scoring Arbitrage (1–5)
    strategic_alignment: Optional[int] = None
    business_value:      Optional[int] = None
    roi_estimated:       Optional[int] = None
    urgency:             Optional[int] = None
    risk_score:          Optional[int] = None
    complexity:          Optional[int] = None


class BudgetRevisionCreate(BaseModel):
    capex_planned: Optional[float] = None
    opex_planned: Optional[float] = None
    eac: float
    reason: str
    author: Optional[str] = None
