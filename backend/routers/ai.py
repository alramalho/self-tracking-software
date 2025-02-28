from services.conversation_service import process_message, activities_gateway
from shared.executor import executor
from ai import stt
from starlette.types import ASGIApp
import time
from loguru import logger
import json
import base64
import traceback
from fastapi import WebSocket, Request, HTTPException, status, Form, UploadFile, File
from auth.clerk import is_clerk_user_ws
from auth.clerk import is_clerk_user_ws
from services.notification_manager import NotificationManager
from gateways.activities import ActivitiesGateway, ActivityEntryAlreadyExistsException
from gateways.messages import MessagesGateway
from entities.activity import ActivityEntry
from analytics.posthog import posthog
from ai.assistant.activity_extractor import ExtractedActivityEntry
from services.hume_service import EMOTION_COLORS, HUME_SCORE_FILTER_THRESHOLD
from constants import LLM_MODEL
from entities.message import Emotion
from gateways.database.mongodb import MongoDBGateway
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from entities.plan import PlanSession
from auth.clerk import is_clerk_user

from entities.user import User
from fastapi import APIRouter, Depends
import services.conversation_service as conversation_service
from multiprocessing import Process
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


@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("Connecting to websocket endpoint.")
    try:
        user = await is_clerk_user_ws(websocket)
        if user:
            await websocket.accept()

            # Create emotion polling task
            async def emotion_polling():
                while True:
                    await poll_emotions(websocket, user.id)
                    await asyncio.sleep(2)

            # Start emotion polling as a background task
            emotion_task = asyncio.create_task(emotion_polling())

            audio_buffer = bytearray()
            try:
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)

                    if message["action"] == "send_message":
                        start_time = time.time()
                        text = message.get("text", "")
                        input_mode = message.get("input_mode", "text")
                        output_mode = message.get("output_mode", "text")
                        audio_data = message.get("audio_data")
                        audio_format = message.get("audio_format")

                        text_response, audio_response = await process_message(
                            websocket,
                            user.id,
                            text,
                            input_mode,
                            output_mode,
                            audio_data,
                            audio_format,
                        )

                        # Calculate execution time
                        execution_time = time.time() - start_time

                        # Track latency based on input/output mode combination
                        event_name = (
                            f"ai-conversation-{input_mode}-to-{output_mode}-latency"
                        )

                        posthog.capture(
                            distinct_id=user.id,
                            event=event_name,
                            properties={
                                "latency_seconds": round(execution_time, 3),
                                "input_mode": input_mode,
                                "output_mode": output_mode,
                                "model": LLM_MODEL,
                            },
                        )

                        response_data = {
                            "type": "message",
                            "text": text_response,
                        }

                        if output_mode == "voice" and audio_response:
                            response_data["audio"] = base64.b64encode(
                                audio_response
                            ).decode("utf-8")

                        await websocket.send_json(response_data)

                        # if extracted_data and isinstance(extracted_data, list) and len(extracted_data) > 0:
                        #     data_type = "activities" if isinstance(extracted_data[0], ExtractedActivityEntry) else "next week sessions"
                        #     await websocket.send_json({
                        #         "type": "data_update",
                        #         "notification": f"Extracted {len(extracted_data)} new {data_type}. Check your notifications for more details.",
                        #     })

            except Exception as e:
                traceback.print_exc()
                logger.error(f"Error: {e}")
            finally:
                emotion_task.cancel()  # Cancel the polling task when connection closes
                await websocket.close()
        else:
            logger.error("Websocket authorization failed - no valid user")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except HTTPException as e:
        logger.error(f"Websocket authorization failed: {e.detail}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)


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
    memory.write(Message.new(
        text=message,
        sender_name="System",
        sender_id="-1",
        recipient_name=user.name,
        recipient_id=user.id,
        emotions=[],
    ))

    return {"status": "success"}


@router.post("/transcribe")
async def transcribe_audio(
    audio_data: str = Form(...),
    audio_format: str = Form(...),
    user: User = Depends(is_clerk_user)
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
