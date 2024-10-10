import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SHARED_ENCRYPTION_KEY=os.getenv("SHARED_ENCRYPTION_KEY")
TTS_MODEL='tts-1'
TTS_VOICE="alloy"
LLM_MODEL='gpt-4o-mini'
STT_MODEL="whisper-1"
LLM_TEMPERATURE=0.7
ENVIRONMENT=os.getenv("ENVIRONMENT", "dev")
MONGO_DB_NAME="trackingso"
MONGO_DB_CONNECTION_STRING=os.getenv("MONGO_DB_CONNECTION_STRING")
CLERK_JWT_PUBLIC_KEY=os.getenv("CLERK_JWT_PUBLIC_KEY")
SVIX_SECRET=os.getenv("SVIX_SECRET")

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_CLAIMS = {
    "sub": "mailto:alexandre.ramalho.1998@gmail.com"
}

CHRON_PROXY_LAMBDA_TARGET_ARN=os.getenv("CHRON_PROXY_LAMBDA_TARGET_ARN")
AWS_ACCESS_KEY_ID=os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY=os.getenv("AWS_SECRET_ACCESS_KEY")
S3_BUCKET_NAME=f"tracking-software-bucket-{ENVIRONMENT.replace('dev', 'sandbox')}" # theres no aws dev env yet
SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS=3
