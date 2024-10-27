from entities.notification import Notification
from gateways.database.mongodb import MongoDBGateway
from gateways.aws.event_bridge import EventBridgeCronGateway
from controllers.prompt_controller import PromptController
from ai.llm import ask_text
from datetime import datetime, timedelta
from typing import List, Optional, Literal
import pytz
from bson.objectid import ObjectId
import random
from constants import VAPID_PRIVATE_KEY, VAPID_CLAIMS, CHRON_PROXY_LAMBDA_TARGET_ARN, SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS
from gateways.users import UsersGateway
from entities.user import User
from pywebpush import webpush, WebPushException
import json
import traceback
from loguru import logger
from pydantic import BaseModel


class NotificationManager:
    def __init__(self):
        self.db_gateway = MongoDBGateway("notifications")
        self.users_gateway = UsersGateway()
        self.cron_gateway = EventBridgeCronGateway()
        self.prompt_controller = PromptController()

    def create_notification(
        self,
        notification: Notification
    ) -> Notification:
        notification = Notification(
            id=notification.id or str(ObjectId()),
            user_id=notification.user_id,
            message=notification.message,
            type=notification.type,
            related_id=notification.related_id,
            prompt_tag=notification.prompt_tag,
            recurrence=notification.recurrence,
        )

        if notification.recurrence:
            cron_str = self._generate_cron_string(notification.recurrence, SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS)
            notification.scheduled_for = self._get_next_occurrence(cron_str)
            aws_cronjob_id = self.cron_gateway.create(
                cron_str,
                target=CHRON_PROXY_LAMBDA_TARGET_ARN,
                payload={
                    "endpoint": "/api/process-scheduled-notification",
                    "request_body": {"notification_id": notification.id},
                },
            )
            notification.aws_cronjob_id = aws_cronjob_id

        self.db_gateway.write(notification.dict())
        return notification

    def process_notification(self, notification_id: str) -> Optional[Notification]:

        notification = self.get_notification(notification_id)
        if not notification or notification.status != "pending":
            return None

        if notification.type == "engagement":
            prompt = self.prompt_controller.get_prompt(notification.user_id, notification.prompt_tag)
            message = ask_text(prompt, "").strip('"')
            notification.message = message

        notification.processed_at = datetime.now()
        notification.status = "processed"
        self._update_notification(notification)

        if notification.recurrence:
            self._reschedule_notification(notification)

        user = self.users_gateway.get_user_by_id(notification.user_id)
        if user.pwa_subscription_endpoint:
            self.send_push_notification(user, title=f"hey {user.name}", body=notification.message.lower())

        return notification
    
    def create_and_process_notification(self, notification: Notification) -> Optional[Notification]:
        notification = self.create_notification(notification)
        return self.process_notification(notification.id)

    def mark_as_opened(self, notification_id: str) -> Optional[Notification]:
        notification = self.get_notification(notification_id)
        if notification and notification.status == "processed":
            notification.opened_at = datetime.now()
            notification.status = "opened"
            logger.info(f"Notification '{notification_id}' switched from {notification.status} to opened")
            self._update_notification(notification)
            return notification
        return None

    def conclude_notification(self, notification_id: str) -> Optional[Notification]:
        notification = self.get_notification(notification_id)
        if notification and notification.status != "concluded":
            notification.concluded_at = datetime.now()
            notification.status = "concluded"
            self._update_notification(notification)
            logger.info(f"Notification '{notification_id}' switched from {notification.status} to concluded")
            return notification
        return None

    def get_notification(self, notification_id: str) -> Optional[Notification]:
        data = self.db_gateway.query("id", notification_id)
        return Notification(**data[0]) if data else None

    def get_all_for_user(self, user_id: str) -> List[Notification]:
        return [Notification(**item) for item in self.db_gateway.query("user_id", user_id) if item["status"] != "concluded"]
    
    def get_last_notifications_sent_to_user(self, user_id: str, limit: int = 10) -> List[Notification]:
        notifications = self.get_all_for_user(user_id)
        ordered_notifications = sorted(notifications, key=lambda x: x.processed_at, reverse=True)
        return ordered_notifications[:limit]

    def _update_notification(self, notification: Notification):
        self.db_gateway.write(notification.dict())

    def _reschedule_notification(self, notification: Notification):
        new_cron_str = self._generate_cron_string(notification.recurrence, SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS)
        new_aws_cronjob_id = self.cron_gateway.create(
            new_cron_str,
            target=CHRON_PROXY_LAMBDA_TARGET_ARN,
            payload={
                "endpoint": "/api/process-scheduled-notification",
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
    
    async def send_push_notification(self, user: User, title: str, body: str, url: str = None, icon: str = None):
        subscription_info = self.users_gateway.get_subscription_info(user.id)
        if not subscription_info:
            logger.error(f"Subscription not found for {user.id}")
            raise Exception(f"Subscription not found for {user.id}")

        print(f"Sending push notification to: {subscription_info}")
        print(f"Payload: title: {title}, body: {body}, url: {url}, icon: {icon}")

        try:
            response = webpush(
                subscription_info,
                data=json.dumps(
                    {
                        "title": title,
                        "body": body,
                        "icon": icon,
                        "url": url,
                    }
                ),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS,
            )
            print(f"WebPush response: {response.text}")
            return {"message": "Push notification sent successfully"}
        except WebPushException as ex:
            print(f"WebPush error: {ex}")
            traceback.print_exc()
            raise Exception(f"Failed to send push notification: {ex}")



    