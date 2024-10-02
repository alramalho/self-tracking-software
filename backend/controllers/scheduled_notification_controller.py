from models.processed_notification import ProcessedNotification
from controllers.processed_notification_controller import (
    ProcessedNotificationController,
)
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional, Literal
from gateways.aws.event_bridge import EventBridgeCronGateway
from gateways.database.mongodb import MongoDBGateway
from bson import ObjectId
from pydantic import Field
from constants import (
    CHRON_PROXY_LAMBDA_TARGET_ARN,
    SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS,
)
from ai.llm import ask_text
import pytz
import random
from controllers.prompt_controller import PromptController

class ScheduledNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(ObjectId()))
    created_at: str
    prompt_tag: str
    user_id: str
    activated: bool
    recurrence_cron_str: str
    aws_cronjob_id: str


class ScheduledNotificationController:
    def __init__(self):
        self.db_gateway = MongoDBGateway("scheduled_notifications")
        self.cron_gateway = EventBridgeCronGateway()
        self.processed_notification_controller = ProcessedNotificationController()

    def create(
        self,
        user_id: str,
        prompt_tag: str,
        recurrence: Literal["daily", "weekly"],
        time_deviation_in_hours: int,
    ) -> ScheduledNotification:
        cron_str = self._generate_cron_string(recurrence, time_deviation_in_hours)
        notification_id = str(ObjectId())
        aws_cronjob_id = self.cron_gateway.create(
            cron_str,
            target=CHRON_PROXY_LAMBDA_TARGET_ARN,
            payload={
                "endpoint": "/api/process-scheduled-notification",
                "request_body": {"notification_id": notification_id},
            },
        )

        notification = ScheduledNotification(
            id=notification_id,
            created_at=datetime.now().isoformat(),
            prompt_tag=prompt_tag,
            user_id=user_id,
            activated=True,
            recurrence_cron_str=cron_str,
            aws_cronjob_id=aws_cronjob_id,
        )

        self.db_gateway.write(notification.dict())
        return notification

    def update_time(self, notification_id: str) -> ScheduledNotification:
        old_notification = self.get(notification_id)
        if not old_notification:
            raise ValueError(f"Notification with id {notification_id} not found")

        recurrence = (
            "daily" if "* * ? *" in old_notification.recurrence_cron_str else "weekly"
        )

        new_notification = self.update(ScheduledNotification(
            id=old_notification.id,
            created_at=old_notification.created_at,
            prompt_tag=old_notification.prompt_tag,
            user_id=old_notification.user_id,
            activated=old_notification.activated,
            recurrence_cron_str=self._generate_cron_string(recurrence, SCHEDULED_NOTIFICATION_TIME_DEVIATION_IN_HOURS),
            aws_cronjob_id=old_notification.aws_cronjob_id,
        ))

        self.cron_gateway.create(
            new_notification.recurrence_cron_str,
            target=CHRON_PROXY_LAMBDA_TARGET_ARN,
            payload={
                "endpoint": "/api/process-scheduled-notification",
                "request_body": {"notification_id": new_notification.id},
            },
        )
        self.cron_gateway.delete(old_notification.aws_cronjob_id)

        return new_notification

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

    def get_all_for_user(self, user_id: str) -> List[ScheduledNotification]:
        return [
            ScheduledNotification(**item)
            for item in self.db_gateway.query("user_id", user_id)
        ]

    def delete(self, notification_id: str):
        notification = self.get(notification_id)
        if notification:
            self.cron_gateway.delete(notification.aws_cronjob_id)
            self.db_gateway.delete_all("id", notification_id)

    def update(self, notification: ScheduledNotification):
        self.db_gateway.write(notification.dict())
        return notification

    def process_notification(
        self, notification_id: str
    ) -> ProcessedNotification | None:
        scheduled_notification = self.get(notification_id)
        if not scheduled_notification or not scheduled_notification.activated:
            return None
        
        user_id = scheduled_notification.user_id

        prompt = PromptController().get_prompt(user_id, scheduled_notification.prompt_tag)
        message = ask_text(prompt, "").strip('"')

        if message:
            processed_notification = self.processed_notification_controller.create(
                scheduled_notification_id=notification_id,
                user_id=scheduled_notification.user_id,
                message=message,
            )
            return processed_notification

        return None

    def get(self, notification_id: str) -> Optional[ScheduledNotification]:
        data = self.db_gateway.query("id", notification_id)
        return ScheduledNotification(**data[0]) if len(data) > 0 else None