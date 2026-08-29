from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class ScoringPatch(BaseModel):
    strategic_alignment: Optional[int] = None  # 1-5
    business_value:      Optional[int] = None  # 1-5
    roi_estimated:       Optional[int] = None  # 1-5
    urgency:             Optional[int] = None  # 1-5
    risk_score:          Optional[int] = None  # 1-5
    complexity:          Optional[int] = None  # 1-5


class ArbitrageWeightsUpdate(BaseModel):
    w1: float  # alignment_stratégique
    w2: float  # valeur_business
    w3: float  # roi_estimated
    w4: float  # urgence
    w5: float  # risque (subtractive)
    w6: float  # complexité (subtractive)


class EnvelopeUpsert(BaseModel):
    year:             int
    label:            Optional[str] = None
    capex_envelope:   float
    opex_envelope:    float


class ScenarioCreate(BaseModel):
    name:          str
    description:   Optional[str] = None
    modifications: List[Dict[str, Any]]  # [{project_id, field, old_value, new_value}]
    summary:       Optional[Dict[str, Any]] = None  # budget/score impact snapshot
