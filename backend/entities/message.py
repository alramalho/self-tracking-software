import uuid
from datetime import UTC, datetime

from pydantic import BaseModel
from shared.utils import time_ago
from bson import ObjectId

class Message(BaseModel):
    id: str
    sender_name: str
    sender_id: str  # from is a reserved keyword
    recipient_name: str
    recipient_id: str
    text: str
    created_at: str

    @classmethod
    def new(
        cls,
        text: str,
        sender_name: str,
        sender_id: str,
        recipient_name: str,
        recipient_id: str,
    ) -> "Message":
        return cls(
            id=str(ObjectId()),
            text=text,
            sender_name=sender_name,
            sender_id=sender_id,
            recipient_name=recipient_name,
            recipient_id=recipient_id,
            created_at=datetime.now(UTC).isoformat(),
        )

    def __str__(self):
        return f"{self.sender_name} ({time_ago(self.created_at)}): " + self.text
