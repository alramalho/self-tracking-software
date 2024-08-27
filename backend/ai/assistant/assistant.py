from ai.clients import openai_client as client
from constants import LLM_MODEL
from datetime import datetime
from entities.message import Message
from entities.user import User
from ai.assistant.memory import Memory
from ai.llm import ask_schema
from typing import List
from entities.activity import Activity
from pydantic import BaseModel, Field
from loguru import logger
from typing import Dict, Literal, TypedDict
import re


def extract_questions(mermaid_code):
    pattern = r"(\w+)\s*{([^}]+)}"
    matches = re.findall(pattern, mermaid_code, re.MULTILINE)
    questions = [match[1].strip() for match in matches]
    return questions


class Assistant(object):
    def __init__(
        self,
        user: User,
        user_activities: List[Activity],
        memory: Memory,
    ):
        self.name = "Torotoro"
        self.memory = memory
        self.user = user
        self.user_activities = user_activities

    def get_response(self, user_input: str):
        self.memory.write(
            Message.new(
                user_input,
                sender_name=self.user.name,
                sender_id=self.user.id,
                recipient_name=self.name,
                recipient_id="0",
            )
        )

        current_time = datetime.now().strftime("%H:%M")

        conversation_graph = """
        graph TD
            Start[Start Conversation] --> FirstTimeEver{First time ever talking to user?}
            FirstTimeEver -->|Yes| Introduce[Introduce yourself and goals]
            Introduce --> WaitFeedback[Wait for user feedback]
            WaitFeedback --> FirstTimeToday{First time talking today?}
            FirstTimeEver -->|No| FirstTimeToday
            FirstTimeToday -->|Yes| Greet[Greet user]
            Greet --> AskDayGoing[Ask how day is going]
            FirstTimeToday -->|No| AskHappiness{User shared happiness in a scale 1-10?}
            AskDayGoing --> AskHappiness
            AskHappiness -->|No| AskHappinessLevel[Ask user's happiness level from 1-10]
            AskHappinessLevel --> AskWhyHappiness
            AskHappiness -->|Yes| AskWhyHappiness{User shared why that happiness level?}
            AskWhyHappiness -->|No| AskHappinessReason[Ask reason for happiness level]
            AskHappinessReason --> ExploreActivities
            AskWhyHappiness -->|Yes| ExploreActivities[Explore user's activities today]
            ExploreActivities --> NewActivity{New activity mentioned?}
            NewActivity -->|Yes| MeasurementShared{Measurement method shared?}
            MeasurementShared -->|No| AskMeasurement[Ask how to measure activity]
            MeasurementShared -->|Yes| NewActivity
            NewActivity -->|No| ExploreActivities
            AskMeasurement --> ExploreActivities     
        """

        questions = ", ".join([f"{i+1}. {q}" for i, q in enumerate(extract_questions(conversation_graph))])

        system = f"""
        You are {self.name}, a friendly assistant sole goal is to engage the user in a conversation about his past activities and activity entries, exposing as much information for them to be subsequently created.
        Good activities examples include 'work in startup named X', 'work in job at company Y', 'read', 'meditate', etc.
        Counter examples include 'work' (too generic), 'work in solving a bug' (too specific), 'read the introduction of a book' (too specific) 
        Activies are measured in quantifiable ways. Good examples include 'hours' (eg. hours worked in startup), 'times' (times meditated), 'kilometres' (kilometres ran), etc.
        Activities need a name, and a way to measure them.
        Activity entries are a materialization of activities need a date & quantity (e.g. worked 2h my startup X today maps to 1 activity 'work in startup X' and 1 activity entry for 'today' & '2 hours')
        Your goal is to expose this information through an engaging conversation.

        Rules:
        - Follow the conversation flow.
        - Talk directly and succintly.
        - Always address latest message comprehensively (if it has a greeting, greet back. if it has a question, answer it.)
        - Always answer in the language of the user.
        - If the user mentions generically mentions any project or event, get a brief description of it.

        Conversation flow graph:
        {conversation_graph}

        Current Time: {current_time}
        
        Here's your past conversation with the user:
        {self.memory.read_all_as_str(max_words=1000, max_age_in_minutes=24*60)}

        """

        logger.info(f"System: {system}")

        class ConversationStageReflection(TypedDict):
            questions: Dict[str, str]
            conclusion: str

        class ResponseModel(BaseModel):
            conversation_stage_reflection: str = Field(
                description=f"A dictionary of questions ({questions}) mapping to 'Yes' or 'No', "
                            "finishing with a 'conclusion' stating the current conversation stage. "
                            "Cannot be null."
            )
            reasoning: str = Field(
                description="Reflect how to address the user message based on your goals and conversation stage."
            )
            message_to_be_sent_to_the_user: str

        response = ask_schema(user_input, system, pymodel=ResponseModel)

        self.memory.write(
            Message.new(
                response.message_to_be_sent_to_the_user,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

        return response.message_to_be_sent_to_the_user
