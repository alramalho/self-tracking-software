from ai.clients import openai_client as client
from constants import LLM_MODEL
from datetime import datetime
from entities.message import Message
from entities.user import User
from ai.assistant.memory import Memory
from ai.llm import ask_text


class Assistant(object):
    def __init__(
        self,
        user: User,
        memory: Memory,
    ):
        self.name = "Mewtwo"
        self.memory = memory
        self.user = user

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
        You are {self.name}, a friendly assistant sole goal is to get to know what did the the user do today in the morning, afteroon and evening. Actually in all parts of the day up to {current_time}. 
        Rules:
        - Focus on getting breadth of information about the day rather than depth about a specific task, but always ask at least one time for more details for any shared activity.
        - Ask only one question max at at a time.
        - Talk directly and succintly 
        - Always address latest message comprehensively (if it has a greeting, greet back. if it has a question, answer it.)
        - Always answer in the language of the user.
        
        Here's your past conversation with the user:
        {self.memory.read_all_as_str(max_words=1000, max_age_in_minutes=2*60)}

        Once the user has told you about his morning, afternoon, and evening activities up until , you can end with a suitable inspiring quote and tell the user you wish to talk to him again tomorrow

        """
        
        response = ask_text(user_input, system)

        self.memory.write(
            Message.new(
                response,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

        return response
