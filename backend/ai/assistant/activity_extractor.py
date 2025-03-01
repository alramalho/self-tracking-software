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
        ..., description="The measure of the activity (minutes, kilometers, pages, etc)"
    )
    quantity: int = Field(
        ...,
        description="The quantity of the activity (how many minutes were spent reading / how many kilometers were ran / etc)",
    )


class ExtractedActivityEntryList(BaseModel):
    activities: List[ExtractedActivityEntry] = Field(
        ..., description="A list of activities that were logged"
    )

every_message_flowchart = {
    "ActivityScanner": Node(
        text="Based on the conversation history, did the user specificially asked you to log or register any activities?",
        connections={"Yes": "CheckActivityAlreadyConcluded", "No": "Converse"},
        temperature=0.7,
    ),
    "CheckActivityAlreadyConcluded": Node(
        text="Have you already concluded the activity requested by the user? By concluded is meant that you have already extarcted and user has already accepted or rejected the activity.",
        connections={"No": "CheckActivityQualifies", "Yes": "Converse"},
        temperature=0.7,
    ),
    "CheckActivityQualifies": Node(
        text="Does the activity exist in the user's activities list?",
        connections={"Yes": "CheckActivityDetails", "No": "InformTheUserOnlyExistingActivitiesAreSupported"},
        temperature=0.7,
    ),
    "CheckActivityDetails": Node(
        text="Are the mentioned activity details (date and quantity) inferrable from last user's messages?",
        connections={
            "No": "AskForMoreInformation",
            "Yes": "ExtractActivity",
        },
    ),
    "AskForMoreInformation": Node(
        text="Ask the user for the missing information about the activity (either date and / or quantity, whatever is missing)",
    ),
    "ExtractActivity": Node(
        text=f"Extract new activities recently mentioned in the user's message. New activites are activites that are not on the recent logged activities list. You can only extract activities that the user is currently tracking, not create new ones.",
        output_schema=ExtractedActivityEntryList,
        connections={"default": "InformTheUserAboutTheActivity"},
        needs=["CheckActivityDetails"],
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
        user_activities: List[Activity] = None,
    ):
        super().__init__(user, memory, websocket)
        self.user_activities = user_activities or []

    def get_system_prompt(self) -> str:
        return f"""You are {self.name}, an AI assistant helping the user do and track more of his existing activities. 
        You are capable of extracting past activities if the user has already previously created them.
        The user must have done something everyday, so ideally you would want that to be logged.
        
        If the user requests anything beyond that, such as planning, reminders, etc, you should point the user to open a feature request by clicking the '?' icon on bottom right of the screen.
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
        
        context.update({
            "user_activities": self.user_activities,
            "recent_logged_activities": activities_gateway.get_readable_recent_activity_entries(self.user.id),
        })
        
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
            existing_entries = activities_gateway.get_all_activity_entries_by_user_id(self.user.id)
            activity_entries = [
                ae for ae in all_activities
                if not any(
                    existing.activity_id == ae.activity_id and existing.date == ae.date
                    for existing in existing_entries
                )
            ]
            
            for entry in activity_entries:
                activity = activities_gateway.get_activity_by_id(entry.activity_id)
                suggestion = ActivitySuggestion.from_activity_entry(entry, activity)
                suggestions.append(suggestion)
        
        return suggestions
