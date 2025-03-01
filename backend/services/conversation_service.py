from typing import Tuple, List, Dict, Optional, Union, Type
from entities.user import User
from entities.activity import Activity, ActivityEntry
from entities.mood_report import MoodReport
from gateways.database.mongodb import MongoDBGateway
from ai.assistant.memory import DatabaseMemory
from ai.llm import ask_schema, ask_text
from datetime import datetime
from ai.assistant.activity_extractor import (
    ActivityExtractorAssistant,
    ExtractedActivityEntry,
)
from entities.plan import Plan
from services.hume_service import process_audio_with_hume
from constants import SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS, OPENAI_TTS_MODEL
from ai.assistant.plan_creation_assistant import PlanCreationAssistant
from ai.assistant.base_assistant import BaseAssistant

from gateways.activities import ActivitiesGateway
from gateways.users import UsersGateway
from gateways.moodreports import MoodsGateway
from gateways.messages import MessagesGateway
from pydantic import BaseModel, Field
import traceback
from ai import stt, tts
from loguru import logger
import asyncio
from fastapi import WebSocket
from bson import ObjectId
import base64

from shared.executor import executor
from gateways.users import UsersGateway
from services.notification_manager import NotificationManager
from entities.notification import Notification
from entities.message import Emotion
from controllers.plan_controller import PlanController
from analytics.posthog import posthog

users_gateway = UsersGateway()
activities_gateway = ActivitiesGateway()
moods_gateway = MoodsGateway()
plan_controller = PlanController()
messages_gateway = MessagesGateway()

# Map of assistant types
ASSISTANT_TYPES = {
    "plan_creation": PlanCreationAssistant,
    "activity_extraction": ActivityExtractorAssistant,
}

async def talk_with_assistant(
    user_id: str,
    user_input: str,
    assistant_type: str,
    websocket: WebSocket = None,
    message_id: str = None,
    emotions: List[Emotion] = [],
) -> str:
    try:
        user = users_gateway.get_user_by_id(user_id)
        memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user.id)

        # Get the appropriate assistant class
        AssistantClass = ASSISTANT_TYPES.get(assistant_type)
        if not AssistantClass:
            raise ValueError(f"Unknown assistant type: {assistant_type}")

        # Initialize the assistant
        assistant = AssistantClass(
            user=user,
            memory=memory,
            websocket=websocket,
        )

        return await assistant.get_response(
            user_input=user_input,
            message_id=message_id,
            emotions=emotions,
        )
    except Exception as e:
        logger.error(f"Error in talk_with_assistant: {e}")
        raise


async def process_message(
    websocket: WebSocket,
    user_id: str,
    message: str,
    assistant_type: str,
    input_mode: str,
    output_mode: str,
    audio_data: str = None,
    audio_format: str = None,
) -> Tuple[str, Optional[bytes]]:
    loop = asyncio.get_event_loop()
    emotions = []
    message_id = str(ObjectId())

    if input_mode == "voice" and audio_data and audio_format:
        # Perform STT and send intermediary transcription
        transcription = await loop.run_in_executor(
            executor, stt.speech_to_text, base64.b64decode(audio_data), audio_format
        )
        await websocket.send_json(
            {"type": "intermediary_transcription", "text": transcription}
        )
        message = transcription

        # Process emotion analysis with Hume
        try:
            emotions = await process_audio_with_hume(
                base64.b64decode(audio_data), audio_format, message_id
            )
            if emotions:
                top_emotions = emotions[:3]
                await websocket.send_json(
                    {
                        "type": "emotion_analysis",
                        "result": [emotion.dict() for emotion in top_emotions],
                    }
                )
        except Exception as e:
            logger.error(traceback.format_exc())
            logger.error(f"Error processing audio with Hume: {e}")
            emotions = []

    # Run talk_with_assistant in a separate thread
    text_response = await loop.run_in_executor(
        executor,
        lambda: asyncio.run(
            talk_with_assistant(
                user_id=user_id,
                user_input=message,
                assistant_type=assistant_type,
                websocket=websocket,
                message_id=message_id,
                emotions=emotions,
            )
        ),
    )

    audio_response = None
    if output_mode == "voice":
        audio_response = await loop.run_in_executor(
            executor, tts.text_to_speech, text_response, OPENAI_TTS_MODEL
        )

    return text_response, audio_response


def initiate_recurrent_checkin(user_id: str) -> Notification:
    notification_manager = NotificationManager()

    return notification_manager.create_scheduled_notification(
        user_id=user_id,
        prompt_tag="user-recurrent-checkin",
        recurrence="daily",
        time_deviation_in_hours=SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS,
    )


def get_recent_emotions(user_id: str) -> List[Emotion]:
    messages = messages_gateway.get_recent_sent_messages(
        user_id, max_age_in_minutes=60, max_count=3
    )
    logger.warning(f"Recent messages: {[str(m) for m in messages]}")
    emotions = []
    for message in messages:
        emotions.extend(message.emotions)
    return emotions
