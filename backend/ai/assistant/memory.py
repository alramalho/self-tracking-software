from abc import ABC, abstractmethod
from datetime import UTC, datetime, timedelta
from typing import List, Optional
from dateutil import parser

from loguru import logger
from entities.message import Message
from gateways.database.base import DBGateway
from shared.utils import time_ago

class Memory(ABC):
    @abstractmethod
    def write(self, message: Message):
        pass

    @abstractmethod
    def read_all(self, max_words: Optional[int] = None, max_age_in_minutes: int = 90, max_messages: int = None) -> List[Message]:
        pass

    @abstractmethod
    def read_all_as_str(self, max_words: Optional[int] = None, max_age_in_minutes: int = 90) -> str:
        pass

class ArrayMemory(Memory):
    def __init__(self, minimum_messages: int = 6, initial_messages: List[Message] = []):
        self.messages: List[Message] = initial_messages
        self.minimum_messages = minimum_messages

    def write(self, message: Message):
        logger.log("AGENT", f"Writing to memory ... {message.sender_name}: {message.text}")
        self.messages.append(message)

    def read_all(self, max_words: Optional[int] = None, max_age_in_minutes: int = 90) -> List[Message]:
        logger.log("AGENT", f"Reading all ({len(self.messages)} messages) from memory ...")
        filtered_messages = self._filter_messages(max_words, max_age_in_minutes)
        return filtered_messages

    def read_all_as_str(self, max_words: Optional[int] = None, max_age_in_minutes: int = 90, max_messages: int = None) -> str:
        filtered_messages = self.read_all(max_words, max_age_in_minutes)
        if max_messages is not None:
            filtered_messages = filtered_messages[-max_messages:]
        return self._format_messages_as_str(filtered_messages)

    def _filter_messages(self, max_words: Optional[int], max_age_in_minutes: int) -> List[Message]:
        current_time = datetime.now(UTC)
        filtered_messages = [
            m for m in self.messages
            if current_time - parser.parse(m.created_at) <= timedelta(minutes=max_age_in_minutes)
        ]

        if max_words is not None:
            filtered_messages = self._filter_by_word_count(filtered_messages, max_words)

        if len(filtered_messages) < self.minimum_messages:
            filtered_messages = self.messages[-self.minimum_messages:]

        return filtered_messages

    def _filter_by_word_count(self, messages: List[Message], max_words: int) -> List[Message]:
        filtered_messages = []
        cumulative_word_count = 0
        for message in reversed(messages):
            word_count = len(message.text.split())
            if cumulative_word_count + word_count <= max_words:
                filtered_messages.insert(0, message)
                cumulative_word_count += word_count
            else:
                break
        return filtered_messages

    def _format_messages_as_str(self, messages: List[Message]) -> str:
        today = datetime.now(UTC).date()
        formatted_messages = []
        today_divider_added = False

        for m in messages:
            message_date = parser.parse(m.created_at).date()
            if message_date == today and not today_divider_added:
                formatted_messages.append(f"--- Today ({today.strftime('%Y-%m-%d')}) ---")
                today_divider_added = True
            formatted_messages.append(f"{m.sender_name} ({time_ago(m.created_at)}): {m.text}")

        return "\n".join(formatted_messages)

class DatabaseMemory(Memory):
    def __init__(self, gateway: DBGateway, user_id: str, minimum_messages: int = 3):
        self.db_gateway = gateway
        self.user_id = user_id
        self.minimum_messages = minimum_messages

    def write(self, message: Message):
        self.db_gateway.write(message.dict())

    def read_all(self, max_words: Optional[int] = None, max_age_in_minutes: int = 90) -> List[Message]:
        all_messages = self._get_all_messages()
        filtered_messages = self._filter_messages(all_messages, max_words, max_age_in_minutes)
        return filtered_messages

    def read_all_as_str(self, max_words: Optional[int] = None, max_age_in_minutes: int = 90, max_messages: int = None) -> str:
        filtered_messages = self.read_all(max_words, max_age_in_minutes)
        if max_messages is not None:
            filtered_messages = filtered_messages[-max_messages:]
        return self._format_messages_as_str(filtered_messages, max_age_in_minutes)

    def _get_all_messages(self) -> List[Message]:
        sent_messages = [Message(**data) for data in self.db_gateway.query("sender_id", self.user_id)]
        received_messages = [Message(**data) for data in self.db_gateway.query("recipient_id", self.user_id)]
        all_messages = sent_messages + received_messages
        all_messages.sort(key=lambda x: x.created_at)
        return all_messages

    def _filter_messages(self, messages: List[Message], max_words: Optional[int], max_age_in_minutes: int) -> List[Message]:
        current_time = datetime.now(UTC)
        filtered_messages = [
            m for m in messages
            if current_time - parser.parse(m.created_at) <= timedelta(minutes=max_age_in_minutes)
        ]

        if max_words is not None:
            filtered_messages = self._filter_by_word_count(filtered_messages, max_words)

        if len(filtered_messages) < self.minimum_messages:
            filtered_messages = messages[-self.minimum_messages:]

        return filtered_messages

    def _filter_by_word_count(self, messages: List[Message], max_words: int) -> List[Message]:
        filtered_messages = []
        cumulative_word_count = 0
        for message in reversed(messages):
            word_count = len(message.text.split())
            if cumulative_word_count + word_count <= max_words:
                filtered_messages.insert(0, message)
                cumulative_word_count += word_count
            else:
                break
        return filtered_messages

    def _format_messages_as_str(self, messages: List[Message], max_age_in_minutes: int) -> str:
        today = datetime.now(UTC).date()
        formatted_messages = []
        today_divider_added = False

        if len(messages) < len(self._get_all_messages()):
            formatted_messages.append(f"... (older than {max_age_in_minutes} minutes messages omitted) ...")

        if len(messages) == 1: # means there's only user's first message
            formatted_messages.append("<no other messages in history>")

        for m in messages:
            message_date = parser.parse(m.created_at).date()
            if message_date == today and not today_divider_added:
                formatted_messages.append(f"--- Today ({today.strftime('%Y-%m-%d')}) ---")
                today_divider_added = True
            
            # Format message with emotions if present
            message_text = f"{m.sender_name} ({time_ago(m.created_at)}): {m.text}"
            if m.emotions:
                emotion_text = ", ".join([f"{e.name} ({e.score * 100:.0f}%)" for e in m.emotions])
                message_text += f" (user expressed {emotion_text} in this message)"
            
            formatted_messages.append(message_text)

        return "\n".join(formatted_messages)