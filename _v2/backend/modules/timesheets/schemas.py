from pydantic import BaseModel, Field
from typing import List, Optional, Literal


TimesheetStatus = Literal["draft", "submitted", "cp_reviewed", "validated", "rejected"]


class TimesheetEntryUpsert(BaseModel):
    resource_id: str
    work_allocation_id: str
    date: str          # YYYY-MM-DD
    jh_value: float = Field(ge=0)


class TimesheetSubmitWeek(BaseModel):
    resource_id: str
    week_start: str    # YYYY-MM-DD (lundi)


class TimesheetValidateRequest(BaseModel):
    timesheet_ids: List[str]


class TimesheetRejectRequest(BaseModel):
    timesheet_ids: List[str]
    rejection_reason: str
