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


class EmotionWithColor(Emotion):
    color: str = "#000000"  # Default to black


class EmotionPrediction(BaseModel):
    time: dict
    emotions: List[EmotionWithColor]


async def process_audio_with_hume(
    audio_data: bytes, audio_format: str
) -> List[EmotionWithColor]:
    logger.log("HUME", f"Processing audio with Hume: {audio_format}")
    try:
        headers = {
            "X-Hume-Api-Key": HUME_API_KEY,
        }

        # Prepare the form data
        form_data = aiohttp.FormData()
        form_data.add_field("json", json.dumps({"models": {"prosody": {}}}))
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

            # Poll for results
            max_attempts = 30
            attempt = 0

            while attempt < max_attempts:
                async with session.get(
                    f"{HUME_BATCH_URL}/{job_id}/predictions", headers=headers
                ) as response:
                    if response.status < 300:
                        response_data = await response.json()
                        if len(response_data) > 0:
                            predictions = response_data[0].get('results', {}).get('predictions', [])
                            if predictions and len(predictions) > 0:
                                logger.log(
                                    "HUME",
                                    f"Received predictions: {json.dumps(response_data, indent=2)}",
                                )
                                break
                    elif response.status == 400 and "in progress" in await response.text():
                        logger.log("HUME", f"Job still in progress: {job_id}")
                    else:
                        logger.error(
                            f"Failed to get predictions (status {response.status}): {await response.text()}"
                        )
                        return []

                await asyncio.sleep(1)
                attempt += 1

            if attempt >= max_attempts:
                logger.error("Timeout waiting for Hume predictions")
                return []

            # Process the results
            all_emotions = []
            predictions = response_data[0]['results']['predictions']
            
            for prediction in predictions:
                if 'models' in prediction and 'prosody' in prediction['models']:
                    prosody_data = prediction['models']['prosody']
                    
                    if 'grouped_predictions' in prosody_data:
                        for group in prosody_data['grouped_predictions']:
                            if 'predictions' in group:
                                for pred in group['predictions']:
                                    if 'emotions' in pred:
                                        emotions = [
                                            EmotionWithColor(
                                                name=e["name"],
                                                score=e["score"],
                                                color=EMOTION_COLORS.get(e["name"], "#000000"),
                                            )
                                            for e in pred["emotions"]
                                        ]
                                        all_emotions.extend(emotions)

            # Average scores for same emotions
            emotion_dict = {}
            for emotion in all_emotions:
                if emotion.name in emotion_dict:
                    emotion_dict[emotion.name].append(emotion.score)
                else:
                    emotion_dict[emotion.name] = [emotion.score]

            # Create final emotion list with averaged scores
            # First create all emotions with averaged scores
            all_averaged_emotions = [
                EmotionWithColor(
                    name=name,
                    score=sum(scores) / len(scores),
                    color=EMOTION_COLORS.get(name, "#000000"),
                )
                for name, scores in emotion_dict.items()
            ]

            # Sort all emotions by score
            sorted_emotions = sorted(
                all_averaged_emotions, key=lambda x: x.score, reverse=True
            )

            # Filter by threshold, if none pass return just the highest scoring emotion
            final_emotions = [
                e for e in sorted_emotions 
                if e.score >= HUME_SCORE_FILTER_THRESHOLD
            ]
            if not final_emotions and sorted_emotions:
                final_emotions = [sorted_emotions[0]]

            logger.log(
                "HUME",
                f"Processed emotions: {json.dumps([e.dict() for e in final_emotions], indent=2)}",
            )
            return final_emotions

    except Exception as e:
        logger.error(f"Error in Hume API connection: {e}")
        logger.error(traceback.format_exc())
        return []
