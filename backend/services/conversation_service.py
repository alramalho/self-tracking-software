from typing import Tuple, List, Dict, Optional, Union
from entities.user import User
from entities.activity import Activity, ActivityEntry
from entities.mood_report import MoodReport
from gateways.database.mongodb import MongoDBGateway
from ai.assistant.memory import DatabaseMemory
from ai.llm import ask_schema, ask_text
from datetime import datetime
from ai.assistant.activity_extractor import ActivityExtractorAssistant, ExtractedActivityEntry
from ai.assistant.week_analyser import WeekAnalyserAssistant, SuggestedNextWeekSessions, EnrichedPlanSessions
import pytz
from services.hume_service import process_audio_with_hume
from constants import SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS

from gateways.activities import ActivitiesGateway
from gateways.users import UsersGateway
from gateways.moodreports import MoodsGateway

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

users_gateway = UsersGateway()
activities_gateway = ActivitiesGateway()
moods_gateway = MoodsGateway()
plan_controller = PlanController()


def talk_with_assistant(
    user_id: str, user_input: str, message_id: str = None, emotions: List[Emotion] = []
) -> Tuple[str, List[ExtractedActivityEntry] | List[SuggestedNextWeekSessions]]:
    user = users_gateway.get_user_by_id(user_id)
    memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user.id)
    user_activities = activities_gateway.get_all_activities_by_user_id(user_id)
    user_plans = plan_controller.get_all_user_active_plans(user)
    if True:#datetime.now().weekday() in [5, 6]: 
        assistant = WeekAnalyserAssistant(
            memory=memory,
            user=user,
            user_activities=user_activities,
            user_plans=user_plans,
        )
    else:
        assistant = ActivityExtractorAssistant(
            memory=memory,
            user=user,
            user_activities=user_activities,
        )
    return assistant.get_response(
        user_input=user_input, message_id=message_id, emotions=emotions
    )


# def get_activities_from_conversation(user_id: str) -> Tuple[List[Activity], str]:
#     memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user_id)
#     activities = activities_gateway.get_all_activities_by_user_id(user_id)
#     current_date = datetime.now().strftime("%Y-%m-%d")

#     prompt = f"""
#     Given the conversation history, extract any present activities.
#     {activities_description}
#     Try to match activities with existent ones, if not, create new ones.
#     Don't infer anything that is not explicitly included.
#     If you don't have enough explicit information from the dialogue to create complete activities (e.g. missing measure), do not create them.

#     Existent Activities:
#     {", ".join([str(a) for a in activities])}

#     Conversation history:
#     {memory.read_all_as_str(max_messages=6)}
#     (today is {current_date})
#     """

#     class PartialActivity(BaseModel):
#         measure: str
#         title: str
#         emoji: str

#     class ResponseModel(BaseModel):
#         reasonings: str = Field(
#             description="Your reasoning justifying each created activity against the conversation history. Must not be emtpy or null."
#         )
#         activities: list[PartialActivity]

#     response = ask_schema("Go!", prompt, ResponseModel)

#     activities = [
#         Activity.new(user_id=user_id, measure=a.measure, title=a.title, emoji=a.emoji)
#         for a in response.activities
#     ]
#     return activities, response.reasonings


# def get_activity_entries_from_conversation(user_id: str) -> Tuple[List[ActivityEntry], str]:
#     memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user_id)
#     activities = activities_gateway.get_all_activities_by_user_id(user_id)
#     current_date = datetime.now().strftime("%Y-%m-%d")

#     prompt = f"""
#     Given the conversation history extract any activity entries that are mentioned & matched against existent activities.
#     # {activity_entries_description}
#     Try to match activities with existent ones, if not, create new ones.
#     All information regarding the activtiy must be EXPLICTLY mentioned for you to create it. Do not craete it otherwise.

#     Existent Activities:
#     {", ".join([f"{str(a)} (id: '{a.id}')" for a in activities])}

#     Conversation history:
#     {memory.read_all_as_str(max_messages=6)}
#     (today is {current_date})
#     """

#     class PartialActivityEntry(BaseModel):
#         activity_id: str
#         quantity: float
#         date: str

#     class ResponseModel(BaseModel):
#         reasonings: str = Field(
#             description="Your reasoning justifying each activity and its full data entry against the conversation history. Must not be emtpy or null."
#         )
#         activity_entries: list[PartialActivityEntry]

#     response = ask_schema("Go!", prompt, ResponseModel)
#     activity_entries = [
#         ActivityEntry.new(activity_id=a.activity_id, quantity=a.quantity, date=a.date, user_id=user_id)
#         for a in response.activity_entries
#     ]

#     return activity_entries, response.reasonings


# def get_mood_report_from_conversation(user_id: str) -> Tuple[MoodReport | None, str]:
#     memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user_id)
#     current_date = datetime.now().strftime("%Y-%m-%d")

#     prompt = f"""
#     Given the conversation history, extract the user's mood report for today.
#     It is imperatiive that the mood report is explicitly mentioned by the user, as an answer to the question of how happy the user is feeling from from 1 to 10.
#     If theres no such question & answer, do not create a mood report.
#     The mood score should be on a scale of 1 to 10, where 1 is extremely unhappy and 10 is extremely happy.

#     Conversation history:
#     {memory.read_all_as_str(max_messages=6)}
#     (today is {current_date})
#     """

#     class ResponseModel(BaseModel):
#         reasoning: str = Field(
#             description="Your reasoning justifying the mood report against the conversation history."
#         )
#         mood_report: MoodReport | None

#     response = ask_schema("Extract mood report", prompt, ResponseModel)
#     mood_report = (
#         MoodReport.new(
#             user_id=user_id,
#             score=response.mood_report.score,
#             date=response.mood_report.date,
#         )
#         if response.mood_report
#         else None
#     )
#     return mood_report, response.reasoning


def generate_notification_text(
    activities: List[Activity],
    activity_entries: List[ActivityEntry],
    mood_report: MoodReport | None,
) -> str:
    if not activities and not activity_entries and not mood_report:
        return ""

    current_date = datetime.now().strftime("%Y-%m-%d")

    system_prompt = f"""
    You are an AI assistant that generates informative notifications about a user's activities and mood.
    Given a list of activities, activity entries, and a mood report, create a brief notification that summarizes what the user has done and how they're feeling.
    Keep it minimal and merely informative.

    Today is {current_date}.
    """

    activities_str = "\n".join(
        [f"- {{title: '{a.title}', measure: '{a.measure}'}}" for a in activities]
    )
    entries_str = "\n".join(
        [f"- {{quantity: {e.quantity}, date: '{e.date}'}}" for e in activity_entries]
    )
    mood_str = (
        f"- {{score: {mood_report.score}, date: '{mood_report.date}'}}"
        if mood_report
        else "No mood report available."
    )

    user_prompt = f"""
    Please generate a notification based on these activities, entries, and mood report:

    Activities:
    {activities_str}
    Activity Entries:
    {entries_str}
    Mood Report:
    {mood_str}
    Notification:
    """

    return ask_text(user_prompt, system_prompt).strip('"')


# async def process_audio(user_id: str, transcription: str):
#     loop = asyncio.get_event_loop()
#     text_response = await loop.run_in_executor(
#         executor, talk_with_assistant, user_id, transcription
#     )
#     audio_response = await loop.run_in_executor(
#         executor, tts.text_to_speech, text_response
#     )
#     return text_response, audio_response


# async def process_activities_and_mood(
#     user_id: str,
# ) -> Tuple[List[Activity], List[ActivityEntry], MoodReport | None, str, Dict[str, str]]:
#     loop = asyncio.get_event_loop()
#     activities, activities_reasoning = await loop.run_in_executor(
#         executor, get_activities_from_conversation, user_id
#     )
#     activity_entries, activity_entries_reasoning = await loop.run_in_executor(
#         executor, get_activity_entries_from_conversation, user_id
#     )
#     mood_report, mood_report_reasoning = await loop.run_in_executor(
#         executor, get_mood_report_from_conversation, user_id
#     )

#     created_activities = []
#     created_activity_entries = []
#     created_mood_report = None

#     logger.info(f"Activities: {activities}")
#     for activity in activities:
#         try:
#             new_activity = activities_gateway.create_activity(activity)
#             if new_activity:
#                 created_activities.append(new_activity)
#         except Exception as e:
#             traceback.print_exc()
#             logger.error(f"Error creating activity: {e}")

#     logger.info(f"Activity entries: {activity_entries}")
#     for activity_entry in activity_entries:
#         try:
#             new_activity_entry = activities_gateway.create_activity_entry(
#                 activity_entry
#             )
#             if new_activity_entry:
#                 created_activity_entries.append(new_activity_entry)
#         except Exception as e:
#             traceback.print_exc()
#             logger.error(f"Error creating activity entry: {e}")

#     logger.info(f"Mood report: {mood_report}")
#     if mood_report:
#         try:
#             new_mood_report = moods_gateway.create_mood_report(mood_report)
#             if new_mood_report:
#                 created_mood_report = new_mood_report
#         except Exception as e:
#             traceback.print_exc()
#             logger.error(f"Error creating mood report: {e}")

#     notification_text = generate_notification_text(
#         created_activities, created_activity_entries, created_mood_report
#     )

#     reasoning = {
#         "activities": activities_reasoning,
#         "activity_entries": activity_entries_reasoning,
#         "mood_report": mood_report_reasoning,
#     }

#     return (
#         created_activities,
#         created_activity_entries,
#         created_mood_report,
#         notification_text.strip('"'),
#         reasoning,
#     )


async def process_message(
    websocket: WebSocket,
    user_id: str,
    message: str,
    input_mode: str,
    output_mode: str,
    audio_data: str = None,
    audio_format: str = None,
) -> Tuple[str, Optional[bytes], Union[List[ExtractedActivityEntry], List[SuggestedNextWeekSessions]]]:
    loop = asyncio.get_event_loop()
    emotions = []

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
                # Get top 3 emotions
                top_emotions = emotions[:3]
                await websocket.send_json(
                    {
                        "type": "emotion_analysis",
                        "result": [emotion.dict() for emotion in top_emotions],
                    }
                )
        except Exception as e:
            logger.error(f"Error processing audio with Hume: {e}")
            emotions = []  # Ensure emotions is a list even on error

    message_id = str(ObjectId())
    
    text_response, extracted_data = await loop.run_in_executor(
        executor, talk_with_assistant, user_id, message, message_id, emotions
    )

    # Check if the extracted data is activity entries
    if extracted_data and isinstance(extracted_data, list) and extracted_data and isinstance(extracted_data[0], ExtractedActivityEntry):
        existing_entries = activities_gateway.get_all_activity_entries_by_user_id(user_id)
        activity_entries = [
            ae
            for ae in extracted_data
            if not any(
                existing.activity_id == ae.activity_id and existing.date == ae.date
                for existing in existing_entries
            )
        ]
        unique_activity_ids = {entry.activity_id for entry in activity_entries}
        activities = [
            activities_gateway.get_activity_by_id(activity_id)
            for activity_id in unique_activity_ids
        ]
        await websocket.send_json(
            {
                "type": "suggested_activity_entries", 
                "activities": [activity.dict() for activity in activities],
                "activity_entries": [activity.dict() for activity in activity_entries],
            }
        )
    # Check if the extracted data is next week sessions
    elif extracted_data and isinstance(extracted_data, EnrichedPlanSessions):
        await websocket.send_json(
            {
                "type": "suggested_next_week_sessions",
                "next_week_sessions": [session.dict() for session in extracted_data.sessions],
                "old_sessions": [session.dict() for session in extracted_data.old_sessions],
                "plan_id": extracted_data.plan_id,
            }
        )

    audio_response = None
    if output_mode == "voice":
        audio_response = await loop.run_in_executor(
            executor, tts.text_to_speech, text_response
        )

    return text_response, audio_response, extracted_data


def initiate_recurrent_checkin(user_id: str) -> Notification:
    notification_manager = NotificationManager()

    return notification_manager.create_scheduled_notification(
        user_id=user_id,
        prompt_tag="user-recurrent-checkin",
        recurrence="daily",
        time_deviation_in_hours=SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS,
    )