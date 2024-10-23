from services.conversation_service import process_message, users_gateway, activities_gateway, moods_gateway
from shared.executor import executor
from ai import stt
from starlette.types import ASGIApp
import time
from loguru import logger
import json
import base64
import traceback
from fastapi import WebSocket, Request
from auth.clerk import is_clerk_user_ws
from auth.clerk import is_clerk_user_ws

from fastapi import APIRouter
router = APIRouter(prefix="/api")

@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("Connecting to websocket endpoint.")
    user = await is_clerk_user_ws(websocket)
    if user:
        await websocket.accept()
        audio_buffer = bytearray()
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

                    text_response, audio_response, activities, activity_entries, mood_report, notification_text = (
                        await process_message(websocket, user.id, text, input_mode, output_mode, audio_data, audio_format)
                    )

                    response_data = {
                        "type": "message",
                        "text": text_response,
                    }

                    if output_mode == "voice" and audio_response:
                        response_data["audio"] = base64.b64encode(audio_response).decode("utf-8")

                    await websocket.send_json(response_data)

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


@router.post("/hume-callback")
async def hume_callback(request: Request):
    data = await request.json()
    logger.info(f"Received Hume callback: {data}")
    # Here you can process the Hume results further if needed
    return {"status": "success"}