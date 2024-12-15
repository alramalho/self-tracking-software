from constants import TTS_MODEL, TTS_VOICE
from ai.clients import sync_openai_client as client
from io import BytesIO


def text_to_speech(text: str) -> bytes:
    with client.audio.speech.with_streaming_response.create(
        model=TTS_MODEL,
        voice=TTS_VOICE,
        input=text,
    ) as response:
        byte_stream = BytesIO()
        for chunk in response.iter_bytes():
            byte_stream.write(chunk)
        return byte_stream.getvalue()