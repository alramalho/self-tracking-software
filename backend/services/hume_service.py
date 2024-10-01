import websockets
from loguru import logger
import requests
import aiohttp
import json
import os
from dotenv import load_dotenv

load_dotenv()

HUME_API_KEY = os.getenv("HUME_API_KEY")
HUME_SECRET_KEY = os.getenv("HUME_SECRET_KEY")
HUME_API_URL = "https://api.hume.ai/v0/batch/jobs"
CALLBACK_URL = os.getenv("HUME_CALLBACK_URL")  # Make sure to set this in your environment variables

async def process_audio_with_hume(self, audio_data: bytes, audio_format: str):
    async with aiohttp.ClientSession() as session:
        data = aiohttp.FormData()
        hume_config = {
            "models": {"prosody": {}},
            "callback_url": CALLBACK_URL,
            "notify": True
        }
        data.add_field('json', json.dumps(hume_config))
        data.add_field('file', audio_data, filename=f'audio.{audio_format}', content_type=f'audio/{audio_format}')

        headers = {
            "X-Hume-Api-Key": HUME_API_KEY
        }

        async with session.post(HUME_API_URL, data=data, headers=headers) as response:
            if response.status == 200:
                result = await response.json()
                logger.info(f"Hume job submitted successfully: {result}")
                return result
            else:
                error_text = await response.text()
                logger.error(f"Error submitting Hume job: {error_text}")
                return None


