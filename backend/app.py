from fastapi import FastAPI, WebSocket, Request
from shared.logger import create_logger
from constants import ENVIRONMENT
if ENVIRONMENT == "production":
   level = "INFO"
else:
    level = "DEBUG"

create_logger(level=level)

from fastapi.middleware.cors import CORSMiddleware
import base64
import json
from loguru import logger
import traceback
import asyncio
from routers.evaluation import evaluation_router
from routers.clerk import router as clerk_router
from routers.users import router as users_router
from routers.activities import router as activities_router
from routers.plans import router as plans_router
from routers.admin import router as admin_router
from routers.notifications import router as notifications_router
from routers.tally import router as tally_router
from routers.ai import router as ai_router
from starlette.middleware.base import BaseHTTPMiddleware
from analytics.posthog import posthog
from fastapi.responses import Response
from auth.clerk import get_token_from_request, validate_token
from gateways.users import UsersGateway
from entities.user import User
from typing import Optional
from telemetry import init_telemetry
from services.telegram_service import TelegramService

app = FastAPI()

# Initialize OpenTelemetry
init_telemetry(app)

async def get_user_from_request(request: Request) -> Optional[User]:
    try:
        # Try to get the user ID from the token
        token = get_token_from_request(request)
        validated, clerk_id = await validate_token(token)
        if validated:
            user_clerk_id = clerk_id

        if user_clerk_id:
            return UsersGateway().get_user_by_safely("clerk_id", user_clerk_id)
    except:
        pass


class LoggingMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.telegram = TelegramService()

    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)

            # Get the response body
            response_body = b""
            async for chunk in response.body_iterator:
                response_body += chunk

            # Log the response body and traceback for errors
            if response.status_code >= 400:
                error_message = f"Error response body: {response_body.decode()}"
                user = await get_user_from_request(request)
                user_id = user.id if user else "unknown"
                
                posthog.capture(
                    distinct_id=user_id,
                    event='error',
                    properties={
                        "error": error_message,
                        "user_id": user_id,
                        "user_username": user.username if user else "unknown",
                        "path": request.url.path,
                        "method": request.method,
                        "status_code": response.status_code,
                    },
                )

                # Send error notification to Telegram
                self.telegram.send_error_notification(
                    error_message=error_message,
                    user_username=user.username if user else "unknown",
                    user_id=user_id,
                    path=request.url.path,
                    method=request.method
                )

                logger.error(error_message)

            # Re-create the response with the consumed body
            return Response(
                content=response_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type,
            )
        except Exception as e:
            error_message = f"Unhandled error: {str(e)}\n{traceback.format_exc()}"
            user = await get_user_from_request(request)
            user_id = user.id if user else "unknown"
            
            posthog.capture(
                distinct_id=user_id,
                event='error',
                properties={
                    "error": error_message,
                    "user_id": user_id,
                    "user_username": user.username if user else "unknown",
                    "path": request.url.path,
                    "method": request.method,
                    "status_code": 500,
                },
            )

            # Send error notification to Telegram
            self.telegram.send_error_notification(
                error_message=error_message,
                user_id=user_id,
                path=request.url.path,
                method=request.method
            )

            logger.error(error_message)
            
            return Response(
                content=json.dumps({"detail": str(e)}),
                status_code=500,
                media_type="application/json"
            )


app.add_middleware(LoggingMiddleware)

app.include_router(clerk_router)
app.include_router(evaluation_router)

app.include_router(users_router)
app.include_router(activities_router)
app.include_router(plans_router)
app.include_router(notifications_router)
app.include_router(ai_router)
app.include_router(admin_router)
app.include_router(tally_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import HTTPException

@app.get("/health")
def read_root():
    logger.info("Health check")
    return {"status": "ok"}

@app.get("/exception")
def read_root():
    raise HTTPException(status_code=500, detail="test")
    return {"status": "ok"}
