from pydantic import BaseModel, Field
from datetime import datetime, UTC
from typing import Optional, Dict, Any, List, Literal
from bson import ObjectId

class DailyCheckinSettings(BaseModel):
    days: List[Literal["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]] = Field(default_factory=list)
    time: Optional[Literal["MORNING", "AFTERNOON", "EVENING"]] = None

class StripeSettings(BaseModel):
    customer_id: Optional[str] = None
    subscription_id: Optional[str] = None
    subscription_status: Optional[str] = None

class User(BaseModel):
    id: str
    name: Optional[str] = None
    profile: Optional[str] = None
    picture: Optional[str] = None
    username: Optional[str] = None
    timezone: Optional[str] = None
    clerk_id: Optional[str] = None
    language: Optional[str] = "English"
    plan_type: Optional[Literal["free", "plus"]] = "free"
    daily_checkin_settings: Optional[DailyCheckinSettings] = None
    email: str
    created_at: str
    deleted: bool = False
    deleted_at: Optional[str] = None
    is_pwa_installed: bool = False
    is_pwa_notifications_enabled: bool = False
    pwa_subscription_endpoint: Optional[str] = None
    pwa_subscription_key: Optional[str] = None
    pwa_subscription_auth_token: Optional[str] = None
    plan_ids: List[str] = Field(default_factory=list)
    friend_ids: List[str] = Field(default_factory=list)
    plan_invitations: List[str] = Field(default_factory=list)
    referred_user_ids: List[str] = Field(default_factory=list)
    unactivated_email_sent_at: Optional[datetime] = None
    theme_base_color: Literal["random", "slate", "blue", "violet", "amber", "emerald", "rose"] = "blue"
    stripe_settings: Optional[StripeSettings] = None

    @classmethod
    def new(
        cls,
        email: str,
        clerk_id: Optional[str] = None,
        picture: Optional[str] = None,
        name: Optional[str] = None,
        id: Optional[str] = None,
        username: Optional[str] = None,
        friend_ids: Optional[List[str]] = [],
        referred_user_ids: Optional[List[str]] = [],
    ) -> "User":
        return cls(
            id=id or str(ObjectId()),
            email=email,
            created_at=datetime.now(UTC).isoformat(),
            clerk_id=clerk_id,
            picture=picture,
            name=name,
            username=username,
            friend_ids=friend_ids,
            referred_user_ids=referred_user_ids,
        )
