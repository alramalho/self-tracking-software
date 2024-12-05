import aiohttp
from loguru import logger
import base64
import json
import os
from dotenv import load_dotenv
from constants import HUME_API_KEY, HUME_SCORE_FILTER_THRESHOLD, HUME_BATCH_URL
from typing import List
from entities.message import Emotion
from pydantic import BaseModel
import traceback
import asyncio

load_dotenv()


EMOTION_COLORS = {
    "Joy": "#FFD700",
    "Excitement": "#FF4500", 
    "Interest": "#00CED1",
    "Surprise (positive)": "#32CD32",
    "Contentment": "#87CEEB",
    "Satisfaction": "#9370DB",
    "Relief": "#7FFFD4",
    "Admiration": "#FF69B4",
    "Amusement": "#FFC0CB",
    "Ecstasy": "#FF1493",
    "Love": "#FF69B4",
    "Pride": "#BA55D3",
    "Triumph": "#FFD700",
    "Realization": "#4682B4",
    "Aesthetic Appreciation": "#DA70D6",
    "Adoration": "#FF69B4",
    "Calmness": "#E0FFFF",
    "Concentration": "#B8860B",
    "Contemplation": "#778899",
    "Determination": "#0E8080",
    "Desire": "#FF6347",
    "Romance": "#FF69B4",
    "Nostalgia": "#D8BFD8",
    "Entrancement": "#9370DB",
    "Awe": "#8A2BE2",
    "Anger": "#FF0000",
    "Anxiety": "#8B0000",
    "Fear": "#800000",
    "Sadness": "#4682B4",
    "Disgust": "#556B2F",
    "Confusion": "#DAA520",
    "Contempt": "#8B4513",
    "Disappointment": "#696969",
    "Distress": "#8B0000",
    "Embarrassment": "#DB7093",
    "Empathic Pain": "#4B0082",
    "Envy": "#006400",
    "Guilt": "#2F4F4F",
    "Horror": "#8B0000",
    "Pain": "#8B0000",
    "Shame": "#2F4F4F",
    "Surprise (negative)": "#8B4513",
    "Tiredness": "#708090",
    "Awkwardness": "#DAA520",
    "Boredom": "#808080",
    "Doubt": "#696969",
    "Craving": "#8B4513",
}

EMOTION_TO_SENTIMENT = {
    "Joy": "positive",
    "Excitement": "positive",
    "Interest": "positive",
    "Surprise (positive)": "positive",
    "Contentment": "positive",
    "Satisfaction": "positive",
    "Relief": "positive",
    "Admiration": "positive",
    "Amusement": "positive",
    "Ecstasy": "positive",
    "Love": "positive",
    "Pride": "positive",
    "Triumph": "positive",
    "Realization": "positive",
    "Aesthetic Appreciation": "positive",
    "Adoration": "positive",
    "Calmness": "positive",
    "Concentration": "neutral",
    "Contemplation": "neutral",
    "Determination": "neutral",
    "Desire": "positive",
    "Romance": "positive",
    "Nostalgia": "neutral",
    "Entrancement": "positive",
    "Awe": "positive",
    "Anger": "negative",
    "Anxiety": "negative",
    "Fear": "negative",
    "Sadness": "negative",
    "Disgust": "negative",
    "Confusion": "neutral",
    "Contempt": "negative",
    "Disappointment": "negative",
    "Distress": "negative",
    "Embarrassment": "negative",
    "Empathic Pain": "negative",
    "Envy": "negative",
    "Guilt": "negative",
    "Horror": "negative",
    "Pain": "negative",
    "Shame": "negative",
    "Surprise (negative)": "negative",
    "Tiredness": "neutral",
    "Awkwardness": "negative",
    "Boredom": "neutral",
    "Doubt": "neutral",
    "Craving": "neutral",
}

EMOTION_TO_CATEGORY = {
    "Joy": "Optimism",
    "Excitement": "Optimism",
    "Interest": "Awe",
    "Surprise (positive)": "Awe",
    "Contentment": "Optimism",
    "Satisfaction": "Optimism",
    "Relief": "Optimism",
    "Admiration": "Awe",
    "Amusement": "Love",
    "Ecstasy": "Love",
    "Love": "Love",
    "Pride": "Optimism",
    "Triumph": "Optimism",
    "Realization": "Awe",
    "Aesthetic Appreciation": "Awe",
    "Adoration": "Love",
    "Calmness": "Optimism",
    "Concentration": "Submission",
    "Contemplation": "Awe",
    "Determination": "Optimism",
    "Desire": "Love",
    "Romance": "Love",
    "Nostalgia": "Remorse",
    "Entrancement": "Awe",
    "Awe": "Awe",
    "Anger": "Aggressiveness",
    "Anxiety": "Submission",
    "Fear": "Submission",
    "Sadness": "Remorse",
    "Disgust": "Disapproval",
    "Confusion": "Submission",
    "Contempt": "Contempt",
    "Disappointment": "Remorse",
    "Distress": "Remorse",
    "Embarrassment": "Submission",
    "Empathic Pain": "Remorse",
    "Envy": "Contempt",
    "Guilt": "Remorse",
    "Horror": "Disapproval",
    "Pain": "Remorse",
    "Shame": "Remorse",
    "Surprise (negative)": "Awe",
    "Tiredness": "Remorse",
    "Awkwardness": "Disapproval",
    "Boredom": "Disapproval",
    "Doubt": "Submission",
    "Craving": "Love",
}


class EmotionPrediction(BaseModel):
    time: dict
    emotions: List[Emotion]


async def process_audio_with_hume(
    audio_data: bytes, audio_format: str, message_id: str = None
) -> List[Emotion]:
    logger.log("HUME", f"Processing audio with Hume: {audio_format}")
    try:
        headers = {
            "X-Hume-Api-Key": HUME_API_KEY,
        }

        # Prepare the form data
        form_data = aiohttp.FormData()
        callback_url = f"{os.getenv('API_URL')}/ai/hume-callback/{message_id}" if message_id else None
        form_data.add_field("json", json.dumps({
            "models": {"prosody": {}},
            "callback_url": callback_url
        }))
        form_data.add_field(
            "file",
            audio_data,
            filename=f"audio.{audio_format.lower()}",
            content_type=f"audio/{audio_format.lower()}",
        )

        async with aiohttp.ClientSession() as session:
            # Start the job
            async with session.post(
                HUME_BATCH_URL, headers=headers, data=form_data
            ) as response:
                if response.status >= 400:
                    logger.error(
                        f"Failed to start Hume job (status {response.status}): {await response.text()}"
                    )
                    return []

                job_data = await response.json()
                job_id = job_data["job_id"]
                logger.log("HUME", f"Started job: {job_id}")
                return []  # Return empty list immediately, emotions will be added via callback

    except Exception as e:
        logger.error(f"Error in Hume API connection: {e}")
        logger.error(traceback.format_exc())
        return []
