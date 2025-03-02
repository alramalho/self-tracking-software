# WebSocket close codes as defined in RFC 6455
WS_CLOSE_CODES = {
    1000: "Normal Closure",
    1001: "Going Away",
    1002: "Protocol Error",
    1003: "Unsupported Data",
    1004: "Reserved",
    1005: "No Status Received",
    1006: "Abnormal Closure",
    1007: "Invalid Frame Payload Data",
    1008: "Policy Violation",
    1009: "Message Too Big",
    1010: "Mandatory Extension",
    1011: "Internal Server Error",
    1012: "Service Restart",
    1013: "Try Again Later",
    1014: "Bad Gateway",
    1015: "TLS Handshake",
}

from services.conversation_service import process_message
from shared.executor import executor
from ai import stt
import time
from loguru import logger
import json
import base64
import traceback
from fastapi import WebSocket, Request, HTTPException, status, Form
from auth.clerk import is_clerk_user_ws
from bson import ObjectId
from auth.clerk import is_clerk_user_ws
from services.notification_manager import NotificationManager
from gateways.activities import ActivitiesGateway
from gateways.messages import MessagesGateway
from analytics.posthog import posthog
from services.hume_service import EMOTION_COLORS, HUME_SCORE_FILTER_THRESHOLD
from constants import LLM_MODEL, ENVIRONMENT
from entities.message import Emotion
from gateways.database.mongodb import MongoDBGateway
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from services.telegram_service import TelegramService
from datetime import datetime, UTC

from entities.user import User
from fastapi import APIRouter, Depends
import services.conversation_service as conversation_service
import asyncio

router = APIRouter(prefix="/ai")

activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()
messages_gateway = MessagesGateway()


async def poll_emotions(websocket: WebSocket, user_id: str):
    try:
        recent_emotions = conversation_service.get_recent_emotions(user_id)
        averaged_emotions = messages_gateway.average_emotions(recent_emotions)
        logger.warning(f"Recent emotions: {averaged_emotions}")
        if averaged_emotions:
            await websocket.send_json(
                {
                    "type": "emotion_analysis",
                    "result": [emotion.dict() for emotion in averaged_emotions],
                }
            )
    except Exception as e:
        logger.error(traceback.format_exc())
        logger.error(f"Error polling emotions: {e}")


async def log_websocket_error(
    user: Optional[User] = None,
    error_message: Optional[str] = None,
    error_code: Optional[int] = None,
    assistant_type: Optional[str] = None,
):
    """Helper function to log WebSocket errors"""
    try:
        # Get error code description if available
        error_code_description = (
            WS_CLOSE_CODES.get(error_code, "Unknown Code") if error_code else None
        )

        # Add context to the log
        context = {
            "user_clerk_id": user.clerk_id if user else "unknown",
            "user_username": user.username if user else "unknown",
            "error_message": error_message,
            "error_code": error_code,
            "assistant_type": assistant_type,
            "timestamp": datetime.now(UTC).isoformat(),
            "environment": ENVIRONMENT,
        }

        # Log to regular logging system
        logger.error("WebSocket Error", extra=context)

        # Track in PostHog
        posthog.capture(
            distinct_id=user.id if user else "unknown", event="websocket_error", properties=context
        )

        # Send error notification to Telegram
        error_detail = (
            f"Code {error_code} ({error_code_description})" if error_code else "unknown"
        )
        telegram = TelegramService()
        telegram.send_websocket_error_notification(
            error_message=f"WebSocket error: {error_message} - {error_detail}",
            user_username=user.username if user else "unknown",
            user_id=user.clerk_id if user else "unknown",
            path=f"/ai/connect-{assistant_type}" if assistant_type else "unknown",
        )
    except Exception as e:
        logger.error(f"Failed to log WebSocket error: {e}")
        logger.error(traceback.format_exc())


async def emotion_polling(websocket: WebSocket, user: User, assistant_type: str):
    while True:
        try:
            await poll_emotions(websocket, user.id)
            await asyncio.sleep(3)
        except Exception as e:
            logger.error(f"Error polling emotions: {e}")
            logger.error(traceback.format_exc())
            telegram = TelegramService()
            telegram.send_websocket_error_notification(
                error_message=f"Error polling emotions: {e}",
                user_username=user.username,
                user_id=user.clerk_id,
                path=f"/ai/connect-{assistant_type}",
            )


async def handle_websocket_connection(websocket: WebSocket, assistant_type: str):
    """Common websocket handling logic for all assistant types."""
    logger.info(f"Connecting to {assistant_type} websocket endpoint.")
    user = None
    try:
        user = await is_clerk_user_ws(websocket)

    except Exception as e:
        await log_websocket_error(
            None, str(f"Could not validate user credentials: {e}"), None, assistant_type
        )
        traceback.print_exc()
        logger.error(f"Error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if not user:
        await log_websocket_error(
            user, str(f"Could not validate user credentials: {e}"), None, assistant_type
        )
        traceback.print_exc()
        logger.error(f"Error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    # Start emotion polling as a background task
    emotion_task = asyncio.create_task(emotion_polling(websocket, user, assistant_type))
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message["action"] == "send_message":
                text = message.get("text", "")
                input_mode = message.get("input_mode", "text")
                output_mode = message.get("output_mode", "text")
                audio_data = message.get("audio_data")
                audio_format = message.get("audio_format")

                text_response, audio_response = await process_message(
                    websocket,
                    user.id,
                    text,
                    assistant_type,
                    input_mode,
                    output_mode,
                    audio_data,
                    audio_format,
                )

                response_data = {
                    "type": "message",
                    "text": text_response,
                }

                if output_mode == "voice" and audio_response:
                    response_data["audio"] = base64.b64encode(audio_response).decode(
                        "utf-8"
                    )

                await websocket.send_json(response_data)

    except Exception as e:
        error_msg = f"WebSocket authorization failed: {e.detail if hasattr(e, 'detail') else str(e)}"
        await log_websocket_error(
            user, error_msg, status.WS_1008_POLICY_VIOLATION, assistant_type
        )
        logger.error(error_msg)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    finally:
        emotion_task.cancel()  # Cancel the polling task when connection closes
        await websocket.close()


@router.websocket("/connect-plan-creation")
async def websocket_plan_creation_endpoint(websocket: WebSocket):
    await handle_websocket_connection(websocket, "plan_creation")


@router.websocket("/connect-metrics-companion")
async def websocket_metrics_companion_endpoint(websocket: WebSocket):
    await handle_websocket_connection(websocket, "metrics_companion")


@router.websocket("/connect-activity-extraction")
async def websocket_activity_extraction_endpoint(websocket: WebSocket):
    await handle_websocket_connection(websocket, "activity_extraction")


class HumeEmotion(BaseModel):
    name: str
    score: float


class HumePrediction(BaseModel):
    text: str
    time: Dict[str, float]
    confidence: Optional[float]
    speaker_confidence: Optional[float]
    emotions: List[HumeEmotion]


class HumeGroupedPrediction(BaseModel):
    id: str
    predictions: List[HumePrediction]


class HumeProsodyModel(BaseModel):
    metadata: Dict[str, Any]
    grouped_predictions: List[HumeGroupedPrediction]


class HumeModels(BaseModel):
    prosody: HumeProsodyModel


class HumeFileResult(BaseModel):
    file: str
    file_type: str
    models: HumeModels


class HumeResults(BaseModel):
    predictions: List[HumeFileResult]
    errors: List[Any]


class HumeSource(BaseModel):
    type: str
    filename: str
    content_type: str
    md5sum: str


class HumePredictionWrapper(BaseModel):
    source: HumeSource
    results: HumeResults


class HumeCallbackData(BaseModel):
    job_id: str
    status: str
    predictions: List[HumePredictionWrapper]


def process_hume_results(predictions: List[HumePredictionWrapper]) -> List[Emotion]:
    all_emotions = []

    for prediction in predictions:
        for pred in prediction.results.predictions:
            for group in pred.models.prosody.grouped_predictions:
                for pred in group.predictions:
                    emotions = [
                        Emotion(
                            name=e.name,
                            score=e.score,
                            color=EMOTION_COLORS.get(e.name, "#000000"),
                        )
                        for e in pred.emotions
                    ]
                    all_emotions.extend(emotions)

    # Average scores for same emotions
    emotion_dict = {}
    for emotion in all_emotions:
        if emotion.name in emotion_dict:
            emotion_dict[emotion.name].append(emotion.score)
        else:
            emotion_dict[emotion.name] = [emotion.score]

    # Create final emotion list with averaged scores
    all_averaged_emotions = [
        Emotion(
            name=name,
            score=sum(scores) / len(scores),
            color=EMOTION_COLORS.get(name, "#000000"),
        )
        for name, scores in emotion_dict.items()
    ]

    # Sort all emotions by score
    sorted_emotions = sorted(all_averaged_emotions, key=lambda x: x.score, reverse=True)

    # Filter by threshold, if none pass return just the highest scoring emotion
    final_emotions = [
        e for e in sorted_emotions if e.score >= HUME_SCORE_FILTER_THRESHOLD
    ]
    if not final_emotions and sorted_emotions:
        final_emotions = [sorted_emotions[0]]

    return final_emotions


@router.post("/hume-callback/{message_id}")
async def hume_callback(message_id: str, request: Request):
    data = await request.json()
    logger.info(f"Received Hume callback for message {message_id}: {data}")

    try:
        # Parse and validate the data
        callback_data = HumeCallbackData(**data)

        # Check job status
        if callback_data.status != "COMPLETED":
            return {
                "status": "error",
                "message": f"Job not completed, status: {callback_data.status}",
            }

        # Process emotions from predictions
        emotions = process_hume_results(callback_data.predictions)

        # Get the specific message from the database
        message = messages_gateway.get_message_by_id(message_id)

        if not message:
            return {"status": "error", "message": f"Message {message_id} not found"}

        message.emotions = [emotion.dict() for emotion in emotions]

        # Update the message in the database
        messages_gateway.update_message(message)

        logger.info(f"Updated message {message_id} with emotions: {emotions}")
        return {"status": "success"}

    except Exception as e:
        logger.error(f"Error processing Hume callback: {e}")
        logger.error(traceback.format_exc())
        return {"status": "error", "message": str(e)}


@router.post("/send-system-message")
async def send_system_message(request: Request, user: User = Depends(is_clerk_user)):
    from ai.assistant.memory import Memory, DatabaseMemory
    from entities.message import Message

    data = await request.json()
    message = data["message"]

    memory = DatabaseMemory(MongoDBGateway("messages"), user.id)
    memory.write(
        Message.new(
            text=message,
            sender_name="System",
            sender_id="-1",
            recipient_name=user.name,
            recipient_id=user.id,
            emotions=[],
        )
    )

    return {"status": "success"}


@router.post("/transcribe")
async def transcribe_audio(
    audio_data: str = Form(...),
    audio_format: str = Form(...),
    user: User = Depends(is_clerk_user),
):
    try:
        # Decode base64 audio data
        audio_bytes = base64.b64decode(audio_data)

        # Run transcription in executor to not block
        text = await asyncio.get_event_loop().run_in_executor(
            executor, stt.speech_to_text, audio_bytes, audio_format
        )

        return {"text": text}
    except Exception as e:
        logger.error(f"Error in transcription: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/generate-activity-message")
async def generate_activity_message(user: User = Depends(is_clerk_user)):
    from ai.assistant.activity_page_message_generator import ActivityMessageGenerator
    from ai.assistant.memory import DatabaseMemory
    from gateways.database.mongodb import MongoDBGateway

    try:
        # Initialize memory and message generator
        memory = DatabaseMemory(MongoDBGateway("messages"), user.id)
        generator = ActivityMessageGenerator(user=user, memory=memory)
        # Generate the message
        message = await generator.get_response(
            user_input="", message_id=str(ObjectId())
        )

        response_message_id = messages_gateway.get_latest_ai_message(user.id).id
        if not response_message_id:
            raise HTTPException(status_code=500, detail="No response message id found")

        return {"message": message, "message_id": response_message_id}
    except Exception as e:
        logger.error(f"Error generating activity message: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/generate-metrics-dashboard-message")
async def generate_metrics_dashboard_message(user: User = Depends(is_clerk_user)):
    from ai.assistant.metrics_dashboard_message_generator import (
        MetricsDashboardMessageGenerator,
    )
    from ai.assistant.memory import DatabaseMemory
    from gateways.database.mongodb import MongoDBGateway
    from gateways.metrics import MetricsGateway

    try:
        # Initialize memory and message generator
        memory = DatabaseMemory(MongoDBGateway("messages"), user.id)
        metrics_gateway = MetricsGateway()
        metrics = metrics_gateway.get_all_metrics_by_user_id(user.id)
        generator = MetricsDashboardMessageGenerator(
            user=user, memory=memory, user_metrics=metrics
        )
        # Generate the message
        message = await generator.get_response(
            user_input="", message_id=str(ObjectId())
        )

        response_message_id = messages_gateway.get_latest_ai_message(user.id).id
        if not response_message_id:
            raise HTTPException(status_code=500, detail="No response message id found")

        return {"message": message, "message_id": response_message_id}
    except Exception as e:
        logger.error(f"Error generating metrics dashboard message: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/generate-plan-message")
async def generate_plan_message(user: User = Depends(is_clerk_user)):
    from ai.assistant.plan_page_message_generator import PlanMessageGenerator
    from ai.assistant.memory import DatabaseMemory
    from gateways.database.mongodb import MongoDBGateway

    try:
        # Initialize memory and message generator
        memory = DatabaseMemory(MongoDBGateway("messages"), user.id)
        generator = PlanMessageGenerator(user=user, memory=memory)

        # Generate the message
        message = await generator.get_response(
            user_input="", message_id=str(ObjectId())
        )

        response_message_id = messages_gateway.get_latest_ai_message(user.id).id
        if not response_message_id:
            raise HTTPException(status_code=500, detail="No response message id found")

        return {"message": message, "message_id": response_message_id}
    except Exception as e:
        logger.error(f"Error generating plan message: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
