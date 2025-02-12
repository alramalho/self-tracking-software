import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
FIREWORKS_API_KEY = os.getenv("FIREWORKS_API_KEY")
LLM_MODEL="gpt-4o-mini"
# LLM_MODEL="fireworks:accounts/fireworks/models/deepseek-v3"
# LLM_MODEL="lmstudio:deepseek-r1-distill-qwen-32b"
SHARED_ENCRYPTION_KEY=os.getenv("SHARED_ENCRYPTION_KEY")
TTS_MODEL='tts-1'
TTS_VOICE="alloy"
STT_MODEL="whisper-1"
LLM_TEMPERATURE=0.7
ENVIRONMENT=os.getenv("ENVIRONMENT", "dev")
MONGO_DB_NAME="trackingso"
MONGO_DB_CONNECTION_STRING=os.getenv("MONGO_DB_CONNECTION_STRING")
CLERK_JWT_PUBLIC_KEY=os.getenv("CLERK_JWT_PUBLIC_KEY")
SVIX_SECRET=os.getenv("SVIX_SECRET")

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")

CHRON_PROXY_LAMBDA_TARGET_ARN=os.getenv("CHRON_PROXY_LAMBDA_TARGET_ARN")
AWS_ACCESS_KEY_ID=os.getenv("OVERRIDE_AWS_ACCESS_KEY_ID", os.getenv("AWS_ACCESS_KEY_ID"))
AWS_SECRET_ACCESS_KEY=os.getenv("OVERRIDE_AWS_SECRET_ACCESS_KEY", os.getenv("AWS_SECRET_ACCESS_KEY"))
S3_BUCKET_NAME=f"tracking-software-bucket-{ENVIRONMENT.replace('dev', 'sandbox')}" # theres no aws dev env yet
SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS=3
JINA_API_KEY=os.getenv("JINA_API_KEY")

URL = "http://localhost:3000" if ENVIRONMENT == "dev" else "https://app.tracking.so"

POSTHOG_API_KEY=os.getenv("POSTHOG_API_KEY", "phc_7777777777777777777777777777777777777777777777777777777777777777")
POSTHOG_HOST="https://eu.i.posthog.com"

ADMIN_API_KEY=os.getenv("ADMIN_API_KEY")

MAX_TIMELINE_ENTRIES = 30

HUME_API_KEY=os.getenv("HUME_API_KEY")
HUME_SECRET_KEY=os.getenv("HUME_SECRET_KEY")
HUME_WS_URL="wss://api.hume.ai/v0/stream/models"
HUME_BATCH_URL = "https://api.hume.ai/v0/batch/jobs"
HUME_SCORE_FILTER_THRESHOLD=0.5

LOOPS_API_KEY=os.getenv("LOOPS_API_KEY")
API_URL=os.getenv("API_URL")

TALLY_SIGNING_SECRET = os.getenv("TALLY_SIGNING_SECRET")

OTEL_ENABLED = os.getenv("OTEL_ENABLED", "false")
AXIOM_DATASET = os.getenv("AXIOM_DATASET")
AXIOM_BATCH_SIZE = os.getenv("AXIOM_BATCH_SIZE", "10")
AXIOM_FLUSH_INTERVAL = os.getenv("AXIOM_FLUSH_INTERVAL", "5")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
