from pydantic import BaseModel
from typing import List, Optional


class ExportCopilRequest(BaseModel):
    project_ids: List[str]
    instance_name: str = "COPIL"
    instance_date: str
    governance_id: Optional[str] = None
