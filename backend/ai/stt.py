import io
from ai.clients import openai_client as client
from constants import STT_MODEL

class CustomBufferedReader(io.BytesIO):
    def __init__(self, buffer, name):
        super().__init__(buffer)
        self.name = name

def speech_to_text(audio_bytes: bytes) -> str:
    # Create a file-like object from the bytes
    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = "audio.webm"
    
    try:
        transcription = client.audio.transcriptions.create(
            model=STT_MODEL, 
            file=audio_file,
        )
        return transcription.text
    except Exception as e:
        print(f"Error in speech_to_text: {e}")
        raise
    
    return transcription.text