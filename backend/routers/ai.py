from services.conversation_service import process_message, users_gateway, activities_gateway, moods_gateway
from shared.executor import executor
from ai import stt
from starlette.types import ASGIApp
import time
from loguru import logger
import json
import base64
import traceback
from fastapi import WebSocket, Request, HTTPException, status
from auth.clerk import is_clerk_user_ws
from auth.clerk import is_clerk_user_ws
from services.notification_manager import NotificationManager
from gateways.activities import ActivitiesGateway
from entities.activity import ActivityEntry

from fastapi import APIRouter
router = APIRouter(prefix="/ai")

activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()

@router.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("Connecting to websocket endpoint.")
    try:
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

                        text_response, audio_response, extracted_activity_entries = (
                            await process_message(websocket, user.id, text, input_mode, output_mode, audio_data, audio_format)
                        )

                        response_data = {
                            "type": "message",
                            "text": text_response,
                        }

                        for activity_entry in extracted_activity_entries:
                            activities_gateway.create_activity_entry(
                                ActivityEntry.new(
                                    user_id=user.id,
                                    activity_id=activity_entry.activity_id,
                                    date=activity_entry.date,
                                    quantity=activity_entry.quantity,
                                )
                            )

                        if output_mode == "voice" and audio_response:
                            response_data["audio"] = base64.b64encode(audio_response).decode("utf-8")

                        await websocket.send_json(response_data)
    
                        if len(extracted_activity_entries) > 0:
                            await websocket.send_json(
                                {
                                "type": "activities_update",
                                "new_activities_notification": f"Extracted {len(extracted_activity_entries)} new activities. Check your notifications for more details.",
                            }
                        )

            except Exception as e:
                traceback.print_exc()
                logger.error(f"Error: {e}")
            finally:
                await websocket.close()
        else:
            logger.error("Websocket authorization failed - no valid user")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
    except HTTPException as e:
        logger.error(f"Websocket authorization failed: {e.detail}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)


@router.post("/hume-callback")
async def hume_callback(request: Request):
    data = await request.json()
    logger.info(f"Received Hume callback: {data}")
    # Here you can process the Hume results further if needed
    return {"status": "success"}