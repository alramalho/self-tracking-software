from entities.notification import Notification
from gateways.database.mongodb import MongoDBGateway
from gateways.aws.event_bridge import EventBridgeCronGateway
from ai.llm import ask_text
from datetime import datetime, timedelta
from typing import List, Optional, Literal
import pytz
from bson.objectid import ObjectId
import random
from constants import (
    VAPID_PRIVATE_KEY,
    CHRON_PROXY_LAMBDA_TARGET_ARN,
    SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS,
    ENVIRONMENT,
)
from gateways.users import UsersGateway
from entities.user import User
from pywebpush import webpush, WebPushException
import json
import traceback
from loguru import logger
from typing import Dict
import time
from urllib.parse import urlparse
from analytics.posthog import posthog


class NotificationManager:
    def __init__(self):
        self.db_gateway = MongoDBGateway("notifications")
        self.users_gateway = UsersGateway()
        self.cron_gateway = EventBridgeCronGateway()

    def delete_notification(self, notification_id: str):
        notification = self.get_notification(notification_id)
        if notification:
            if notification.aws_cronjob_id:
                self.cron_gateway.delete(notification.aws_cronjob_id)
            self.db_gateway.delete_all("id", notification_id)
        else:
            logger.error(f"Notification {notification_id} not found")
            raise Exception(f"Notification {notification_id} not found")

    def create_or_get_notification(self, notification: Notification) -> Notification:

        existing_notifications = self.get_all_for_user(notification.user_id)

        # Get the date of the new notification
        notification_date = notification.created_at.date()

        for existing in existing_notifications:
            # avoid double creation
            same_date_and_message = (
                existing.created_at.date() == notification_date
                and existing.message == notification.message
            )
            same_scheduled_type = (
                notification.type == existing.type
                and notification.recurrence == existing.recurrence
                and notification.recurrence is not None
            )
            if same_date_and_message or same_scheduled_type:
                logger.info(
                    f"Duplicate notification found for user {notification.user_id} with message: {notification.message}. Deleting and recreating."
                )
                self.delete_notification(existing.id)

        if notification.recurrence:
            cron_str = self._generate_cron_string(
                notification.recurrence, SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS
            )
            notification.scheduled_for = self._get_next_occurrence(cron_str)
            aws_cronjob_id = self.cron_gateway.create(
                cron_str,
                target=CHRON_PROXY_LAMBDA_TARGET_ARN,
                payload={
                    "endpoint": "/process-scheduled-notification",
                    "request_body": {"notification_id": notification.id},
                },
            )
            notification.aws_cronjob_id = aws_cronjob_id

        self.db_gateway.write(notification.dict())
        return notification

    async def process_notification(
        self, notification_id: str
    ) -> Optional[Notification]:

        notification = self.get_notification(notification_id)
        if not notification or notification.status != "pending":
            return None

        notification.processed_at = datetime.now()
        notification.status = "processed"
        self._update_notification(notification)

        if notification.recurrence:
            self._reschedule_notification(notification)

        user = self.users_gateway.get_user_by_id(notification.user_id)
        is_push = False
        if user.pwa_subscription_endpoint:
            notification.sent_at = datetime.now()
            title = f"hey {user.name} 👋"
            body = notification.message.lower()
            await self.send_push_notification(user.id, title=title, body=body)
            is_push = True

        if notification.type == "engagement":
            posthog.capture(
                distinct_id=user.id,
                event="engagement-notification-sent",
                properties={
                    "notification_id": notification.id,
                    "title": title,
                    "body": body,
                    "is_push": is_push,
                },
            )

        logger.info(f"Notification '{notification.id}' processed")
        return notification

    async def create_and_process_notification(
        self, notification: Notification
    ) -> Optional[Notification]:
        notification = self.create_or_get_notification(notification)
        return await self.process_notification(notification.id)

    def mark_as_opened(self, notification_id: str) -> Optional[Notification]:
        notification = self.get_notification(notification_id)
        if notification and notification.status == "processed":
            notification.opened_at = datetime.now()
            notification.status = "opened"
            logger.info(
                f"Notification '{notification_id}' switched from {notification.status} to opened"
            )
            self._update_notification(notification)
            return notification
        return None

    def conclude_notification(self, notification_id: str) -> Optional[Notification]:
        notification = self.get_notification(notification_id)
        if notification:
            if notification.status == "concluded":
                logger.info(f"Notification '{notification_id}' already concluded")
                return notification
            notification.concluded_at = datetime.now()
            notification.status = "concluded"
            self._update_notification(notification)
            logger.info(
                f"Notification '{notification_id}' switched from {notification.status} to concluded"
            )
            return notification
        return None

    def get_notification(self, notification_id: str) -> Optional[Notification]:
        data = self.db_gateway.query("id", notification_id)
        return Notification(**data[0]) if data else None

    def get_all_for_user(self, user_id: str) -> List[Notification]:
        notifications = [
            Notification(**item)
            for item in self.db_gateway.query("user_id", user_id)
            if item["status"] != "concluded"
        ]
        notifications.sort(key=lambda x: x.created_at, reverse=True)
        return notifications

    def get_last_notifications_sent_to_user(
        self, user_id: str, limit: int = 10
    ) -> List[Notification]:
        notifications = [n for n in self.get_all_for_user(user_id) if n.processed_at]
        ordered_notifications = sorted(
            notifications, key=lambda x: x.processed_at, reverse=True
        )
        return ordered_notifications[:limit]

    def _update_notification(self, notification: Notification):
        self.db_gateway.write(notification.dict())

    def _reschedule_notification(self, notification: Notification):
        new_cron_str = self._generate_cron_string(
            notification.recurrence, SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS
        )
        new_aws_cronjob_id = self.cron_gateway.create(
            new_cron_str,
            target=CHRON_PROXY_LAMBDA_TARGET_ARN,
            payload={
                "endpoint": "/process-scheduled-notification",
                "request_body": {"notification_id": notification.id},
            },
        )
        self.cron_gateway.delete(notification.aws_cronjob_id)

        notification.aws_cronjob_id = new_aws_cronjob_id
        notification.scheduled_for = self._get_next_occurrence(new_cron_str)
        notification.status = "pending"
        notification.processed_at = None
        notification.opened_at = None
        self._update_notification(notification)

    def _generate_cron_string(
        self, recurrence: Literal["daily", "weekly"], time_deviation_in_hours: int
    ) -> str:
        now = datetime.now(pytz.UTC)
        if recurrence == "daily":
            base_time = now.replace(
                hour=12, minute=0, second=0, microsecond=0
            )  # Noon UTC
        elif recurrence == "weekly":
            base_time = now.replace(hour=12, minute=0, second=0, microsecond=0)
            days_ahead = 7 - base_time.weekday()
            if days_ahead == 7:
                days_ahead = 0
            base_time += timedelta(days=days_ahead)
        else:
            raise ValueError("Unsupported recurrence")

        random_deviation = timedelta(
            minutes=random.randint(
                -time_deviation_in_hours * 60, time_deviation_in_hours * 60
            )
        )
        target_time = base_time + random_deviation

        if recurrence == "daily":
            return f"cron({target_time.minute} {target_time.hour} * * ? *)"
        elif recurrence == "weekly":
            return f"cron({target_time.minute} {target_time.hour} ? * {target_time.strftime('%a').upper()} *)"

    def _get_next_occurrence(self, cron_str: str) -> datetime:
        # Implement logic to calculate the next occurrence based on the cron string
        # This is a placeholder and should be replaced with actual implementation
        return datetime.now() + timedelta(days=1)

    def _get_vapid_claims(self, subscription_endpoint: str) -> Dict[str, str]:
        parsed = urlparse(subscription_endpoint)
        audience = f"{parsed.scheme}://{parsed.netloc}"

        return {
            "sub": "mailto:alexandre.ramalho.1998@gmail.com",
            "aud": audience,
            "exp": int(time.time()) + 12 * 60 * 60,  # 12 hour expiration
        }

    async def send_push_notification(
        self, user_id: str, title: str, body: str, url: str = None, icon: str = None
    ):
        if ENVIRONMENT in ["dev", "development"]:
            logger.warning(
                f"Skipping push notification for '{user_id}' in '{ENVIRONMENT}' environment"
            )
            return

        subscription_info = self.users_gateway.get_subscription_info(user_id)
        if not subscription_info:
            logger.error(f"Subscription not found for {user_id}")
            raise Exception(f"Subscription not found for {user_id}")

        logger.info(f"Sending push notification to: {subscription_info}")
        logger.info(f"Payload: title: {title}, body: {body}, url: {url}, icon: {icon}")

        try:
            response = webpush(
                subscription_info,
                data=json.dumps(
                    {
                        "title": title,
                        "body": body,
                        "icon": icon,
                        "url": url,
                        "badge": self.get_pending_notifications_count(user_id),
                    }
                ),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=self._get_vapid_claims(subscription_info["endpoint"]),
            )

            posthog.capture(
                distinct_id=user_id,
                event="push-notification-sent",
                properties={"title": title, "body": body, "url": url, "icon": icon},
            )
            logger.info(f"WebPush response: {response.text}")
            return {"message": "Push notification sent successfully"}
        except WebPushException as ex:
            logger.error(f"WebPush error: {ex}")
            logger.error(traceback.format_exc())

    def get_pending_notifications_count(self, user_id: str) -> int:
        notifications = self.get_all_for_user(user_id)
        return len(
            [
                notification
                for notification in notifications
                if notification.status != "concluded"
            ]
        )

    async def send_test_push_notification(self, user_id: str):
        await self.create_and_process_notification(
            Notification.new(
                user_id=user_id,
                message="This is a test notification",
                type="info",
                related_id=None,
            )
        )


if __name__ == "__main__":
    from shared.logger import create_logger
    import asyncio

    create_logger()
    notification_manager = NotificationManager()

    for user in UsersGateway().get_all_users():
        if user.is_pwa_notifications_enabled:
            notification = asyncio.run(
                notification_manager.create_and_process_notification(
                    Notification.new(
                        user_id=user.id,
                        message="",  # This will be filled when processed
                        type="engagement",
                        recurrence="daily",
                        time_deviation_in_hours=SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS,
                    )
                )
            )
