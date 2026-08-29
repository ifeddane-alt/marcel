from pydantic import BaseModel, Field


class LeaveUpsert(BaseModel):
    resource_id: str
    date: str           # YYYY-MM-DD
    value: float = Field(ge=0, le=1)  # 0.0 = suppression, 0.5 = demi-journée, 1.0 = journée
