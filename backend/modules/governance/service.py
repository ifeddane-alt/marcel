from core.database import db
from core.auth import TokenPayload


async def list_governance(current_user: TokenPayload) -> list:
    return await db.governance.find(
        {"tenant_id": current_user.tenant_id}, {"_id": 0}
    ).to_list(None)
