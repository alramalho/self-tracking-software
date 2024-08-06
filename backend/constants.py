import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TTS_MODEL='tts-1'
TTS_VOICE="alloy"
LLM_MODEL='gpt-4o-mini'
STT_MODEL="whisper-1"
LLM_TEMPERATURE=0.7