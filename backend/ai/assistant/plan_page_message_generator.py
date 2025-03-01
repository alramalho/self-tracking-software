from typing import Dict, Any
from entities.user import User
from ai.assistant.memory import DatabaseMemory
from controllers.plan_controller import PlanController
from .flowchart_nodes import (
    Node,
)
import random
from ai.assistant.base_assistant import BaseAssistant
from gateways.activities import ActivitiesGateway
from controllers.milestones_controller import MilestonesController

plan_controller = PlanController()
activities_gateway = ActivitiesGateway()
milestones_controller = MilestonesController()
should_encourage_based_on_activities = random.random() < 0.2  # always, for now
should_mention_milestones = should_encourage_based_on_activities or (random.random() < 0.2)  # always, for now

every_message_flowchart = {
    "GenerateMessage": Node(
        text=(
            "Generate a message asking if he needs help creating or updating his plans."
            + (
                (
                    should_encourage_based_on_activities
                    and "Encourage the user regarding his past (or lack of) logged activities, and how that might relate to plan update / creation."
                )
                or "Don't mention their activities, but rather future plan milestones if relevan."
            )
            + "Make it simple, start the message with 'hey', don't repeat yourself over messages, so analyze conversation history."
        ),
        temperature=1.1,
    ),
}


class PlanMessageGenerator(BaseAssistant):
    def __init__(
        self,
        user: User,
        memory: DatabaseMemory,
    ):
        super().__init__(user, memory)

    def get_system_prompt(self) -> str:
        return f"""You are {self.name}, an AI assistant that will generate a message for the user.
        """

    def get_flowchart(self) -> Dict[str, Any]:
        return every_message_flowchart

    def get_context(self) -> Dict[str, Any]:
        # Get base context
        context = super().get_context()

        user_active_plans = plan_controller.get_all_user_active_plans(self.user)
        user_activities = activities_gateway.get_all_activities_by_user_id(self.user.id)
        context.update(
            {
                "user_plans": [
                    plan_controller.get_readable_plan(p) for p in user_active_plans
                ],
                "user_activities": [str(a) for a in user_activities],
                "recent_logged_activities": activities_gateway.get_readable_recent_activity_entries(
                    limit=20, past_day_limit=7, user_id=self.user.id
                ),
                "milestone_update": milestones_controller.get_readable_next_milestone(user_active_plans[0]) if user_active_plans else None,
            }
        )

        return context
