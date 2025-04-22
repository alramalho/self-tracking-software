from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth.clerk import is_clerk_user
from entities.user import User
from services.notification_manager import NotificationManager
from constants import ADMIN_API_KEY, ENVIRONMENT
from entities.notification import Notification
from gateways.users import UsersGateway
from gateways.aws.s3 import S3Gateway
from gateways.activities import ActivitiesGateway
from pydantic import Field
from gateways.database.dynamodb import DynamoDBGateway
from typing import List
from services.telegram_service import TelegramService

from datetime import datetime, timedelta, date
from pytz import UTC
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from emails.loops import send_loops_event
from controllers.prompt_controller import RecurrentMessageGenerator
from shared.logger import logger
from bson import ObjectId
from entities.message import Message
from analytics.posthog import posthog
from gateways.aws.ses import SESGateway
import json
from pydantic import BaseModel
from typing import Optional, Set
from slowapi import Limiter
from gateways.metrics import MetricsGateway
from slowapi.util import get_remote_address
import pytz
from gateways.recommendations import RecommendationsGateway
import traceback

router = APIRouter()
security = HTTPBearer()
users_gateway = UsersGateway()
notification_manager = NotificationManager()
activities_gateway = ActivitiesGateway()
s3_gateway = S3Gateway()
ses_gateway = SESGateway()
prompt_controller = RecurrentMessageGenerator()
metrics_gateway = MetricsGateway()
recommendations_gateway = RecommendationsGateway()
limiter = Limiter(key_func=get_remote_address)

ALLOWED_ORIGINS: Set[str] = {
    "https://tracking.so",
    "https://app.tracking.so",
}

BLACKLISTED_IPS: Set[str] = set()  # Add known bad IPs
MAX_ERROR_LENGTH = 1000  # Prevent huge error messages

message_generator = RecurrentMessageGenerator()


async def admin_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> User:
    token = credentials.credentials

    if not ADMIN_API_KEY:
        raise HTTPException(status_code=500, detail="Admin API key not set")

    # Verify admin token
    if token != ADMIN_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True


@router.post("/send-notification")
async def send_notification(request: Request, verified: User = Depends(admin_auth)):
    body = await request.json()
    notification = Notification.new(
        user_id=body.get("user_id"),
        message=body.get("message"),
        type=body.get("type", "info"),
        related_id=body.get("related_id", None),
        prompt_tag=body.get("prompt_tag", None),
        related_data=body.get("related_data", None),
    )
    await notification_manager.create_and_process_notification(notification)
    return {"message": "Notification sent successfully"}


@router.post("/regenerate-image-url")
async def send_notification(request: Request, verified: User = Depends(admin_auth)):
    body = await request.json()
    activity_entry_id = body.get("activity_entry_id")
    activity_entry = activities_gateway.get_activity_entry_by_id(activity_entry_id)
    expiration_days = body.get(
        "expiration_days", 7
    )  # 7 days (max for s3 presigned url)
    url = s3_gateway.generate_presigned_url(
        activity_entry.image.s3_path, expiration_days * 24 * 60 * 60
    )

    activity_entry.image.url = url
    activity_entry.image.expires_at = (
        datetime.now(UTC) + timedelta(days=expiration_days)
    ).isoformat()
    activities_gateway.update_activity_entry(activity_entry.id, activity_entry.dict())

    return {"url": url}


@router.post("/send-notification-to-all-users")
async def send_notification_to_all_users(
    request: Request, verified: User = Depends(admin_auth)
):
    body = await request.json()
    users = users_gateway.get_all_users()
    filtered_usernames = body.get("filter_usernames", [])
    if len(filtered_usernames) > 0:
        users = [user for user in users if user.username in filtered_usernames]
        
    sent = 0
    for user in users:
        notification = Notification.new(
            user_id=user.id,
            message=body.get("message"),
            type=body.get("type", "info"),
            related_id=body.get("related_id", None),
            prompt_tag=body.get("prompt_tag", None),
            related_data=body.get("related_data", None),
        )
        await notification_manager.create_and_process_notification(notification)
        sent += 1
    return {"message": f"Notification sent successfully to {sent} users"}


async def _process_metrics_notification(
    users: list[User], dry_run: bool = True
) -> dict:
    notifications_processed = []
    for user in users:
        try:
            # Get user's local time - default to UTC if timezone not set
            user_tz = pytz.timezone(user.timezone) if user.timezone else UTC
            user_local_time = datetime.now(UTC).astimezone(user_tz)
            
            # Only process if it's 21:00 in user's timezone
            if user_local_time.hour != 21:
                continue
                
            missing_metrics_today, missing_metric_entries_today = (
                metrics_gateway.get_missing_metric_and_entries_today_by_user_id(user.id)
            )
            missing_metrics_titles = [
                f"{metric.title.lower()} {metric.emoji}"
                for metric in missing_metrics_today
            ]
            missing_metrics_titles_str = " and ".join([", ".join(missing_metrics_titles[:-1]), missing_metrics_titles[-1]]) if len(missing_metrics_titles) > 1 else missing_metrics_titles[0] if missing_metrics_titles else ""
            if len(missing_metric_entries_today) > 0:
                notification = Notification.new(
                    user_id=user.id,
                    message=f"Almost midnight! Don't forget to rate your {missing_metrics_titles_str} today",
                    type="metric-checkin",
                    recurrence=None,
                )
                if not dry_run:
                    notification = (
                        await notification_manager.create_and_process_notification(
                            notification
                        )
                    )

                notifications_processed.append(
                    {
                        "user": {
                            "username": user.username,
                            "id": user.id,
                            "timezone": user.timezone or "UTC",
                            "local_time": user_local_time.strftime("%H:%M"),
                        },
                        "notification_message": notification.message,
                    }
                )
        except Exception as e:
            logger.error(f"Error processing metrics notification for user {user.username}: {str(e)}")
            continue

    return {"notifications_processed": notifications_processed}


async def _process_checkin_notifications(
    users: list[User], dry_run: bool = True
) -> dict:
    notifications_processed = []

    filtered_users = [
        u
        for u in users
        if posthog.feature_enabled("ai-bot-access", u.id) or ENVIRONMENT == "dev"
    ]

    for user in filtered_users:
        try:
            message_id = str(ObjectId())
            message = await message_generator.generate_message(
                user.id, "user-recurrent-checkin"
            )

            notification = Notification.new(
                user_id=user.id,
                message=message,
                type="engagement",
                recurrence=None,
                related_data={
                    "message_id": message_id,
                    "message_text": message,
                },
            )

            if not dry_run:
                notification = (
                    await notification_manager.create_and_process_notification(
                        notification
                    )
                )
                memory = DatabaseMemory(DynamoDBGateway("messages"), user.id)
                memory.write(
                    Message.new(
                        id=message_id,
                        text=message,
                        sender_name="Jarvis",
                        sender_id="0",
                        recipient_name=user.name,
                        recipient_id=user.id,
                        emotions=[],
                    )
                )

            notifications_processed.append(
                {
                    "user": {
                        "username": user.username,
                        "id": user.id,
                    },
                    "notification": {
                        "message": notification.message,
                        "sent_at": notification.created_at,
                        "id": notification.id,
                    },
                }
            )
        except Exception as e:
            logger.error(traceback.format_exc())
            logger.error(
                f"Error processing notification for user {user.username}: {str(e)}"
            )
            continue

    return {"notifications_processed": notifications_processed}


async def _process_unactivated_emails(users: list[User], dry_run: bool = True) -> dict:
    """
    Process and send emails for unactivated users
    """
    # Find unactivated users (registered > 2 days ago with no activity entry on more than one day)
    unactivated_users = []
    for user in users:
        user_activities = activities_gateway.get_all_activity_entries_by_user_id(
            user.id
        )
        activity_days = {
            datetime.fromisoformat(entry.created_at).date() for entry in user_activities
        }

        if (
            datetime.fromisoformat(user.created_at)
            < (datetime.now(UTC) - timedelta(days=7))
            and len(activity_days) <= 1  # Activities on 1 or fewer days
        ):
            unactivated_users.append(user)

    if dry_run:
        return {
            "message": "Email sending skipped (dry run)",
            "would_email": len(unactivated_users),
            "would_email_usernames": [user.username for user in unactivated_users],
        }

    triggered_users = []
    for user in unactivated_users:
        if user.unactivated_email_sent_at:
            logger.info(
                f"Unactivated email already sent to '{user.username}', skipping"
            )
            continue
        send_loops_event(user.email, "unactivated")
        users_gateway.update_fields(
            user.id, {"unactivated_email_sent_at": datetime.now(UTC).isoformat()}
        )
        posthog.capture(distinct_id=user.id, event="unactivated_loops_event_triggered")
        triggered_users.append(user.username)

    result = {
        "emails_sent": len(triggered_users),
        "emailed_usernames": triggered_users,
        "unactivated_users_count": len(unactivated_users),
    }

    return result


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


@router.post("/run-daily-metrics-notification")
async def run_daily_metrics_notification(
    request: Request, verified: User = Depends(admin_auth)
):
    print("metrics notification disabled, for now")
    # body = await request.json()
    # filter_usernames = body.get("filter_usernames", [])
    # send_report = body.get("send_report", False)
    # dry_run = body.get("dry_run", True)

    # users = users_gateway.get_all_users()
    # if len(filter_usernames) > 0:
    #     users = [user for user in users if user.username in filter_usernames]

    # metrics_notification_result = await _process_metrics_notification(users, dry_run)

    # result = {
    #     "dry_run": dry_run,
    #     "metrics_notification_result": metrics_notification_result,
    # }

    # if send_report and len(metrics_notification_result.get("notifications_processed", [])) > 0:
    #     current_time = datetime.now(UTC).strftime("%Y-%m-%d")
    #     ses_gateway.send_email(
    #         to="alexandre.ramalho.1998@gmail.com",
    #         subject=f"Daily Metrics Notification for Tracking.so [{ENVIRONMENT}] [{current_time}]",
    #         html_body=f"<strong>in {ENVIRONMENT} environment</strong><br><br><pre>{json.dumps(result, indent=2, default=json_serial)}</pre>",
    #     )

    # return result

def _process_recommendations_outdated(users: List[User]) -> dict:
    result = []
    for user in users:
        if user.recommendations_outdated:
            recommendations_gateway.compute_recommended_users(user)
            result.append(user.username)
    return result


@router.post("/run-daily-job")
async def run_daily_job(request: Request, verified: User = Depends(admin_auth)):
    body = await request.json()
    filter_usernames = body.get("filter_usernames", [])
    dry_run = body.get("dry_run", True)
    send_report = body.get("send_report", False)

    unactivated_emails_dry_run = dry_run.get("unactivated_emails", True)
    notifications_dry_run = dry_run.get("notifications", True)

    logger.info(
        f"Running unactivated check with subset_usernames: {filter_usernames} and unactivated_emails_dry_run: {unactivated_emails_dry_run} and notifications_dry_run: {notifications_dry_run}"
    )

    # Get all users or subset if specified
    all_users = users_gateway.get_all_users()

    if len(filter_usernames) > 0:
        filtered_users = [
            user for user in all_users if user.username in filter_usernames
        ]
    else:
        filtered_users = all_users

    # Process notifications and emails
    # notification_result = await _process_checkin_notifications(
    #     filtered_users, notifications_dry_run
    # )
    unactivated_emails_result = await _process_unactivated_emails(
        filtered_users, unactivated_emails_dry_run
    )
    recommendations_outdated_result = await _process_recommendations_outdated(
        filtered_users
    )

    result = {
        "dry_run": {
            "unactivated_emails": unactivated_emails_dry_run,
            # "notifications": notifications_dry_run,
        },
        "users_checked": len(filtered_users),
        # "notification_result": notification_result,
        "recommendations_outdated": recommendations_outdated_result,
        "unactivated_emails_result": unactivated_emails_result,
    }

    if send_report:
        current_time = datetime.now(UTC).strftime("%Y-%m-%d")
        ses_gateway.send_email(
            to="alexandre.ramalho.1998@gmail.com",
            subject=f"Daily Job for Tracking.so [{ENVIRONMENT}] [{current_time}]",
            html_body=f"<strong>in {ENVIRONMENT} environment</strong><br><br><pre>{json.dumps(result, indent=2, default=json_serial)}</pre>",
        )

    return result


# WebSocket close codes as defined in RFC 6455
WS_CLOSE_CODES = {
    1000: "Normal Closure",
    1001: "Going Away",
    1002: "Protocol Error",
    1003: "Unsupported Data",
    1004: "Reserved",
    1005: "No Status Received",
    1006: "Abnormal Closure",
    1007: "Invalid Frame Payload Data",
    1008: "Policy Violation",
    1009: "Message Too Big",
    1010: "Mandatory Extension",
    1011: "Internal Server Error",
    1012: "Service Restart",
    1013: "Try Again Later",
    1014: "Bad Gateway",
    1015: "TLS Handshake"
}

class GlobalErrorLog(BaseModel):
    error_message: str
    user_clerk_id: Optional[str] = None
    error_digest: Optional[str] = None
    url: str
    referrer: str
    user_agent: Optional[str] = None
    timestamp: str


@router.post("/admin/public/log-error", tags=["public"])
@limiter.limit("3/minute")
async def log_error(error: GlobalErrorLog, request: Request):
    """Protected public endpoint to log client-side errors"""

    # 1. Origin Check
    origin = request.headers.get("origin")
    if not origin or origin not in ALLOWED_ORIGINS:
        logger.warning(f"Blocked request from unauthorized origin: {origin}")
        raise HTTPException(status_code=403, detail="Invalid origin")

    # 2. IP Check
    client_ip = request.client.host
    if client_ip in BLACKLISTED_IPS:
        logger.warning(f"Blocked request from blacklisted IP: {client_ip}")
        raise HTTPException(status_code=403, detail="IP blocked")

    # 3. Content Validation
    if len(error.error_message) > MAX_ERROR_LENGTH:
        raise HTTPException(status_code=400, detail="Error message too long")

    # 4. Referrer Validation
    if error.referrer != "direct" and not any(
        error.referrer.startswith(origin) for origin in ALLOWED_ORIGINS
    ):
        logger.warning(f"Suspicious referrer: {error.referrer}")
        # Maybe don't block but flag in logs/email

    try:
        # Extract domain from referrer
        referrer_domain = error.referrer
        if error.referrer and error.referrer != "direct":
            try:
                from urllib.parse import urlparse

                parsed = urlparse(error.referrer)
                referrer_domain = parsed.netloc or parsed.path
            except:
                referrer_domain = error.referrer


        user = None
        try:
            user = users_gateway.get_user_by("clerk_id", error.user_clerk_id)
        except:
            logger.warning(f"User with clerk_id '{error.user_clerk_id}' not found")
            pass

        # Add request context to the log
        context = {
            "user_clerk_id": error.user_clerk_id,
            "user_username": user.username if user else "unknown",
            "error_message": error.error_message,
            "error_digest": error.error_digest,
            "url": error.url,
            "referrer": error.referrer,
            "referrer_domain": referrer_domain,
            "user_agent": error.user_agent,
            "timestamp": error.timestamp,
            "ip": request.client.host,
            "environment": ENVIRONMENT,
        }

        # 5. Add security context to logs
        context["origin"] = origin
        context["passed_security"] = True
        context["user_id"] = error.user_clerk_id
        context["user_username"] = user.username if user else "unknown"

        # Log to your regular logging system
        logger.error("Client Error", extra=context)

        # Track in PostHog
        posthog.capture(
            distinct_id="anonymous", event="client_error", properties=context
        )
        telegram = TelegramService()
        # Send error notification to Telegram
        
        telegram.send_error_notification(
            error_message=f"500 page client error: {error.error_message}\nContext: {context}",
            user_username=user.username if user else "unknown",
            user_id=error.user_clerk_id,
            path=request.url.path,
            status_code="500",
            method=request.method
        )

        # Send email for critical errors in production
        if ENVIRONMENT == "production":
            ses_gateway.send_email(
                to="alexandre.ramalho.1998@gmail.com",
                subject=f"Client Error in {ENVIRONMENT}",
                html_body=f"<strong>Client Error in {ENVIRONMENT}</strong><br><br><pre>{json.dumps(context, indent=2)}</pre>",
            )

        return {"status": "success"}
    except Exception as e:
        logger.exception("Failed to log client error")
        raise HTTPException(status_code=500, detail="Failed to log error")
