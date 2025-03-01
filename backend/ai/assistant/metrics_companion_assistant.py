from pydantic import BaseModel, Field
from fastapi import WebSocket
from typing import List, Dict, Any
from entities.user import User
from entities.metric import Metric
from ai.assistant.memory import DatabaseMemory
from gateways.metrics import MetricsGateway
from .flowchart_nodes import Node
from ai.assistant.base_assistant import BaseAssistant
from gateways.activities import ActivitiesGateway

metrics_gateway = MetricsGateway()
activities_gateway = ActivitiesGateway()
every_message_flowchart = {
    "TalkToUser": Node(
        text=(
            "Converse with the user in a friendly manner."
            + "Be very concise in your messages, and don't repeat yourself. "
        ),
        temperature=1.1,
    ),
}


class MetricsCompanionAssistant(BaseAssistant):
    def __init__(
        self,
        user: User,
        memory: DatabaseMemory,
        websocket: WebSocket = None,
        user_metrics: List[Metric] = None,
    ):
        super().__init__(user, memory, websocket)
        self.user_metrics = user_metrics or []

    def get_system_prompt(self) -> str:
        return f"""You are {self.name}, an AI assistant that analyzes user's metric logs.
        You focus on finding interesting patterns and correlations in the user's metric ratings and their accompanying notes.
        Your goal is to help users reflect on their metrics and understand the factors influencing their ratings, and your capabilites are purely conversational.

        Be mindful of the user's emotions, if they are strong enough.
        """

    def get_flowchart(self) -> Dict[str, Any]:
        return every_message_flowchart

    def get_context(self) -> Dict[str, Any]:
        # Get base context
        context = super().get_context()

        lookback_days = 21

        context.update(
            {
                "user_metrics": self.user_metrics,
                "metrics_history": metrics_gateway.get_readable_metrics_and_entries(
                    user_id=self.user.id, lookback_days=lookback_days
                ),
                "user_activities": [str(activity) for activity in activities_gateway.get_all_activities_by_user_id(
                    self.user.id
                )],
                "recent_logged_activities": activities_gateway.get_readable_recent_activity_entries(
                    self.user.id, past_day_limit=21
                ),
            }
        )

        return context
