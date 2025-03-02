from fastapi import APIRouter
from gateways.messages import MessagesGateway
from datetime import datetime
import pytz
import json

router = APIRouter(prefix="/messages")
messages_gateway = MessagesGateway()

@router.post("/{message_id}/move-up")
async def move_up_message(message_id: str):
    # we should get message, change it's created at to now, and rewrite
    
    # No need to json.dumps() the message_id since it's already a string from the path parameter
    print(f"Moving up message {message_id}")
    message = messages_gateway.get_message_by_id(message_id)
    message.created_at = datetime.now(pytz.UTC).isoformat()
    messages_gateway.update_message(message)
    return message
