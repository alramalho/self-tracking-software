from pydantic import BaseModel
from datetime import datetime, UTC
from typing import Optional, Literal
from bson import ObjectId

class FriendRequest(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    status: Literal["pending", "accepted", "rejected"]
    created_at: str
    updated_at: Optional[str] = None

    @classmethod
    def new(cls, sender_id: str, recipient_id: str, id: Optional[str] = None) -> "FriendRequest":
        return cls(
            id=id or str(ObjectId()),
            sender_id=sender_id,
            recipient_id=recipient_id,
            status="pending",
            created_at=datetime.now(UTC).isoformat(),
        )
