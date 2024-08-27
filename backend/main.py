from fastapi import FastAPI, WebSocket
from shared.logger import create_logger
create_logger()

from fastapi.middleware.cors import CORSMiddleware
import base64
import json
from typing import Tuple, List
from loguru import logger
import traceback
from datetime import datetime
from ai import stt, tts
from ai.llm import ask_schema, ask_text
from ai.assistant.assistant import Assistant
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from gateways.activities import ActivitiesGateway
from gateways.users import UsersGateway
from entities.mood_report import MoodReport
from entities.activity import Activity, ActivityEntry
from pydantic import BaseModel, Field
from gateways.moodreports import MoodsGateway
from concurrent.futures import ThreadPoolExecutor
from os import cpu_count
import asyncio
from fastapi import APIRouter, Depends
from auth.clerk import is_clerk_user, is_clerk_user_ws


app = FastAPI()
users_router = APIRouter(dependencies=[Depends(is_clerk_user)])
users_gateway = UsersGateway()
activities_gateway = ActivitiesGateway()
moods_gateway = MoodsGateway()

# Automatically determine the number of threads
num_workers = cpu_count() * 2  # Use twice the number of CPUs
executor = ThreadPoolExecutor(max_workers=num_workers)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def talk_with_assistant(user_id: str, user_input: str) -> str:
    user = users_gateway.get_user_by_id(user_id)
    memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user.id)
    assistant = Assistant(
        memory=memory,
        user=user,
        user_activities=activities_gateway.get_all_activities_by_user_id(user_id),
    )
    return assistant.get_response(user_input)


def get_activities_from_conversation(user_id: str) -> List[Activity]:
    memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user_id)
    activities = activities_gateway.get_all_activities_by_user_id(user_id)
    current_date = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""
    Given the conversation history, extract any present activities. 
    Good activities examples include 'work in startup named X', 'work in job at company Y', 'read', 'meditate', etc.
    Counter examples include 'work' (too generic), 'work in solving a bug' (too specific), 'read the introduction of a book' (too specific) 
    Try to match activities with existent ones, if not, create new ones.
    Don't infer anything that is not explicitly included. 
    If you don't have enough explicit information from the dialogue to create complete activities (e.g. missing measure), do not create them.

    Existent Activities:
    {", ".join([str(a) for a in activities])}
    
    Conversation history:
    {memory.read_all_as_str(max_messages=6)}
    (today is {current_date})
    """

    class ResponseModel(BaseModel):
        reasonings: str = Field(
            description="Your reasoning justifying each created activity against the conversation history. Must not be emtpy or null."
        )
        activities: list[Activity]

    response = ask_schema("Go!", prompt, ResponseModel)
    activities = [
        Activity.new(user_id=user_id, measure=a.measure, title=a.title)
        for a in response.activities
    ]
    return activities


def get_activity_entries_from_conversation(user_id: str) -> List[ActivityEntry]:
    memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user_id)
    activities = activities_gateway.get_all_activities_by_user_id(user_id)
    current_date = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""
    Given the conversation history extract any activity entries that are mentioned & matched against existent activities.
    Try to match activities with existent ones, if not, create new ones.
    Don't infer anything that is not explicitly included.
    If you don't have enough explicit information from the dialogue to create complete activity entries (e.g. missing quantity), do not create them.

    Existent Activities:
    {", ".join([f"{str(a)} (id: '{a.id}')" for a in activities])}
    
    Conversation history:
    {memory.read_all_as_str(max_messages=6)}
    (today is {current_date})
    """

    class ResponseModel(BaseModel):
        reasonings: str = Field(
            description="Your reasoning justifying each activity and its full data entry against the conversation history. Must not be emtpy or null."
        )
        activity_entries: list[ActivityEntry]

    response = ask_schema("Go!", prompt, ResponseModel)
    activity_entries = [
        ActivityEntry.new(activity_id=a.activity_id, quantity=a.quantity, date=a.date)
        for a in response.activity_entries
    ]

    return activity_entries


def get_mood_report_from_conversation(user_id: str) -> MoodReport:
    memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user_id)
    current_date = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""
    Given the conversation history, extract the user's mood report for today.
    It is imperatiive that the mood report is explicitly mentioned by the user, as an answer to the question of how happy the user is feeling from from 1 to 10.
    If theres no such question & answer, do not create a mood report.
    The mood score should be on a scale of 1 to 10, where 1 is extremely unhappy and 10 is extremely happy.

    Conversation history:
    {memory.read_all_as_str(max_messages=6)}
    (today is {current_date})
    """

    class ResponseModel(BaseModel):
        reasoning: str = Field(
            description="Your reasoning justifying the mood report against the conversation history."
        )
        mood_report: MoodReport | None

    response = ask_schema("Extract mood report", prompt, ResponseModel)
    mood_report = (
        MoodReport.new(
            user_id=user_id,
            score=response.mood_report.score,
            date=response.mood_report.date,
        )
        if response.mood_report
        else None
    )
    return mood_report


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


def store_activities_and_mood_from_conversation(
    user_id: str,
) -> Tuple[List[Activity], List[ActivityEntry], MoodReport | None, str]:
    activities = get_activities_from_conversation(user_id)
    created_activities = []
    logger.info(f"Activities: {activities}")

    for activity in activities:
        try:
            new_activity = activities_gateway.create_activity(activity)
            if new_activity:
                created_activities.append(new_activity)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error creating activity: {e}")

    activity_entries = get_activity_entries_from_conversation(user_id)
    created_activity_entries = []
    logger.info(f"Activity entries: {activity_entries}")

    for activity_entry in activity_entries:
        try:
            new_activity_entry = activities_gateway.create_activity_entry(activity_entry)
            if new_activity_entry:
                created_activities.append(new_activity)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error creating activity entry: {e}")

    mood_report = get_mood_report_from_conversation(user_id)
    created_mood_report = []
    logger.info(f"Mood report: {mood_report}")

    if mood_report:
        try:
            new_mood_report = moods_gateway.create_mood_report(mood_report)
            if new_mood_report:
                created_mood_report.append(new_mood_report)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error creating mood report: {e}")

    notification_text = generate_notification_text(
        created_activities, created_activity_entries, created_mood_report
    )

    return activities, activity_entries, mood_report, notification_text.strip('"')


async def process_audio(user_id: str, transcription: str):
    loop = asyncio.get_event_loop()
    text_response = await loop.run_in_executor(
        executor, talk_with_assistant, user_id, transcription
    )
    audio_response = await loop.run_in_executor(
        executor, tts.text_to_speech, text_response
    )
    return text_response, audio_response


async def process_activities_and_mood(user_id: str):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        executor, store_activities_and_mood_from_conversation, user_id
    )


@app.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("Connecting to websocket endpoint.")
    authenticated = await is_clerk_user_ws(websocket)
    if authenticated:
        await websocket.accept()
        audio_buffer = bytearray()
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                user_id = "66b29679de73d9a05e77a247"

                if message["action"] == "start_recording":
                    audio_buffer.clear()

                elif message["action"] == "stop_recording":
                    audio_data = message.get("audio_data", "")
                    audio_bytes = base64.b64decode(audio_data)

                    loop = asyncio.get_event_loop()
                    transcription = await loop.run_in_executor(
                        executor, stt.speech_to_text, audio_bytes
                    )

                    await websocket.send_json(
                        {"type": "transcription", "text": transcription}
                    )

                    # Process audio and activities/mood concurrently
                    text_response, audio_response = await process_audio(
                        user_id, transcription
                    )
                    activities, activity_entries, mood_report, notification_text = (
                        await process_activities_and_mood(user_id)
                    )

                    await websocket.send_json(
                        {
                            "type": "audio",
                            "transcription": text_response,
                            "audio": base64.b64encode(audio_response).decode("utf-8"),
                        }
                    )

                    # Send activities and mood data separately
                    await websocket.send_json(
                        {
                            "type": "activities_update",
                            "new_activities": [a.model_dump() for a in activities],
                            "new_activity_entries": [
                                a.model_dump() for a in activity_entries
                            ],
                            "new_mood_report": (
                                mood_report.model_dump() if mood_report else None
                            ),
                            "new_activities_notification": notification_text,
                            "reported_mood": bool(
                                mood_report.model_dump() if mood_report else None
                            ),
                        }
                    )

                    audio_buffer.clear()

                elif message["action"] == "update_transcription":
                    updated_transcription = message.get("text", "")

                    # Process audio and activities/mood concurrently
                    text_response, audio_response = await process_audio(
                        user_id, updated_transcription
                    )
                    activities, activity_entries, mood_report, notification_text = (
                        await process_activities_and_mood(user_id)
                    )

                    await websocket.send_json(
                        {
                            "type": "audio",
                            "transcription": text_response,
                            "audio": base64.b64encode(audio_response).decode("utf-8"),
                        }
                    )

                    # Send activities and mood data separately
                    await websocket.send_json(
                        {
                            "type": "activities_update",
                            "new_activities": [a.model_dump() for a in activities],
                            "new_activity_entries": [
                                a.model_dump() for a in activity_entries
                            ],
                            "new_mood_report": (
                                mood_report.model_dump() if mood_report else None
                            ),
                            "new_activities_notification": notification_text,
                            "reported_mood": bool(
                                mood_report.model_dump() if mood_report else None
                            ),
                        }
                    )

        except Exception as e:
            traceback.print_exc()
            logger.error(f"Error: {e}")
        finally:
            await websocket.close()
    else:
        logger.error("Websocket authorization failed.")
        await websocket.close()


class ActivityResponse(BaseModel):
    id: str
    title: str
    measure: str


class ActivityEntryResponse(BaseModel):
    id: str
    activity_id: str
    quantity: int
    date: str


class MoodReportResponse(BaseModel):
    id: str
    user_id: str
    date: str
    score: str


@users_router.get("/api/activities", response_model=List[ActivityResponse])
async def get_activities():
    user_id = "66b29679de73d9a05e77a247"  # Replace with actual user authentication
    activities = activities_gateway.get_all_activities_by_user_id(user_id)
    return [
        ActivityResponse(id=a.id, title=a.title, measure=a.measure) for a in activities
    ]


@users_router.get("/api/activity-entries", response_model=List[ActivityEntryResponse])
async def get_activity_entries():
    user_id = "66b29679de73d9a05e77a247"  # Replace with actual user authentication
    activities = activities_gateway.get_all_activities_by_user_id(user_id)
    all_entries = []
    for activity in activities:
        entries = activities_gateway.get_all_activity_entries_by_activity_id(
            activity.id
        )
        all_entries.extend(entries)
    return [
        ActivityEntryResponse(
            id=e.id, activity_id=e.activity_id, quantity=e.quantity, date=e.date
        )
        for e in all_entries
    ]


@users_router.get("/api/mood-reports", response_model=List[MoodReportResponse])
async def get_mood_reports():
    user_id = "66b29679de73d9a05e77a247"  # Replace with actual user authentication
    mood_reports = moods_gateway.get_all_mood_reports_by_user_id(user_id)
    return [
        MoodReportResponse(id=m.id, user_id=m.user_id, date=m.date, score=m.score)
        for m in mood_reports
    ]


@app.get("/")
def read_root():
    return {"status": "ok"}


@users_router.get("/user-health")
async def health():
    return {"status": "ok"}


app.include_router(users_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
