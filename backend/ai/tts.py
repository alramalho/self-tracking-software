from constants import OPENAI_TTS_MODEL, REPLICATE_TTS_MODEL, REPLICATE_API_TOKEN
from ai.clients import sync_openai_client as client
from io import BytesIO
import replicate
import requests


def text_to_speech(text: str, model: str = OPENAI_TTS_MODEL) -> bytes:
    if model.startswith("openai:"):
        model = model.replace("openai:", "")  # Remove the openai: prefix
        with client.audio.speech.with_streaming_response.create(
            model=model,
            voice='alloy',
            input=text,
        ) as response:
            byte_stream = BytesIO()
            for chunk in response.iter_bytes():
                byte_stream.write(chunk)
            return byte_stream.getvalue()
    elif model.startswith("replicate:"):
        model = model.replace("replicate:", "")  # Remove the replicate: prefix
        output = replicate.run(
            model or REPLICATE_TTS_MODEL,
            api_key=REPLICATE_API_TOKEN,
            input={
                "text": text,
                "voice": "am_puck"  # check voices here https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md#american-english
            }
        )
        response = requests.get(output)
        return response.content
    else:
       raise ValueError(f"Invalid model: {model}")