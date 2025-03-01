from pydantic import BaseModel, Field
from typing import List, Dict, Any
from entities.user import User
from entities.activity import Activity
from ai.assistant.memory import DatabaseMemory
from gateways.activities import ActivitiesGateway
from .flowchart_nodes import (
    Node,
)
from ai.assistant.base_assistant import BaseAssistant
import random
activities_gateway = ActivitiesGateway()
should_mention_activities = random.random() < 1 # always, for now

every_message_flowchart = {
    "GenerateMessage": Node(
        text=(
            "Generate a message asking if he needs help logging activities." +
            ((should_mention_activities and "Mention activites that are non logged for a while. ") or "") +
            "Make it simple, start the message with 'hey', don't repeat yourself over messages, so analyze conversation history."
        ),
        temperature=1.1,
    ),
}


class ActivityMessageGenerator(BaseAssistant):
    def __init__(
        self,
        user: User,
        memory: DatabaseMemory,
        user_activities: List[Activity] = None,
    ):
        super().__init__(user, memory)
        self.user_activities = user_activities or []

    def get_system_prompt(self) -> str:
        return f"""You are {self.name}, an AI assistant that will generate a message for the user.
        """

    def get_flowchart(self) -> Dict[str, Any]:
        return every_message_flowchart

    def get_context(self) -> Dict[str, Any]:
        # Get base context
        context = super().get_context()

        context.update(
            {
                "user_activities": self.user_activities,
                "recent_logged_activities": activities_gateway.get_readable_recent_activity_entries(
                    limit=10,
                    past_day_limit=10,
                    user_id=self.user.id
                ),
            }
        )

        return context
