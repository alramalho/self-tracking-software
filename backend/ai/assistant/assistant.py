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

        system = f"""
        You are {self.name}, a friendly assistant sole goal is to help the user track himself by askinh how is he ad by getting him to say what did the the user do today in the morning, afteroon and evening. Actually in all parts of the day up to {current_time}. 

        Rules:
        - Follow the conversation flow.
        - Talk directly and succintly.
        - Always address latest message comprehensively (if it has a greeting, greet back. if it has a question, answer it.)
        - Always answer in the language of the user.
        - If the user mentions generically mentions any project or event, get a brief description of it.

        Conversation flow:
        - If its the very first time you are ever talking to the user (no prev messages), just introduce yourself, your goals with the user, and wait for his feedback before 'drilling' him with questions.
        - If its the first time you are taling to the user today (divider in the conversation), greet the user, make him at ease (i.e. make a initial exploratory question) by his name and very gently ask how happy is he feeling in a scale from 1 to 10. 
        - After the user rates how happy is he feeling frmo 1 to 10, ask why.
        - Ask questions that focus on getting breadth of information about the day rather than depth about a specific task. Any activiity must be uniquely identifiable though (e.g. 'work in a project' is too generic, 'work in my startup called X' is good, 'work in my startup X on the new feature for user signups' is too specific).
        - After an activity is shared, you must always ask for how does the user wants to measure for every mentioned activity (e.g. how many hours of work / kilometers of running / times OR minutes meditated, etc ). If its a new activity ask how does the user wants to measure it. (Existent user activities are {', '.join([str(a) for a in self.user_activities])})
        - Your message must naturally fit to contiue conversation history.
        
        Here's your past conversation with the user:
        {self.memory.read_all_as_str(max_words=1000, max_age_in_minutes=2*60)}

        """

        class ResponseModel(BaseModel):
            reasoning: str = Field(description="Your extensive reasoning on how to approach the user message given your instructions, the rules and conversation flow.")
            message: str = Field(description="Message to be sent to the user.")
        
        response = ask_schema(user_input, system, pymodel=ResponseModel)

        self.memory.write(
            Message.new(
                response.message,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

        return response.message
