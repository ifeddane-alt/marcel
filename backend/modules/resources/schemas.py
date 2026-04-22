from pydantic import BaseModel
from typing import Optional, Literal


ResourceType = Literal["interne", "externe_regie", "externe_forfait"]


class ResourceCreate(BaseModel):
    name: str
    role: str
    team: Optional[str] = None
    team_id: Optional[str] = None
    tjm_eur: Optional[float] = None
    availability_rate: Optional[float] = 100
    capacity_jh_month: float = 15
    email: Optional[str] = None
    validator_resource_id: Optional[str] = None
    # Nouveaux champs (Bloc 2c)
    resource_type: ResourceType = "interne"
    vendor: Optional[str] = None               # ESN / Fournisseur
    contract_tjm: Optional[float] = None       # TJM contractuel signé
    forfait_envelope: Optional[float] = None   # Enveloppe forfait (€)
    forfait_consumed: Optional[float] = None   # Consommé sur forfait (€)
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None


class ResourceUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    team: Optional[str] = None
    team_id: Optional[str] = None
    tjm_eur: Optional[float] = None
    availability_rate: Optional[float] = None
    capacity_jh_month: Optional[float] = None
    email: Optional[str] = None
    validator_resource_id: Optional[str] = None
    # Nouveaux champs (Bloc 2c)
    resource_type: Optional[ResourceType] = None
    vendor: Optional[str] = None
    contract_tjm: Optional[float] = None
    forfait_envelope: Optional[float] = None
    forfait_consumed: Optional[float] = None
    contract_start: Optional[str] = None
    contract_end: Optional[str] = None
