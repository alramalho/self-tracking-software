from pydantic import BaseModel, Field
from typing import List, Dict, Any
from entities.user import User
from entities.activity import Activity
from ai.assistant.memory import DatabaseMemory
from datetime import datetime
from gateways.activities import ActivitiesGateway
from .flowchart_nodes import (
    Node,
)
from fastapi import WebSocket
from ai.suggestions import ActivitySuggestion, AssistantSuggestion
from ai.assistant.base_assistant import BaseAssistant

activities_gateway = ActivitiesGateway()


class ExtractedActivityEntry(BaseModel):
    activity_id: str = Field(..., description="The id of the activity that was logged")
    date: str = Field(
        ..., description="The date of when the activity was done. YYYY-MM-DD"
    )
    measure: str = Field(
        ..., description="The measure of the activity (minutes, kilometers, pages, etc). If activity was already existent. This must match the activity's measure."
    )
    quantity: int = Field(
        ...,
        description="The quantity of the activity (how many minutes were spent reading / how many kilometers were ran / etc)",
    )


class ExtractedActivityEntryList(BaseModel):
    reasoning: str = Field(
        ..., description="Your step by step reasoning analyzing conversation history and how does that map to extracted activities."
    )
    activities: List[ExtractedActivityEntry] = Field(
        ..., description="A list of the new activities to be logged"
    )


every_message_flowchart = {
    "ActivityScanner": Node(
        text="Based on the conversation history, did the user mentioned any of their pre-existing activities?",
        connections={"Yes": "ExtractActivity", "No": "Converse"},
        temperature=0.7,
    ),
    "ExtractActivity": Node(
        text=(
            "After carefully analyse converstaion history and your goals, extract new activities recently mentioned in the user's message." +
            "New activites are activites that are not on the recent logged activities list. " +
            "You can only extract activities that the user is currently tracking, not create new ones." 
        ),
        output_schema=ExtractedActivityEntryList,
        connections={"default": "InformTheUserAboutTheActivity"},
    ),
    "InformTheUserAboutTheActivity": Node(
        text="Inform the user that you've extracted the activity, which he needs to accept or reject.",
    ),
    "InformTheUserOnlyExistingActivitiesAreSupported": Node(
        text="Analyse user's activity name and inform the user that you couldn't find the activity in his activities list.",
    ),
    "Converse": Node(
        text="Taking into account the conversation history flow (and system messages if present), converse with the user in succint messages. Your message must fit the conversation flow.",
        temperature=1,
    ),
}


class ActivityExtractorAssistant(BaseAssistant):
    def __init__(
        self,
        user: User,
        memory: DatabaseMemory,
        websocket: WebSocket = None,
    ):
        super().__init__(user, memory, websocket)

    def get_system_prompt(self) -> str:
        return f"""You are {self.name}, an AI assistant helping the user do and track more of his existing activities. 
        You should analyze what the user tells you and extract the relevant activities in the conversation history, but not re-extract previously logged activities.
        You should not bundle them up, respecting the dates when they are mentioned.
        You can be more flexible regarding quantity.

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
                "user_activities": [
                    str(activity)
                    for activity in activities_gateway.get_all_activities_by_user_id(
                        self.user.id
                    )
                ],
                f"recent_logged_activities_on_{lookback_days}_days": activities_gateway.get_readable_recent_activity_entries(
                    self.user.id, past_day_limit=lookback_days
                ),
            }
        )

        return context

    async def handle_suggestions(self, extracted: Dict) -> List[AssistantSuggestion]:
        suggestions: List[AssistantSuggestion] = []

        # Aggregate activities from all ExtractActivity nodes
        all_activities = []
        for key in extracted:
            if key.startswith("ExtractActivity_"):
                all_activities.extend(extracted[key].activities)

        # If we have extracted activities, create suggestions
        if all_activities:
            existing_entries = activities_gateway.get_all_activity_entries_by_user_id(
                self.user.id
            )
            existing_activities = activities_gateway.get_all_activities_by_user_id(self.user.id)
            existing_activity_ids = [a.id for a in existing_activities]
            activity_entries = [
                ae
                for ae in all_activities
                if not any(
                    existing.activity_id == ae.activity_id and existing.date == ae.date
                    for existing in existing_entries
                ) and ae.activity_id in existing_activity_ids
            ]

            for entry in activity_entries:
                activity = activities_gateway.get_activity_by_id(entry.activity_id)
                suggestion = ActivitySuggestion.from_activity_entry(entry, activity)
                suggestions.append(suggestion)

        return suggestions
