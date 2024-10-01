from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId

class ProcessedNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    scheduled_notification_id: str
    user_id: str
    processed_at: datetime
    opened_at: datetime | None = None
    message: str