from pydantic import BaseModel, Field
from datetime import datetime, UTC
from typing import Optional, Dict, Any, List
from bson import ObjectId
class User(BaseModel):
    id: str
    name: Optional[str] = None
    picture: Optional[str] = None
    username: Optional[str] = None  # Add this line
    timezone: Optional[str] = None
    clerk_id: Optional[str] = None
    email: str
    created_at: str
    deleted: bool = False
    deleted_at: Optional[str] = None
    is_pwa_installed: bool = False
    is_pwa_notifications_enabled: bool = False
    pwa_subscription_endpoint: Optional[str] = None
    pwa_subscription_key: Optional[str] = None
    pwa_subscription_auth_token: Optional[str] = None
    plan_ids: List[str] = Field(default_factory=list)  # Changed from selected_plan_id to plan_ids

    @classmethod
    def new(cls, email: str, clerk_id: Optional[str] = None) -> "User":
        return cls(
            id=str(ObjectId()),
            email=email,
            created_at=datetime.now(UTC).isoformat(),
            clerk_id=clerk_id,
        )
