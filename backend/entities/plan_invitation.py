from pydantic import BaseModel
from datetime import datetime, UTC
from typing import Optional, Literal
from bson import ObjectId

class PlanInvitation(BaseModel):
    id: str
    plan_id: str
    sender_id: str
    recipient_id: str
    status: Literal["pending", "accepted", "rejected"]
    created_at: str
    updated_at: Optional[str] = None

    @classmethod
    def new(cls, plan_id: str, sender_id: str, recipient_id: str) -> "PlanInvitation":
        return cls(
            id=str(ObjectId()),
            plan_id=plan_id,
            sender_id=sender_id,
            recipient_id=recipient_id,
            status="pending",
            created_at=datetime.now(UTC).isoformat(),
        )
