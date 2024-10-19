from pydantic import BaseModel, Field
from datetime import datetime, UTC
from typing import Optional, List
from bson import ObjectId

class PlanSession(BaseModel):
    date: str
    descriptive_guide: str
    activity_name: str
    quantity: int

class Plan(BaseModel):
    id: str
    user_id: str
    goal: str
    goal_embedding: Optional[List[float]] = None
    emoji: str | None = None
    finishing_date: Optional[str] = None
    activity_ids: List[str]
    sessions: List[PlanSession]
    created_at: str

    @classmethod
    def new(cls, user_id: str, goal: str, emoji: str, finishing_date: Optional[str], sessions: List[PlanSession]) -> "Plan":
        return cls(
            id=str(ObjectId()),
            user_id=user_id,
            goal=goal,
            emoji=emoji,  # Add this line
            finishing_date=finishing_date,
            activity_ids=[],  # This will be populated after creating activities
            sessions=sessions,
            created_at=datetime.now(UTC).isoformat(),
        )