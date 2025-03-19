from pydantic import BaseModel, Field
from fastapi import WebSocket
from typing import List, Dict, Any
from entities.user import User
from entities.metric import Metric, MetricEntry
from ai.assistant.memory import DatabaseMemory
from gateways.metrics import MetricsGateway
from .flowchart_nodes import Node
from ai.assistant.base_assistant import BaseAssistant
from gateways.activities import ActivitiesGateway
from datetime import datetime
from bson import ObjectId
from ai.suggestions import AssistantSuggestion, MetricSuggestion

metrics_gateway = MetricsGateway()


class ExtractedMetricEntry(BaseModel):
    metric_id: str = Field(..., description="The id of the metric that was logged")
    date: str = Field(..., description="The date of which the metric refers to. YYYY-MM-DD")
    rating: int = Field(..., description="The rating given to the metric (1 to 5). This metrics may be infered based on messages from the user in the conversation history.")


class ExtractedMetricEntryList(BaseModel):
    metrics: List[ExtractedMetricEntry] = Field(..., description="A list of metrics that were logged")


every_message_flowchart = {
    "MetricScanner": Node(
        text="Based on the conversation history, did the user told you about his metric and it's ratings",
        connections={"Yes": "CheckMetricDetails", "No": "Converse"},
        temperature=0.7,
    ),
    "CheckMetricDetails": Node(
        text="Are the mentioned metric details (date and rating) inferrable from last user's messages?",
    connections={
            "No": "AskForMoreInformation",
            "Yes": "ExtractPreexistentMetric",
        },
    ),
    "AskForMoreInformation": Node(
        text="Ask the user for the missing information about the metric (either date and / or rating, whatever is missing)",
    ),
    "ExtractPreexistentMetric": Node(
        text=f"Extract metrics recently mentioned in the user's message that are already in the user's metrics list.",
        output_schema=ExtractedMetricEntryList,
        connections={"default": "InformTheUserAboutTheMetric"},
        needs=["CheckMetricDetails"],
    ),
    "InformTheUserAboutTheMetric": Node(
        text="Inform the user that you've extracted the metric, which they need to accept or reject.",
    ),
    "InformTheUserOnlyExistingMetricsAreSupported": Node(
        text="Analyse user's metric name and inform the user that you couldn't find the metric in their metrics list.",
    ),
    "Converse": Node(
        text="Taking into account the conversation history flow (and system messages if present), converse with the user in succinct messages. Your message must fit the conversation flow.",
        temperature=1,
    ),
}


class MetricsCompanionAssistant(BaseAssistant):
    def __init__(
        self,
        user: User,
        memory: DatabaseMemory,
        websocket: WebSocket = None,
    ):
        super().__init__(user, memory, websocket)

    def get_system_prompt(self) -> str:
        return f"""You are {self.name}, an AI assistant that helps users log their metric ratings.
        You are capable of extracting metric ratings if the user has already previously created the metrics.
        The user must rate their metrics everyday, so ideally you would want that to be logged.
        
        If the user requests anything beyond that, such as creating new metrics, reminders, etc, you should point the user to open a feature request by clicking the '?' icon on bottom right of the screen.
        Always consider the entire conversation history when making decisions or responses.
        Respond in the same language as the initial input.

        Be mindful of the user's emotions, if they are strong enough.

        Today is {datetime.now().strftime('%b %d, %Y')}. 
        """

    def get_flowchart(self) -> Dict[str, Any]:
        return every_message_flowchart

    def get_context(self) -> Dict[str, Any]:
        # Get base context
        context = super().get_context()
        
        lookback_days = 14
        context.update(
            {
                "user_metrics": [str(metric) for metric in metrics_gateway.get_all_metrics_by_user_id(user_id=self.user.id)],
                "metrics_history": metrics_gateway.get_readable_metrics_and_entries(
                    user_id=self.user.id, lookback_days=lookback_days
                ),
            }
        )

        return context

    async def handle_suggestions(self, extracted: Dict) -> List[AssistantSuggestion]:
        suggestions: List[AssistantSuggestion] = []

        # Aggregate metrics from all ExtractMetric nodes
        all_metrics = []
        for key in extracted:
            if key.startswith("ExtractPreexistentMetric_"):
                all_metrics.extend(extracted[key].metrics)

        # If we have extracted metrics, create suggestions
        if all_metrics:
            existing_entries = metrics_gateway.get_all_metric_entries_by_user_id(
                self.user.id
            )
            metric_entries = [
                me
                for me in all_metrics
                if not any(
                    existing.metric_id == me.metric_id and existing.date == me.date
                    for existing in existing_entries
                )
            ]

            for entry in metric_entries:
                metric = metrics_gateway.get_metric_by_id(entry.metric_id)
                suggestion = MetricSuggestion.from_metric_entry(entry, metric)
                suggestions.append(suggestion)

        return suggestions
