from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any, Optional, Union
from ai.assistant.memory import Memory
from entities.message import Message, Emotion
from entities.user import User
from entities.activity import Activity, ActivityEntry
from entities.mood_report import MoodReport
from gateways.database.mongodb import MongoDBGateway
from ai.assistant.memory import DatabaseMemory
from ai.llm import ask_schema, ask_text
from datetime import datetime
import re
from loguru import logger
from .flowchart_framework import FlowchartLLMFramework
from gateways.activities import ActivitiesGateway
from .flowchart_nodes import (
    Node,
    LoopStartNode,
    LoopContinueNode,
    NodeType,
)
from bson import ObjectId
from fastapi import WebSocket
from ai.suggestions import ActivitySuggestion, AssistantSuggestion

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


class ActivityExtractorAssistant(object):
    def __init__(
        self,
        user: User,
        user_activities: List[Activity],
        memory: Memory,
        websocket: WebSocket = None,
    ):
        self.name = "Jarvis"
        self.memory = memory
        self.user = user
        self.user_activities = user_activities
        self.websocket = websocket

    async def send_websocket_message(self, message_type: str, data: dict):
        if self.websocket:
            await self.websocket.send_json({"type": message_type, **data})

    async def get_response(
        self, user_input: str, message_id: str, emotions: List[Emotion] = []
    ) -> str:


        self.memory.write(
            Message.new(
                id=message_id,
                text=user_input,
                sender_name=self.user.name,
                sender_id=self.user.id,
                recipient_name=self.name,
                recipient_id="0",
                emotions=emotions,
            )
        )

        system_prompt = f"""You are {self.name}, an AI assistant helping the user do and track more of his existing activities. 
        You are capable of extracting past activities if the user has already previously created them.
        The user must have done something everyday, so ideally you would want that to be logged.
        
        If the user requests anything beyond that, such as planning, reminders, etc, you should point the user to open a feature request by clicking the '?' icon on bottom right of the screen.
        Always consider the entire conversation history when making decisions or responses.
        Respond in the same language as the initial input.

        Today is {datetime.now().strftime('%b %d, %Y')}. 
        """

        flowchart = every_message_flowchart

        self.framework = FlowchartLLMFramework(flowchart, system_prompt)
        

        activities_str = "\n- ".join([str(a) for a in self.user_activities]) if len(self.user_activities) > 0 else "(User has not started tracking any activities yet)"
        result_message, extracted = await self.framework.run(
            f"""
        
        Here's the user's existing activities:
        {activities_str}

        Here's user's most recently logged activities:
        {activities_gateway.get_readable_recent_activity_entries(self.user.id)}
                               
        Now here's your actual conversation history with the user:
        {self.memory.read_all_as_str(max_words=1000, max_age_in_minutes=3*60)}

        {f"<system note>The detected user's emotions on HIS LAST MESSAGE are: {[f'{e.emotion} ({e.score * 100:.2f}%)' for e in emotions]}</system note>" if emotions else ""}
        
        Only output message to be sent to the user.
        """
        )

        jarvis_prefix = re.match(r"^Jarvis\s*\([^)]*\)\s*:\s*", result_message)
        if jarvis_prefix:
            result_message = result_message[len(jarvis_prefix.group(0)) :]
        elif result_message.startswith(f"{self.name}:"):
            result_message = result_message[len(f"{self.name}:") :]

        self.memory.write(
            Message.new(
                result_message,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

        logger.info(f"FRAMEWORK RESULT: {result_message}")
        logger.info(f"EXTRACTED: {extracted}")

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
            
            if suggestions:
                await self.send_websocket_message(
                    "suggestions",
                    {"suggestions": [s.dict() for s in suggestions]}
                )
        
        return result_message
