from ai.clients import openai_client as client
from constants import LLM_MODEL
from datetime import datetime
from entities.message import Message
from entities.user import User
from ai.assistant.memory import Memory
from loguru import logger


class Assistant(object):
    def __init__(
        self,
        user: User,
        memory: Memory,
    ):
        self.name = "Mewtwo"
        self.memory = memory
        self.user = user

    def ask_text(self, text: str,) -> str:

        # todo: bind this to user timezone
        current_time = datetime.now().strftime("%H:%M")

        system = f"""
        You are {self.name}, a gentle assistant which sole goal is to get to know what high level tasks did the user do today (examples include work, exercise, reading, meditation, be with friends, etc. counter examples include low level tasks). Greet him by his name if its the first time talking today.
        Ask only one question max at at a time.
        
        Here's your past conversation with the user:
        {self.memory.read_all_as_str(max_words=2000, max_age_in_minutes=24*60)}

        Once the user has told you about his morning, afternoon, and evening activities up until {current_time}, you can end with a suitable inspiring quote and tell the user you wish to talk to him again tomorrow
        Focus on getting breadth of information about the day rather than depth about a specific task.

        """
        
        logger.info(f"Asking text: {text} to assistant with system {system}") 

        response = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": text}
        ],
        temperature=0.7,
        )
        return response.choices[0].message.content

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
        response = self.ask_text(user_input)

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
