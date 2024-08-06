from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import base64
import json
from typing import Tuple
from loguru import logger
import traceback
from ai import stt, tts
from ai.assistant.assistant import Assistant
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from gateways.users import UsersGateway

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

def talk_with_assistant(text:str):
    users_gateway = UsersGateway(MongoDBGateway("users"))
    user = users_gateway.get_user_by_id("66b29679de73d9a05e77a247")
    memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user.id)
    assistant = Assistant(memory=memory, user=user)
    return assistant.get_response(text)


async def process_audio_pipeline(audio_bytes: bytes) -> Tuple[str, bytes]:
    transcription = stt.speech_to_text(audio_bytes)
    response = talk_with_assistant(transcription)
    audio_response = tts.text_to_speech(response)
    return response, audio_response

@app.websocket("/connect")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    audio_buffer = bytearray()
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message['action'] == 'start_recording':
                audio_buffer.clear()
            
            elif message['action'] == 'stop_recording':
                # Process the audio (assuming it's sent with this message)
                audio_data = message.get('audio_data', '')
                audio_bytes = base64.b64decode(audio_data)
                
                text_response, audio_response = await process_audio_pipeline(audio_bytes)
                
                # Send audio response back to the client
                await websocket.send_json({
                    "type": "audio",
                    "transcription": text_response,
                    "audio": base64.b64encode(audio_response).decode('utf-8')
                })

                audio_buffer.clear()
    
    except Exception as e:
        traceback.print_exc()
        logger.error(f"Error: {e}")
    finally:
        await websocket.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)