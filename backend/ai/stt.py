import io
import filetype
from ai.clients import openai_client as client
from constants import STT_MODEL

class CustomBufferedReader(io.BytesIO):
    def __init__(self, buffer, name):
        super().__init__(buffer)
        self.name = name

def detect_audio_type(audio_bytes):
    kind = filetype.guess(audio_bytes)
    if kind is None:
        return None
    return kind.extension

def speech_to_text(audio_bytes: bytes) -> str:
    # Detect the audio file type
    audio_type = detect_audio_type(audio_bytes)
    if audio_type is None:
        raise ValueError("Unable to detect audio file type")

    # Create a file-like object from the bytes
    audio_file = CustomBufferedReader(audio_bytes, f"audio.{audio_type}")
    
    try:
        transcription = client.audio.transcriptions.create(
            model=STT_MODEL, 
            file=audio_file,
        )
        return transcription.text
    except Exception as e:
        print(f"Error in speech_to_text: {e}")
        raise