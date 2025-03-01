from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from entities.user import User
from entities.message import Message, Emotion
from ai.assistant.memory import DatabaseMemory
from fastapi import WebSocket
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from datetime import datetime
from loguru import logger
from ai.suggestions import AssistantSuggestion

class BaseAssistant:
    def __init__(self, user: User, memory: DatabaseMemory, websocket: WebSocket = None):
        self.name = "Jarvis"
        self.user = user
        self.memory = memory
        self.websocket = websocket
        self.framework = None
        self.system_prompt = self.get_system_prompt()
        self.flowchart = self.get_flowchart()

    def get_system_prompt(self) -> str:
        """
        Get the system prompt for the assistant.
        This method should be overridden by child classes.
        """
        raise NotImplementedError("Subclasses must implement get_system_prompt()")

    def get_flowchart(self) -> Dict[str, Any]:
        """
        Get the flowchart for the assistant.
        This method should be overridden by child classes.
        """
        raise NotImplementedError("Subclasses must implement get_flowchart()")

    async def send_websocket_message(self, message_type: str, data: dict):
        """Send a message through the websocket if it exists."""
        if self.websocket:
            await self.websocket.send_json({"type": message_type, **data})

    def write_system_extraction_message(self, extraction_type: str, data: dict):
        """Write a system message about an extraction that occurred."""
        message = f"Extracted {extraction_type}: {str(data)}"
        self.memory.write(
            Message.new(
                text=message,
                sender_name="System",
                sender_id="-1",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
                emotions=[],
            )
        )

    def write_user_message(self, text: str, message_id: str, emotions: List[Emotion] = []):
        """Write a user message to memory."""
        self.memory.write(
            Message.new(
                id=message_id,
                text=text,
                sender_name=self.user.name,
                sender_id=self.user.id,
                recipient_name=self.name,
                recipient_id="0",
                emotions=emotions,
            )
        )

    def write_assistant_message(self, text: str):
        """Write an assistant message to memory."""
        self.memory.write(
            Message.new(
                text=text,
                sender_name=self.name,
                sender_id="0",
                recipient_name=self.user.name,
                recipient_id=self.user.id,
            )
        )

    def get_context(self) -> Dict[str, Any]:
        """
        Get the context for the framework run.
        This method can be overridden by child classes to provide additional context.
        """
        return {
            "current_datetime": f"Today is {datetime.now().strftime('%A, %Y-%m-%d')}.",
            "conversation_history": self.memory.read_all_as_str(max_age_in_minutes=3 * 60),
        }

    async def get_response(self, user_input: str, message_id: str, emotions: List[Emotion] = []) -> str:
        """Process user input and return a response."""
        # Write user message to memory
        self.write_user_message(user_input, message_id, emotions)

        # Initialize framework if not already done
        if not self.framework:
            self.framework = FlowchartLLMFramework(self.flowchart, self.system_prompt)

        try:
            # Get context and run framework
            context = self.get_context()
            result, extracted = await self.framework.run(context)

            # Write assistant's response to memory
            self.write_assistant_message(result)

            # Handle any suggestions from the extracted data
            suggestions = await self.handle_suggestions(extracted)
            if suggestions:
                await self.send_websocket_message(
                    "suggestions", {"suggestions": [s.dict() for s in suggestions]}
                )

            return result

        except Exception as e:
            logger.error(f"Error in get_response: {e}")
            raise

    async def handle_suggestions(self, extracted: Dict) -> List[AssistantSuggestion]:
        """
        Process extracted data and return suggestions.
        This method should be overridden by child classes if they need to handle suggestions.
        """
        return [] 