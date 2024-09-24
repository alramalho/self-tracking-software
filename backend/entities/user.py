from pydantic import BaseModel, Field
from datetime import datetime, UTC
from bson import ObjectId

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    name: str | None = None
    email: str | None = None
    clerk_id: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    is_pwa_installed: bool = False
    is_pwa_notifications_enabled: bool = False
    pwa_subscription_endpoint: str | None = None
    pwa_subscription_key: str | None = None
    pwa_subscription_auth_token: str | None = None
