from pydantic import BaseModel, Field
from typing import List, Tuple, Dict, Any
from ai.assistant.memory import Memory
from entities.message import Message, Emotion
from entities.user import User
from entities.activity import Activity
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
        text="Taking into account the conversation history, converse with the user in succint messages. Your message must fit the conversation flow.",
        temperature=1,
    ),
}


class ActivityExtractorAssistant(object):
    def __init__(
        self,
        user: User,
        user_activities: List[Activity],
        memory: Memory,
    ):
        self.name = "Jarvis"
        self.memory = memory
        self.user = user
        self.user_activities = user_activities

    async def get_response(
        self, user_input: str, message_id: str, emotions: List[Emotion] = []
    ) -> Tuple[str, List[ExtractedActivityEntry]]:
        is_first_message_in_more_than_a_day = (
            len(self.memory.read_all(max_words=1000, max_age_in_minutes=1440)) == 0
        )

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
        If the user requests anything beyond that, such as planning, reminders, etc, you should point the user to open a feature request by clicking the '?' icon on bottom right of the screen.
        Always consider the entire conversation history when making decisions or responses.
        Respond in the same language as the initial input.

        Today is {datetime.now().strftime('%b %d, %Y')}. 
        """

        flowchart = every_message_flowchart

        self.framework = FlowchartLLMFramework(flowchart, system_prompt)
        

        activities_str = "\n- ".join([str(a) for a in self.user_activities]) if len(self.user_activities) > 0 else "(User has not started tracking any activities yet)"
        result, extracted = await self.framework.run(
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

        jarvis_prefix = re.match(r"^Jarvis\s*\([^)]*\)\s*:\s*", result)
        if jarvis_prefix:
            result = result[len(jarvis_prefix.group(0)) :]
        elif result.startswith(f"{self.name}:"):
            result = result[len(f"{self.name}:") :]

        self.memory.write(
            Message.new(
                result,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

        logger.info(f"FRAMEWORK RESULT: {result}")
        logger.info(f"EXTRACTED: {extracted}")

        # Aggregate activities from all ExtractActivity nodes
        all_activities = []
        for key in extracted:
            if key.startswith("ExtractActivity_"):
                all_activities.extend(extracted[key].activities)
        
        return result, all_activities
