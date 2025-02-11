from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel
from datetime import datetime, UTC
from bson import ObjectId
from entities.plan import Plan, PlanMilestone, PlanMilestoneCriteria, PlanMilestoneCriteriaGroup
from entities.activity import ActivityEntry
from gateways.activities import ActivitiesGateway
from loguru import logger

class PlanMilestoneProgress(BaseModel):
    """Response entity for milestone progress"""
    milestone_id: str
    description: str
    date: str
    progress: float
    is_completed: bool
    criteria_progress: List[Dict[str, Any]]

class NextMilestoneResponse(BaseModel):
    """Response entity for the next milestone endpoint"""
    plan_id: str
    next_milestone: Optional[PlanMilestoneProgress]

class MilestonesController:
    def __init__(self):
        self.activities_gateway = ActivitiesGateway()
        logger.log("CONTROLLERS", "MilestonesController initialized")

    def calculate_plan_milestones_progress(self, plan: Plan) -> NextMilestoneResponse:
        """Calculate progress for the next milestone in a plan"""
        if not plan.milestones:
            return NextMilestoneResponse(
                plan_id=plan.id,
                next_milestone=None
            )

        # Get all activity entries for this plan's activities
        activity_entries = self.activities_gateway.get_all_activity_entries_by_user_id(plan.user_id)

        # Sort milestones by date
        sorted_milestones = sorted(plan.milestones, key=lambda x: x.date)
        now = datetime.now(UTC)

        # Find the next milestone
        next_milestone = None

        # First try to find the next uncompleted future milestone
        for milestone in sorted_milestones:
            progress = self._calculate_milestone_progress(milestone, activity_entries)
            if datetime.fromisoformat(milestone.date).replace(tzinfo=UTC) > now and not progress.is_completed:
                next_milestone = progress
                break

        if not next_milestone:
            # If no future uncompleted milestone, find the first uncompleted milestone
            for milestone in sorted_milestones:
                progress = self._calculate_milestone_progress(milestone, activity_entries)
                if not progress.is_completed:
                    next_milestone = progress
                    break

        if not next_milestone and sorted_milestones:
            # If all are completed, return the last milestone
            next_milestone = self._calculate_milestone_progress(sorted_milestones[-1], activity_entries)

        return NextMilestoneResponse(
            plan_id=plan.id,
            next_milestone=next_milestone
        )

    def _calculate_milestone_progress(
        self, 
        milestone: PlanMilestone,
        activity_entries: List[ActivityEntry]
    ) -> PlanMilestoneProgress:
        """Calculate progress for a single milestone"""
        if not milestone.criteria:
            return PlanMilestoneProgress(
                milestone_id=str(ObjectId()),
                description=milestone.description,
                date=milestone.date,
                progress=0,
                is_completed=False,
                criteria_progress=[]
            )

        # Helper function to get the date range for a milestone
        def get_milestone_range(milestone_date: datetime) -> tuple[datetime, datetime]:
            return datetime.fromtimestamp(0, UTC), milestone_date

        # Helper function to calculate progress for a single criterion
        def calculate_criterion_progress(criterion: PlanMilestoneCriteria) -> dict:
            if not criterion.activity_id:
                return {"type": "criterion", "progress": 0}

            start, end = get_milestone_range(datetime.fromisoformat(milestone.date).replace(tzinfo=UTC))

            relevant_entries = [
                entry for entry in activity_entries
                if entry.activity_id == criterion.activity_id
                and start < datetime.fromisoformat(entry.date).replace(tzinfo=UTC) <= end
            ]

            total_quantity = sum(entry.quantity for entry in relevant_entries)
            progress = min(100, (total_quantity / criterion.quantity) * 100)

            return {
                "type": "criterion",
                "activity_id": criterion.activity_id,
                "quantity": criterion.quantity,
                "current_quantity": total_quantity,
                "progress": progress
            }

        # Helper function to calculate progress for a group
        def calculate_group_progress(group: PlanMilestoneCriteriaGroup) -> dict:
            if not group.criteria:
                return {"type": "group", "progress": 0}

            criteria_progress = [
                calculate_criterion_progress(criterion)
                for criterion in group.criteria
            ]

            progress = (
                min(c["progress"] for c in criteria_progress)
                if group.junction == "AND"
                else max(c["progress"] for c in criteria_progress)
            )

            return {
                "type": "group",
                "junction": group.junction,
                "criteria_progress": criteria_progress,
                "progress": progress
            }

        # Helper function to determine type and calculate progress accordingly
        def calculate_milestone_criteria_progress(
            criterion: Union[PlanMilestoneCriteria, PlanMilestoneCriteriaGroup]
        ) -> dict:
            if isinstance(criterion, PlanMilestoneCriteria):
                return calculate_criterion_progress(criterion)
            return calculate_group_progress(criterion)

        # Calculate progress for each criterion
        criteria_progress = [
            calculate_milestone_criteria_progress(criterion)
            for criterion in milestone.criteria
        ]

        # Overall progress is the minimum progress of all criteria (AND logic)
        overall_progress = min(c["progress"] for c in criteria_progress)

        return PlanMilestoneProgress(
            milestone_id=str(ObjectId()),
            description=milestone.description,
            date=milestone.date,
            progress=overall_progress,
            is_completed=overall_progress >= 100,
            criteria_progress=criteria_progress
        ) 