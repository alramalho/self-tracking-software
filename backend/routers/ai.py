# WebSocket close codes as defined in RFC 6455
from shared.logger import create_logger
create_logger()

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

from gateways.database.dynamodb import DynamoDBGateway
from services.conversation_service import process_message
from shared.executor import executor
from typing import Tuple
from ai import stt
from controllers.plan_controller import PlanController
from pydantic import BaseModel, Field
from entities.activity import ActivityEntry
from ai.assistant.activity_extractor_simple import ActivityExtractorAssistant
from ai.assistant.metrics_companion_assistant_simple import MetricsCompanionAssistant
from ai.assistant.plan_creation_assistant import PlanCreationAssistant
from ai.assistant.plan_creation_assistant_simple import (
    PlanCreationAssistant as PlanCreationAssistantSimple,
)
from entities.message import Message
from ai.llm import ask_schema_async, ask_text_async
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from entities.metric import MetricEntry
import time
from loguru import logger
import json
import base64
import traceback
from fastapi import WebSocket, Request, HTTPException, status, Form, UploadFile, File
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
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from services.telegram_service import TelegramService
from datetime import datetime, UTC

from entities.user import User
from fastapi import APIRouter, Depends
import services.conversation_service as conversation_service
import asyncio
from gateways.users import UsersGateway

router = APIRouter(prefix="/ai")

activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()
messages_gateway = MessagesGateway()
users_gateway = UsersGateway()


# async def poll_emotions(websocket: WebSocket, user_id: str):
#     try:
#         recent_emotions = conversation_service.get_recent_emotions(user_id)
#         averaged_emotions = messages_gateway.average_emotions(recent_emotions)
#         logger.warning(f"Recent emotions: {averaged_emotions}")
#         if averaged_emotions:
#             await websocket.send_json(
#                 {
#                     "type": "emotion_analysis",
#                     "result": [emotion.dict() for emotion in averaged_emotions],
#                 }
#             )
#     except Exception as e:
#         logger.error(traceback.format_exc())
#         logger.error(f"Error polling emotions: {e}")


# async def log_websocket_error(
#     user: Optional[User] = None,
#     error_message: Optional[str] = None,
#     error_code: Optional[int] = None,
#     assistant_type: Optional[str] = None,
# ):
#     """Helper function to log WebSocket errors"""
#     try:
#         # Get error code description if available
#         error_code_description = (
#             WS_CLOSE_CODES.get(error_code, "Unknown Code") if error_code else None
#         )

#         # Add context to the log
#         context = {
#             "user_clerk_id": user.clerk_id if user else "unknown",
#             "user_username": user.username if user else "unknown",
#             "error_message": error_message,
#             "error_code": error_code,
#             "assistant_type": assistant_type,
#             "timestamp": datetime.now(UTC).isoformat(),
#             "environment": ENVIRONMENT,
#         }

#         # Log to regular logging system
#         logger.error("WebSocket Error", extra=context)

#         # Track in PostHog
#         posthog.capture(
#             distinct_id=user.id if user else "unknown",
#             event="websocket_error",
#             properties=context,
#         )

#         # Send error notification to Telegram
#         error_detail = (
#             f"Code {error_code} ({error_code_description})" if error_code else "unknown"
#         )
#         telegram = TelegramService()
#         telegram.send_websocket_error_notification(
#             error_message=f"WebSocket error: {error_message} - {error_detail}",
#             user_username=user.username if user else "unknown",
#             user_id=user.clerk_id if user else "unknown",
#             path=f"/ai/connect-{assistant_type}" if assistant_type else "unknown",
#         )
#     except Exception as e:
#         logger.error(f"Failed to log WebSocket error: {e}")
#         logger.error(traceback.format_exc())


# async def emotion_polling(websocket: WebSocket, user: User, assistant_type: str):
#     while True:
#         try:
#             await poll_emotions(websocket, user.id)
#             await asyncio.sleep(3)
#         except Exception as e:
#             logger.error(f"Error polling emotions: {e}")
#             logger.error(traceback.format_exc())
#             telegram = TelegramService()
#             telegram.send_websocket_error_notification(
#                 error_message=f"Error polling emotions: {e}",
#                 user_username=user.username,
#                 user_id=user.clerk_id,
#                 path=f"/ai/connect-{assistant_type}",
#             )


# async def handle_websocket_connection(websocket: WebSocket, assistant_type: str):
#     """Common websocket handling logic for all assistant types."""
#     logger.info(f"Connecting to {assistant_type} websocket endpoint.")
#     user = None
#     try:
#         user = await is_clerk_user_ws(websocket)

#     except Exception as e:
#         await log_websocket_error(
#             None, str(f"Could not validate user credentials: {e}"), None, assistant_type
#         )
#         traceback.print_exc()
#         logger.error(f"Error: {e}")
#         await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
#         return
#     if not user:
#         await log_websocket_error(
#             user, str(f"Could not validate user credentials: {e}"), None, assistant_type
#         )
#         traceback.print_exc()
#         logger.error(f"Error: {e}")
#         await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
#         return

#     await websocket.accept()

#     # Start emotion polling as a background task
#     emotion_task = asyncio.create_task(emotion_polling(websocket, user, assistant_type))

#     try:
#         while True:
#             data = await websocket.receive_text()
#             message = json.loads(data)

#             if message["action"] == "send_message":
#                 text = message.get("text", "")
#                 input_mode = message.get("input_mode", "text")
#                 output_mode = message.get("output_mode", "text")
#                 audio_data = message.get("audio_data")
#                 audio_format = message.get("audio_format")

#                 text_response, audio_response = await process_message(
#                     websocket,
#                     user.id,
#                     text,
#                     assistant_type,
#                     input_mode,
#                     output_mode,
#                     audio_data,
#                     audio_format,
#                 )

#                 response_data = {
#                     "type": "message",
#                     "text": text_response,
#                 }

#                 if output_mode == "voice" and audio_response:
#                     response_data["audio"] = base64.b64encode(audio_response).decode(
#                         "utf-8"
#                     )

#                 await websocket.send_json(response_data)

#     except Exception as e:
#         error_msg = f"WebSocket authorization failed: {e.detail if hasattr(e, 'detail') else str(e)}"
#         await log_websocket_error(
#             user, error_msg, status.WS_1008_POLICY_VIOLATION, assistant_type
#         )
#         logger.error(error_msg)
#         await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
#     finally:
#         emotion_task.cancel()  # Cancel the polling task when connection closes
#         await websocket.close()


# @router.websocket("/connect-plan-creation")
# async def websocket_plan_creation_endpoint(websocket: WebSocket):
#     await handle_websocket_connection(websocket, "plan_creation")


# @router.websocket("/connect-metrics-companion")
# async def websocket_metrics_companion_endpoint(websocket: WebSocket):
#     await handle_websocket_connection(websocket, "metrics_companion")


# @router.websocket("/connect-activity-extraction")
# async def websocket_activity_extraction_endpoint(websocket: WebSocket):
#     await handle_websocket_connection(websocket, "activity_extraction")


# class HumeEmotion(BaseModel):
#     name: str
#     score: float


# class HumePrediction(BaseModel):
#     text: str
#     time: Dict[str, float]
#     confidence: Optional[float]
#     speaker_confidence: Optional[float]
#     emotions: List[HumeEmotion]


# class HumeGroupedPrediction(BaseModel):
#     id: str
#     predictions: List[HumePrediction]


# class HumeProsodyModel(BaseModel):
#     metadata: Dict[str, Any]
#     grouped_predictions: List[HumeGroupedPrediction]


# class HumeModels(BaseModel):
#     prosody: HumeProsodyModel


# class HumeFileResult(BaseModel):
#     file: str
#     file_type: str
#     models: HumeModels


# class HumeResults(BaseModel):
#     predictions: List[HumeFileResult]
#     errors: List[Any]


# class HumeSource(BaseModel):
#     type: str
#     filename: str
#     content_type: str
#     md5sum: str


# class HumePredictionWrapper(BaseModel):
#     source: HumeSource
#     results: HumeResults


# class HumeCallbackData(BaseModel):
#     job_id: str
#     status: str
#     predictions: List[HumePredictionWrapper]


# def process_hume_results(predictions: List[HumePredictionWrapper]) -> List[Emotion]:
#     all_emotions = []

#     for prediction in predictions:
#         for pred in prediction.results.predictions:
#             for group in pred.models.prosody.grouped_predictions:
#                 for pred in group.predictions:
#                     emotions = [
#                         Emotion(
#                             name=e.name,
#                             score=e.score,
#                             color=EMOTION_COLORS.get(e.name, "#000000"),
#                         )
#                         for e in pred.emotions
#                     ]
#                     all_emotions.extend(emotions)

#     # Average scores for same emotions
#     emotion_dict = {}
#     for emotion in all_emotions:
#         if emotion.name in emotion_dict:
#             emotion_dict[emotion.name].append(emotion.score)
#         else:
#             emotion_dict[emotion.name] = [emotion.score]

#     # Create final emotion list with averaged scores
#     all_averaged_emotions = [
#         Emotion(
#             name=name,
#             score=sum(scores) / len(scores),
#             color=EMOTION_COLORS.get(name, "#000000"),
#         )
#         for name, scores in emotion_dict.items()
#     ]

#     # Sort all emotions by score
#     sorted_emotions = sorted(all_averaged_emotions, key=lambda x: x.score, reverse=True)

#     # Filter by threshold, if none pass return just the highest scoring emotion
#     final_emotions = [
#         e for e in sorted_emotions if e.score >= HUME_SCORE_FILTER_THRESHOLD
#     ]
#     if not final_emotions and sorted_emotions:
#         final_emotions = [sorted_emotions[0]]

#     return final_emotions


# @router.post("/hume-callback/{message_id}")
# async def hume_callback(message_id: str, request: Request):
#     data = await request.json()
#     logger.info(f"Received Hume callback for message {message_id}: {data}")

#     try:
#         # Parse and validate the data
#         callback_data = HumeCallbackData(**data)

#         # Check job status
#         if callback_data.status != "COMPLETED":
#             return {
#                 "status": "error",
#                 "message": f"Job not completed, status: {callback_data.status}",
#             }

#         # Process emotions from predictions
#         emotions = process_hume_results(callback_data.predictions)

#         # Get the specific message from the database
#         message = messages_gateway.get_message_by_id(message_id)

#         if not message:
#             return {"status": "error", "message": f"Message {message_id} not found"}

#         message.emotions = [emotion.dict() for emotion in emotions]

#         # Update the message in the database
#         messages_gateway.update_message(message)

#         logger.info(f"Updated message {message_id} with emotions: {emotions}")
#         return {"status": "success"}

#     except Exception as e:
#         logger.error(f"Error processing Hume callback: {e}")
#         logger.error(traceback.format_exc())
#         return {"status": "error", "message": str(e)}


# @router.post("/send-system-message")
# async def send_system_message(request: Request, user: User = Depends(is_clerk_user)):
#     from ai.assistant.memory import Memory, DatabaseMemory
#     from entities.message import Message

#     data = await request.json()
#     message = data["message"]

#     memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
#     memory.write(
#         Message.new(
#             text=message,
#             sender_name="System",
#             sender_id="-1",
#             recipient_name=user.name,
#             recipient_id=user.id,
#             emotions=[],
#         )
#     )

#     return {"status": "success"}


@router.post("/transcribe")
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    audio_format: str = Form(...),
):
    try:
        # Read the audio file content
        audio_bytes = await audio_file.read()

        # Run transcription in executor to not block
        text = await asyncio.get_event_loop().run_in_executor(
            executor, stt.speech_to_text, audio_bytes, audio_format
        )

        return {"text": text}
    except Exception as e:
        logger.error(f"Error in transcription: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# @router.get("/generate-activity-message")
# async def generate_activity_message(user: User = Depends(is_clerk_user)):
#     from ai.assistant.activity_page_message_generator import ActivityMessageGenerator
#     from ai.assistant.memory import DatabaseMemory
#     from gateways.database.mongodb import MongoDBGateway

#     try:
#         # Initialize memory and message generator
#         memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
#         generator = ActivityMessageGenerator(user=user, memory=memory)
#         # Generate the message
#         message, _ = await generator.get_response(
#             user_input="", message_id=str(ObjectId())
#         )

#         response_message_id = messages_gateway.get_latest_ai_message(user.id).id
#         if not response_message_id:
#             raise HTTPException(status_code=500, detail="No response message id found")

#         return {"message": message, "message_id": response_message_id}
#     except Exception as e:
#         logger.error(f"Error generating activity message: {e}")
#         logger.error(traceback.format_exc())
#         raise HTTPException(status_code=500, detail=str(e))


# @router.get("/generate-metrics-dashboard-message")
# async def generate_metrics_dashboard_message(user: User = Depends(is_clerk_user)):
#     from ai.assistant.metrics_dashboard_message_generator import (
#         MetricsDashboardMessageGenerator,
#     )
#     from ai.assistant.memory import DatabaseMemory
#     from gateways.database.mongodb import MongoDBGateway
#     from gateways.metrics import MetricsGateway

#     try:
#         # Initialize memory and message generator
#         memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
#         metrics_gateway = MetricsGateway()
#         metrics = metrics_gateway.get_all_metrics_by_user_id(user.id)
#         generator = MetricsDashboardMessageGenerator(
#             user=user, memory=memory, user_metrics=metrics
#         )
#         # Generate the message
#         message, _ = await generator.get_response(
#             user_input="", message_id=str(ObjectId())
#         )

#         response_message_id = messages_gateway.get_latest_ai_message(user.id).id
#         if not response_message_id:
#             raise HTTPException(status_code=500, detail="No response message id found")

#         return {"message": message, "message_id": response_message_id}
#     except Exception as e:
#         logger.error(f"Error generating metrics dashboard message: {e}")
#         logger.error(traceback.format_exc())
#         raise HTTPException(status_code=500, detail=str(e))


# @router.get("/generate-plan-message")
# async def generate_plan_message(user: User = Depends(is_clerk_user)):
#     from ai.assistant.plan_page_message_generator import PlanMessageGenerator
#     from ai.assistant.memory import DatabaseMemory
#     from gateways.database.mongodb import MongoDBGateway

#     try:
#         # Initialize memory and message generator
#         memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
#         generator = PlanMessageGenerator(user=user, memory=memory)

#         # Generate the message
#         message, _ = await generator.get_response(
#             user_input="", message_id=str(ObjectId())
#         )

#         response_message_id = messages_gateway.get_latest_ai_message(user.id).id
#         if not response_message_id:
#             raise HTTPException(status_code=500, detail="No response message id found")

#         return {"message": message, "message_id": response_message_id}
#     except Exception as e:
#         logger.error(f"Error generating plan message: {e}")
#         logger.error(traceback.format_exc())
#         raise HTTPException(status_code=500, detail=str(e))


@router.post("/get-past-week-logging-extractions")
async def get_past_week_logging_extractions(
    request: Request, user: User = Depends(is_clerk_user)
):

    try:
        body = await request.json()
        ai_message = body["ai_message"]
        message = body["message"]
        question_checks = body["question_checks"]

        memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)

        memory.write(
            Message.new(
                text=ai_message,
                sender_name="Jarvis",
                sender_id="0",
                recipient_name=user.name,
                recipient_id=user.id,
            )
        )

        memory.write(
            Message.new(
                text=message,
                sender_name=user.name,
                sender_id=user.id,
                recipient_name="Jarvis",
                recipient_id="0",
                emotions=[],
            )
        )

        extractor = ActivityExtractorAssistant(user=user, memory=memory)

        extractor.write_assistant_message(
            ai_message
        )  # We just need to do this once, as they have shared memory!

        # Create tasks for parallel execution
        activities_task = extractor.get_response(
            user_input=message, message_id=str(ObjectId()), manual_memory_management=True
        )

        class QuestionAnalysisSchema(BaseModel):
            question: str = Field(
                ...,
                description="The question that the user should answer.",
            )
            reasoning: str = Field(
                ...,
                description="The step by step reasoning regarding the question and whether the conversation contains information to answer the question.",
            )
            decision: bool = Field(
                ..., description="The boolean representing the decisions (true if there is sufficient information, false otherwise).",
            )

        class QuestionChecksSchema(BaseModel):
            analysis: List[QuestionAnalysisSchema] = Field(
                description="The analysis of each question and user message.",
            )

        conversation_history = memory.read_all_as_str(max_age_in_minutes=30)

        question_checks_task = ask_schema_async(
            text=f"Analyse the interaction {conversation_history} and determine whether it contains information to answer all the questions: {list(question_checks.values())}",
            system="You are a friendly AI assistant.",
            pymodel=QuestionChecksSchema,
        )


        # Wait for all tasks to complete
        activities_result, questions_checks_result = (
            await asyncio.gather(activities_task, question_checks_task)
        )

        question_checks_keys = list(question_checks.keys())
        question_results = {
            question_checks_keys[i]: questions_checks_result.analysis[i].decision
            for i in range(len(question_checks_keys))
        }
        unanswered_questions = [q for q, answered in question_results.items() if not answered]
        
        message = await ask_text_async(
            text=f"""Based on the conversation history: {conversation_history}
                    And the question check results where:
                    - Answered questions: {[q for q, answered in question_results.items() if answered]}
                    - Unanswered questions: {unanswered_questions}
                    
                    Generate an appropriate short message to the user.
                    If there are unanswered questions, kindly ask for those specific pieces of information.
                    If there are questions are answered, thank the user. 
                    If it is a mix, acknowledge the given information and ask for the missing information.""",
            system="You are a friendly AI assistant.",
        )

        # Unpack the results
        _, extracted_activities_entries = activities_result
        extracted_question_analysis = questions_checks_result
        activity_entries = [a.data["entry"] for a in extracted_activities_entries if "entry" in a.data]

        
        result = {
            "message": message,
            "question_checks": {
                question_checks_keys[i]: extracted_question_analysis.analysis[i].decision
                for i in range(len(question_checks_keys))
            },
        }

        if len(activity_entries) > 0:
            result["activity_entries"] = activity_entries

        return result
    except Exception as e:
        logger.error(f"Error getting daily checkin extractions: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post("/get-daily-checkin-extractions")
async def get_daily_checkin_extractions(
    request: Request, user: User = Depends(is_clerk_user)
):

    try:
        body = await request.json()
        ai_message = body["ai_message"]
        message = body["message"]
        question_checks = body["question_checks"]

        memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)

        extractor = ActivityExtractorAssistant(user=user, memory=memory)
        metrics_companion = MetricsCompanionAssistant(user=user, memory=memory)

        extractor.write_assistant_message(
            ai_message
        )  # We just need to do this once, as they have shared memory!
        extractor.write_user_message(
            message,
            message_id=str(ObjectId())
        )
        # Create tasks for parallel execution
        activities_task = extractor.get_response(
            user_input=message, message_id=str(ObjectId()), manual_memory_management=True
        )
        metrics_task = metrics_companion.get_response(
            user_input=message, message_id=str(ObjectId()), manual_memory_management=True
        )

        class ResponseSchema(BaseModel):
            reasoning: str = Field(
                ...,
                description="Your question by question extensive step by step reasoning.",
            )
            decisions: List[bool] = Field(
                ...,
                description="A list of boolean values, indicating whether the user message contains information to the question (should have same order as the questions)",
            )

        schema_task = ask_schema_async(
            text=f"Does the following message '{message}' contain information to all the questions: {list(question_checks.values())}",
            system="",
            pymodel=ResponseSchema,
            model=LLM_MODEL,
        )

        plan_controller = PlanController()
        all_plans = plan_controller.get_all_user_active_plans(user)
        user_profile = None
        if len(all_plans) > 0:
            user_profile = f"User has a the goal of {all_plans[0].goal}"
        else:
            user_profile = "User has the desire to be happy."

        text_task = ask_text_async(
            text=f"Based on the user profile {user_profile} and the message '{message}', generate a motivational short message. Avoid overly optimistic tone.",
            system="",
            model=LLM_MODEL,
        )

        # Wait for all tasks to complete
        activities_result, metrics_result, schema_response, motivational_message = (
            await asyncio.gather(activities_task, metrics_task, schema_task, text_task)
        )

        # Unpack the results
        activities_message, extracted_activities_entries = activities_result
        metrics_message, extracted_metrics_entries = metrics_result

        question_checks_keys = list(question_checks.keys())

        return {
            "question_checks": {
                question_checks_keys[i]: schema_response.decisions[i]
                for i in range(len(question_checks_keys))
            },
            "message": motivational_message,
            "metric_entries": [
                m.data["entry"] for m in extracted_metrics_entries if "entry" in m.data
            ],
            "activity_entries": [
                a.data["entry"]
                for a in extracted_activities_entries
                if "entry" in a.data
            ],
            "response": schema_response.reasoning,
        }
    except Exception as e:
        logger.error(f"Error getting daily checkin extractions: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject-daily-checkin")
async def reject_daily_checkin(request: Request, user: User = Depends(is_clerk_user)):
    body = await request.json()
    message = body["message"]
    activity_entries = body["activity_entries"]
    metric_entries = body["metric_entries"]
    rejection_feedback = body["rejection_feedback"]

    telegram = TelegramService()
    telegram.send_daily_checkin_rejection_notification(
        user_username=user.username,
        user_id=user.id,
        message=message,
        activity_entries=[
            ActivityEntry.new(
                id=a["id"],
                activity_id=a["activity_id"],
                user_id=user.id,
                quantity=a["quantity"],
                date=a["date"],
            )
            for a in activity_entries
        ],
        metric_entries=[
            MetricEntry.new(
                id=m["id"],
                user_id=user.id,
                metric_id=m["metric_id"],
                rating=m["rating"],
                date=m["date"],
            )
            for m in metric_entries
        ],
        rejection_feedback=rejection_feedback,
    )

    return {"status": "success"}


@router.post("/update-user-profile-from-questions")
async def update_profile(request: Request, user: User = Depends(is_clerk_user)):
    try:
        body = await request.json()
        question_checks = body["question_checks"]
        message = body["message"]
        question_checks_keys = list(question_checks.keys())

        class UserProfileSchema(BaseModel):
            reasoning: str = Field(
                ...,
                description="Your step by step reasoning on each of the questions.",
            )
            user_profile: str = Field(
                ...,
                description="The highly condensed highly clear depiction of the user profile based on the input questions.",
            )

        class QuestionAnalysisSchema(BaseModel):
            question: str = Field(
                ...,
                description="The question that the user should answer.",
            )
            reasoning: str = Field(
                ...,
                description="The step by step reasoning regarding the question and whether the conversation contains information to answer the question.",
            )
            decision: bool = Field(
                ..., description="The boolean representing the decisions (true if there is sufficient information, false otherwise).",
            )

        class QuestionChecksSchema(BaseModel):
            analysis: List[QuestionAnalysisSchema] = Field(
                description="The analysis of each question and user message.",
            )

        class MessageGenerationSchema(BaseModel):
            message: str = Field(
                ...,
                description="The message to be sent to the user where you should either thank him, or ask him to address the missing questions.",
            )

        memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)

        memory.write(
            Message.new(
                text=message,
                sender_name=user.name,
                sender_id=user.id,
                recipient_name="Jarvis",
                recipient_id="0",
                emotions=[],
            )
        )

        conversation_history = memory.read_all_as_str(max_age_in_minutes=30)

        # Create parallel tasks for profile generation and question checks
        profile_task = ask_schema_async(
            text=f"Please generate an user profile based on a message that he sent to answer the following questions: {list(question_checks.values())}. Message: {message}",
            pymodel=UserProfileSchema,
        )

        question_checks_task = ask_schema_async(
            text=f"Analyse the interaction {conversation_history} and determine whether it contains information to answer all the questions: {list(question_checks.values())}",
            system="You are a friendly AI assistant.",
            pymodel=QuestionChecksSchema,
        )

        # Wait for both parallel tasks to complete
        profile_response, question_checks_response = await asyncio.gather(profile_task, question_checks_task)

        # Generate appropriate message based on question check results
        question_results = {
            question_checks_keys[i]: question_checks_response.analysis[i].decision
            for i in range(len(question_checks_keys))
        }
        unanswered_questions = [q for q, answered in question_results.items() if not answered]
        
        message_response = await ask_schema_async(
            text=f"""Based on the conversation history: {conversation_history}
                    And the question check results where:
                    - Answered questions: {[q for q, answered in question_results.items() if answered]}
                    - Unanswered questions: {unanswered_questions}
                    
                    Generate an appropriate short message to the user.
                    If there are unanswered questions, kindly ask for those specific pieces of information.
                    If all questions are answered, thank the user.""",
            system="You are a friendly AI assistant.",
            pymodel=MessageGenerationSchema,
        )

        # Update user profile
        updated_user = users_gateway.update_fields(
            user.id, {"profile": profile_response.user_profile}
        )

        # Write AI response to memory
        memory.write(
            Message.new(
                text=message_response.message,
                sender_name="Jarvis",
                sender_id="0",
                recipient_name=user.name,
                recipient_id=user.id,
            )
        )

        return {
            "message": message_response.message,
            "user": updated_user,
            "question_checks": question_results,
        }
    except Exception as e:
        logger.error(traceback.format_exc())
        logger.error(f"Failed to update profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reject-past-week-logging")
async def reject_past_week_logging(request: Request, user: User = Depends(is_clerk_user)):
    """
    Endpoint to handle past week logging rejection feedback.
    Just sends a Telegram message with the feedback.
    """
    try:
        body = await request.json()
        feedback = body["feedback"]
        user_message = body["user_message"]
        ai_message = body["ai_message"]

        # Create a message for Telegram
        feedback_message = f"🔄 Past Week Logging Rejected\n\nFeedback: {feedback}\n\nUser message: {user_message}\n\nAI message: {ai_message}"

        telegram = TelegramService()
        telegram.send_suggestion_rejection_notification(
            user_username=user.username,
            user_id=user.id,
            details=feedback_message,
        )

        return {"status": "success", "message": "Feedback received"}
    except Exception as e:
        logger.error(f"Error handling plan rejection: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject-plan")
async def reject_plan(request: Request, user: User = Depends(is_clerk_user)):
    """
    Endpoint to handle plan rejection feedback.
    Just sends a Telegram message with the feedback.
    """
    try:
        body = await request.json()
        feedback = body["feedback"]
        plan = body["plan"]
        user_message = body["user_message"]
        ai_message = body["ai_message"]

        # Create a message for Telegram
        feedback_message = f"🔄 Plan Rejected\n\nFeedback: {feedback}\n\nUser message: {user_message}\n\nAI message: {ai_message}\n\nPlan: {plan}"

        telegram = TelegramService()
        telegram.send_suggestion_rejection_notification(
            user_username=user.username,
            user_id=user.id,
            details=feedback_message,
        )

        return {"status": "success", "message": "Feedback received"}
    except Exception as e:
        logger.error(f"Error handling plan rejection: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/get-plan-extractions")
async def get_plan_extractions(request: Request, user: User = Depends(is_clerk_user)):
    """
    Endpoint to extract plan details from user message.
    Similar to the daily checkin extractions but focused on plans.
    """
    try:
        body = await request.json()
        message = body["message"]
        question_checks = body["question_checks"]

        # Initialize memory and assistant
        memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
        plan_creator = PlanCreationAssistantSimple(user=user, memory=memory)

        # Log the extraction request
        logger.info(
            f"Extracting plan for user {user.id} from message: {message[:50]}..."
        )

        class ResponseSchema(BaseModel):
            reasoning: str = Field(
                ...,
                description="Your question by question extensive step by step reasoning.",
            )
            decisions: List[bool] = Field(
                ...,
                description="A list of boolean values, indicating whether the user message contains information to the question (should have same order as the questions)",
            )
            message: str = Field(
                ...,
                description="A short and prose message to be sent to the user where you should either thank him, or ask him to address the missing questions.",
            )

        response = await ask_schema_async(
            text=f"Does the following message '{message}' contain information to all the questions: {list(question_checks.values())}",
            system="Youa are a friendly AI assitant.",
            pymodel=ResponseSchema,
        )

        question_checks_keys = list(question_checks.keys())

        all_questions_answered = all(response.decisions)

        if not all_questions_answered:
            return {
                "message": response.message,
                "question_checks": {
                    question_checks_keys[i]: response.decisions[i]
                    for i in range(len(question_checks))
                },
            }

        # Process the message and get suggestions
        response_text, suggestions = await plan_creator.get_response(
            user_input=message, message_id=str(ObjectId())
        )

        # Return the extracted plan data
        result = {
            "question_checks": {
                question_checks_keys[i]: response.decisions[i]
                for i in range(len(question_checks))
            },
            "message": response_text,
        }

        if len(suggestions) > 0:
            result["plan"] = suggestions[0].data["plan"]
            result["activities"] = suggestions[0].data["activities"]

        return result

    except Exception as e:
        logger.error(f"Error extracting plan: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/log-dynamic-ui-attempt-error")
async def log_dynamic_ui_attempt_error(request: Request, user: User = Depends(is_clerk_user)):
    body = await request.json()
    question_checks = body["question_checks"]
    attempts = body["attempts"]
    id = body["id"]
    extracted_data = body["extracted_data"]
    memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
    conversation_history = memory.read_all_as_str(max_messages=4, max_age_in_minutes=30)

    telegram = TelegramService()
    telegram.send_dynamic_ui_attempt_error_notification(
        user_username=user.username,
        user_id=user.id,
        conversation_history=conversation_history,
        question_checks=question_checks,
        attempts=attempts,
        extracted_data=extracted_data,
        id=id,
    )

@router.post("/log-dynamic-ui-skip")
async def log_dynamic_ui_skip(request: Request, user: User = Depends(is_clerk_user)):
    body = await request.json()
    question_checks = body["question_checks"]
    attempts = body["attempts"]
    extracted_data = body["extracted_data"]
    id = body["id"]
    memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
    conversation_history = memory.read_all_as_str(max_messages=4, max_age_in_minutes=30)

    telegram = TelegramService()
    telegram.send_dynamic_ui_skip_notification(
        user_username=user.username,
        user_id=user.id,
        conversation_history=conversation_history,
        question_checks=question_checks,
        attempts=attempts,
        extracted_data=extracted_data,
        id=id,
    )


if __name__ == "__main__":
    user_id = "67db3b7c1a1f74601b0d025f"
    memory = DatabaseMemory(DynamoDBGateway("messages"), user_id)
    history = memory.read_all_as_str(max_age_in_minutes=30)
    telegram = TelegramService()
    telegram.send_dynamic_ui_attempt_error_notification(
        user_username="alexandreramalho1998",
        user_id=user_id,
        conversation_history=history,
        question_checks={},
        attempts=0,
        extracted_data={},
        id="",
    )
    print("sent")