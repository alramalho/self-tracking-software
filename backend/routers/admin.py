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
from datetime import datetime, timedelta
from pytz import UTC
from emails.loops import send_loops_event
from shared.logger import logger
from analytics import posthog
from gateways.aws.ses import SESGateway
import json

router = APIRouter()
security = HTTPBearer()
users_gateway = UsersGateway()
notification_manager = NotificationManager()
activities_gateway = ActivitiesGateway()
s3_gateway = S3Gateway()
ses_gateway = SESGateway()


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


@router.post("/trigger-unactivated-check")
async def run_daily_validations(
    request: Request, dry_run: bool = False, verified: User = Depends(admin_auth)
):
    body = await request.json()
    subset_usernames = body.get("subset_usernames", [])
    dry_run = body.get("dry_run", True)
    logger.info(
        f"Running unactivated check with subset_usernames: {subset_usernames} and dry_run: {dry_run}"
    )

    # unactivated users are users who have registered > 2 days ago and have no activity entry
    all_users = users_gateway.get_all_users()
    all_users = [user for user in all_users if user.username in subset_usernames]

    unactivated_users = []
    for user in all_users:
        if (
            datetime.fromisoformat(user.created_at)
            < (datetime.now(UTC) - timedelta(days=2))
            and len(activities_gateway.get_all_activity_entries_by_user_id(user.id))
            == 0
        ):
            unactivated_users.append(user)

    result = {
        "message": f"Unactivated loops event {'' if dry_run else 'not'} triggered",
        "users_checked": len(all_users),
        "qualifiable_users": {
            "user_count": len(unactivated_users),
            "username_list": [user.username for user in unactivated_users],
        },
    }

    if not dry_run:
        triggered_users = []
        for user in unactivated_users:
            send_loops_event(user.email, "unactivated")
            posthog.capture(
                distinct_id=user.id, event="unactivated_loops_event_triggered"
            )
            triggered_users.append(user.username)

        result["triggered_users_count"] = len(triggered_users)
        result["triggered_users"] = triggered_users

        ses_gateway.send_email(
            to="alexandre.ramalho.1998@gmail.com",
            subject="Unactivated loops event triggered",
            html_body=f"<strong>in {ENVIRONMENT} environment</strong><br><br><pre>{json.dumps(result, indent=2)}</pre>",
        )

    return result
