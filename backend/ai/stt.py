import io
import filetype
from ai.clients import sync_openai_client as client
from constants import STT_MODEL
from loguru import logger

class CustomBufferedReader(io.BytesIO):
    def __init__(self, buffer, name):
        super().__init__(buffer)
        self.name = name

def detect_audio_type(audio_bytes):
    kind = filetype.guess(audio_bytes)
    if kind is None:
        # Fallback checks if filetype fails
        if audio_bytes.startswith(b'RIFF'):
            return 'wav'
        elif audio_bytes.startswith(b'OggS'):
            return 'ogg'
        elif audio_bytes[4:8] == b'ftyp':
            return 'mp4'
        # Add more checks as needed
    return kind.extension if kind else None

MIME_TYPES = {
    'webm': 'audio/webm',
    'ogg': 'audio/ogg',
    'mp4': 'audio/mp4',
    'wav': 'audio/wav',
    # Add more as needed
}

def speech_to_text(audio_bytes: bytes, received_audio_format: str) -> str:
    detected_audio_type = detect_audio_type(audio_bytes)
    logger.info(f"Received audio format: {received_audio_format}")
    logger.info(f"Detected audio type: {detected_audio_type}")

    # Use the received_audio_format if it's provided and valid, otherwise fall back to detected type
    audio_type = received_audio_format if received_audio_format in MIME_TYPES else detected_audio_type

    if audio_type is None:
        raise ValueError("Unable to determine audio file type")

    mime_type = MIME_TYPES.get(audio_type, f'audio/{audio_type}')
    logger.info(f"Using MIME type: {mime_type}")
    
    audio_file = CustomBufferedReader(audio_bytes, f"audio.{audio_type}")
    audio_file.content_type = mime_type  # Set the correct MIME type
    
    try:
        transcription = client.audio.transcriptions.create(
            model=STT_MODEL, 
            file=audio_file,
        )
        return transcription.text
    except Exception as e:
        logger.error(f"Error in speech_to_text: {e}")
        raise