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

        # Calculate progress for all milestones
        milestone_progress_list = [
            self._calculate_milestone_progress(milestone, activity_entries)
            for milestone in sorted_milestones
        ]

        # Find the first uncompleted milestone
        next_milestone = None
        for progress in milestone_progress_list:
            if not progress.is_completed:
                next_milestone = progress
                break

        # If all milestones are completed, return the last one
        if not next_milestone and milestone_progress_list:
            next_milestone = milestone_progress_list[-1]

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
        # For milestones without criteria, use the manual progress
        if not milestone.criteria:
            return PlanMilestoneProgress(
                milestone_id=str(ObjectId()),
                description=milestone.description,
                date=milestone.date,
                progress=milestone.progress or 0,
                is_completed=(milestone.progress or 0) >= 100,
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
                calculate_milestone_criteria_progress(criterion)
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

    def get_readable_next_milestone(self, plan: Plan) -> str:
        """Get a human readable string describing the next milestone and its progress"""
        next_milestone_response = self.calculate_plan_milestones_progress(plan)
        
        if not next_milestone_response.next_milestone:
            return "No milestones found in the plan."
            
        milestone = next_milestone_response.next_milestone
        
        # Parse the date into a more readable format
        date_obj = datetime.fromisoformat(milestone.date)
        formatted_date = date_obj.strftime("%d %b %Y")
        
        if not milestone.criteria_progress:
            return f"Next milestone '{milestone.description}' is due on {formatted_date}."

        def format_criterion(criterion: Dict[str, Any]) -> str:
            if criterion["type"] == "criterion":
                target_quantity = criterion.get("quantity", 0)
                current_quantity = criterion.get("current_quantity", 0)
                progress = int(criterion.get("progress", 0))
                return f"'{current_quantity}' out of '{target_quantity}' pages ({progress}% complete)"
            
            # Handle group type
            if criterion["type"] == "group":
                junction = criterion.get("junction", "AND")
                sub_criteria = criterion.get("criteria_progress", [])
                
                if not sub_criteria:
                    return ""
                
                formatted_sub_criteria = [format_criterion(c) for c in sub_criteria]
                connector = " AND " if junction == "AND" else " OR "
                return f"({connector.join(formatted_sub_criteria)})"
            
            return ""

        # Build the complete milestone description
        criteria_descriptions = []
        for criterion in milestone.criteria_progress:
            formatted = format_criterion(criterion)
            if formatted:
                criteria_descriptions.append(formatted)

        if not criteria_descriptions:
            return f"Next milestone '{milestone.description}' is due on {formatted_date}."

        # Join all criteria with proper conjunctions
        criteria_text = " AND ".join(criteria_descriptions)
        
        return f"Next milestone '{milestone.description}' for plan '{plan.goal}' is due on {formatted_date}. Current progress: {criteria_text}. Overall completion: {int(milestone.progress)}%." 