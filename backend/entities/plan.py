from pydantic import BaseModel, Field
from datetime import datetime, UTC
from typing import Optional, List, Literal, Union
from bson import ObjectId


class PlanSession(BaseModel):
    date: str
    activity_id: str
    descriptive_guide: str = Field(
        default="", description="A note describing the session"
    )
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
    criteria: Optional[
        List[Union[PlanMilestoneCriteria, PlanMilestoneCriteriaGroup]]
    ] = Field(
        default=None,
        description="The criteria that need to be met to achieve the milestone. If unexistent it means the milestone progress is manually updated.",
    )
    progress: Optional[int] = None  # Progress as a percentage (0-100)


PlanState = Literal["ON_TRACK", "AT_RISK", "FAILED", "COMPLETED"]
class PlanCurrentWeek(BaseModel):
    state: PlanState
    state_last_calculated_at: Optional[str]

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
    coach_notes: Optional[str] = None
    updated_by_coach_at: Optional[str] = None
    current_week: PlanCurrentWeek = PlanCurrentWeek(
        state="ON_TRACK", state_last_calculated_at=None
    )
    milestones: Optional[List[PlanMilestone]] = None

    @classmethod
    def new(
        cls,
        user_id: str,
        goal: str,
        emoji: str,
        finishing_date: Optional[str] = None,
        sessions: Optional[List[PlanSession]] = [],
        plan_group_id: Optional[str] = None,
        id: Optional[str] = None,
        duration_type: Optional[Literal["habit", "lifestyle", "custom"]] = None,
        notes: Optional[str] = None,
        outline_type: Optional[Literal["specific", "times_per_week"]] = "specific",
        times_per_week: Optional[int] = None,
        activity_ids: Optional[List[str]] = None,
        milestones: Optional[List[PlanMilestone]] = None,
        current_week: Optional[PlanCurrentWeek] = None,
        updated_by_coach_at: Optional[str] = None,
        coach_notes: Optional[str] = None,
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
            updated_by_coach_at=updated_by_coach_at,
            milestones=milestones,
            current_week=current_week or PlanCurrentWeek(
                state="ON_TRACK", state_last_calculated_at=datetime.now(UTC).isoformat()
            ),
            coach_notes=coach_notes,
        )
