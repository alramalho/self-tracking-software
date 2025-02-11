from pydantic import BaseModel, Field
from datetime import datetime, UTC
from typing import Optional, List, Literal, Union
from bson import ObjectId


class PlanSession(BaseModel):
    date: str
    activity_id: str
    descriptive_guide: str = Field(..., description="A note describing the session")
    quantity: int


class PlanMilestoneCriteria(BaseModel):
    """Represents a single activity requirement."""

    activity_id: str
    quantity: int


class PlanMilestoneCriteriaGroup(BaseModel):
    """Groups criteria with an AND or OR junction."""

    junction: Literal["AND", "OR"]
    criteria: List[Union["PlanMilestoneCriteria", "PlanMilestoneCriteriaGroup"]]


class PlanMilestone(BaseModel):
    """Defines a milestone with a list of criteria groups."""

    date: str
    description: str
    criteria: List[Union[PlanMilestoneCriteria, PlanMilestoneCriteriaGroup]]


class Plan(BaseModel):
    id: str
    user_id: str
    plan_group_id: Optional[str] = None
    goal: str
    emoji: str | None = None
    finishing_date: Optional[str] = None
    sessions: List[PlanSession] = []
    created_at: str
    deleted_at: Optional[str] = None
    activity_ids: List[str] = []
    duration_type: Optional[Literal["habit", "lifestyle", "custom"]] = None
    outline_type: Optional[Literal["specific", "times_per_week"]] = "specific"
    times_per_week: Optional[int] = None
    notes: Optional[str] = None
    milestones: Optional[List[PlanMilestone]] = None

    @classmethod
    def new(
        cls,
        user_id: str,
        goal: str,
        emoji: str,
        finishing_date: Optional[str],
        sessions: Optional[List[PlanSession]] = [],
        plan_group_id: Optional[str] = None,
        id: Optional[str] = None,
        duration_type: Optional[Literal["habit", "lifestyle", "custom"]] = None,
        notes: Optional[str] = None,
        outline_type: Optional[Literal["specific", "times_per_week"]] = "specific",
        times_per_week: Optional[int] = None,
        activity_ids: Optional[List[str]] = None,
        milestones: Optional[List[PlanMilestone]] = None,
    ) -> "Plan":
        return cls(
            id=id or str(ObjectId()),
            user_id=user_id,
            plan_group_id=plan_group_id or str(ObjectId()),
            goal=goal,
            emoji=emoji,
            finishing_date=finishing_date,
            sessions=sessions,
            created_at=datetime.now(UTC).isoformat(),
            duration_type=duration_type,
            notes=notes,
            outline_type=outline_type,
            times_per_week=times_per_week,
            activity_ids=activity_ids,
            milestones=milestones,
        )
