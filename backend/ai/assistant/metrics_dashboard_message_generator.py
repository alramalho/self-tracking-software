from pydantic import BaseModel, Field
from typing import List, Dict, Any
from entities.user import User
from entities.metric import Metric
from ai.assistant.memory import DatabaseMemory
from gateways.metrics import MetricsGateway
from .flowchart_nodes import Node
from ai.assistant.base_assistant import BaseAssistant

metrics_gateway = MetricsGateway()

every_message_flowchart = {
    "GenerateMessage": Node(
        text=(
            "Analyze the user's metrics from the past week, focusing on the user's notes and ratings. "
            "Look for the most unusual or insightful combination of rating and note. "
            "For example, a day where the rating was particularly high/low and the user provided a meaningful explanation, "
            "or where there's an interesting pattern in the notes. "
            "Generate a friendly, conversational message highlighting this insight. "
            "Make it simple, start with 'hey', and don't repeat yourself over messages (analyze conversation history)."
        ),
        temperature=1.1,
    ),
}

class MetricsDashboardMessageGenerator(BaseAssistant):
    def __init__(
        self,
        user: User,
        memory: DatabaseMemory,
        user_metrics: List[Metric] = None,
    ):
        super().__init__(user, memory)
        self.user_metrics = user_metrics or []

    def get_system_prompt(self) -> str:
        return f"""You are {self.name}, an AI assistant that analyzes user's metric logs and generates insightful messages.
        You focus on finding interesting patterns and correlations in the user's metric ratings and their accompanying notes.
        Your goal is to help users reflect on their metrics and understand the factors influencing their ratings.
        """

    def get_flowchart(self) -> Dict[str, Any]:
        return every_message_flowchart

    def get_context(self) -> Dict[str, Any]:
        # Get base context
        context = super().get_context()

        context.update({
            "user_metrics": self.user_metrics,
            "metrics_history": metrics_gateway.get_readable_metrics_and_entries(
                user_id=self.user.id,
                lookback_days=7
            ),
        })

        return context 