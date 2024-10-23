from pydantic import BaseModel, Field
from datetime import datetime
from bson import ObjectId
from typing import Optional, Literal

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    user_id: str
    message: str
    created_at: datetime = Field(default_factory=datetime.now)
    processed_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    concluded_at: Optional[datetime] = None
    scheduled_for: Optional[datetime] = None
    recurrence: Optional[Literal["daily", "weekly"]] = None
    aws_cronjob_id: Optional[str] = None
    prompt_tag: Optional[str] = None
    status: Literal["pending", "processed", "opened", "concluded"] = "pending"
    type: Literal["friend_request", "plan_invitation", "engagement"] = "engagement"
    related_id: Optional[str] = None  # For storing friend request or plan invitation IDs
