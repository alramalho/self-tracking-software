from pydantic import BaseModel, Field
from datetime import datetime, UTC
from typing import Optional, List
from bson import ObjectId

class PlanSession(BaseModel):
    date: str
    descriptive_guide: str
    activity_id: str
    quantity: int


class Plan(BaseModel):
    id: str
    user_id: str
    plan_group_id: Optional[str] = None
    goal: str
    goal_embedding: Optional[List[float]] = None
    emoji: str | None = None
    finishing_date: Optional[str] = None
    sessions: List[PlanSession]
    created_at: str

    @classmethod
    def new(cls, user_id: str, goal: str, emoji: str, finishing_date: Optional[str], sessions: List[PlanSession], plan_group_id: Optional[str] = None, id: Optional[str] = None) -> "Plan":
        return cls(
            id=id or str(ObjectId()),
            user_id=user_id,
            plan_group_id=plan_group_id or str(ObjectId()),
            goal=goal,
            emoji=emoji, 
            finishing_date=finishing_date,
            sessions=sessions,
            created_at=datetime.now(UTC).isoformat(),
        )
