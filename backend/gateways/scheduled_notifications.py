from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional
from gateways.aws.event_bridge import EventBridgeCronGateway
from gateways.database.mongodb import MongoDBGateway
from constants import CHRON_PROXY_LAMBDA_TARGET_ARN
from services.conversation_service import get_last_interaction_date, get_recent_activity_entries
from ai.llm import ask_text
import pytz
import random
import uuid

class ScheduledNotification(BaseModel):
    id: str
    created_at: str
    purpose_prompt: str
    user_id: str
    activated: bool
    recurrence_cron_str: str
    aws_cronjob_id: str

class ScheduledNotificationController:
    def __init__(self):
        self.db_gateway = MongoDBGateway("scheduled_notifications")
        self.cron_gateway = EventBridgeCronGateway()

    def create(self, user_id: str, purpose_prompt: str, recurrence: str, time_deviation_in_hours: int) -> ScheduledNotification:
        cron_str = self._generate_cron_string(recurrence, time_deviation_in_hours)
        notification_id = str(uuid.uuid4())
        aws_cronjob_id = self.cron_gateway.create(
            cron_str,
            target=CHRON_PROXY_LAMBDA_TARGET_ARN,
            payload={"endpoint": "/api/process-scheduled-notification", "request_body": {"notification_id": notification_id}}
        )

        notification = ScheduledNotification(
            id=notification_id,
            created_at=datetime.now().isoformat(),
            purpose_prompt=purpose_prompt,
            user_id=user_id,
            activated=True,
            recurrence_cron_str=cron_str,
            aws_cronjob_id=aws_cronjob_id
        )

        self.db_gateway.write(notification.dict())
        return notification
    
    def recreate(self, notification_id: str) -> ScheduledNotification:
        notification = self.get(notification_id)
        if not notification:
            raise ValueError(f"Notification with id {notification_id} not found")

        recurrence = 'daily' if '* * ? *' in notification.recurrence_cron_str else 'weekly'
        time_deviation_in_hours = 3  # Assuming 3 hours deviation

        new_notification = self.create(
            user_id=notification.user_id,
            purpose_prompt=notification.purpose_prompt,
            recurrence=recurrence,
            time_deviation_in_hours=time_deviation_in_hours
        )
        
        self.delete(notification.id)
        self.cron_gateway.delete(notification.aws_cronjob_id)

        return new_notification

    def _generate_cron_string(self, recurrence: str, time_deviation_in_hours: int) -> str:
        now = datetime.now(pytz.UTC)
        if recurrence == 'daily':
            base_time = now.replace(hour=12, minute=0, second=0, microsecond=0)  # Noon UTC
        elif recurrence == 'weekly':
            base_time = now.replace(hour=12, minute=0, second=0, microsecond=0)
            days_ahead = 7 - base_time.weekday()
            if days_ahead == 7:
                days_ahead = 0
            base_time += timedelta(days=days_ahead)
        else:
            raise ValueError("Unsupported recurrence")

        random_deviation = timedelta(minutes=random.randint(-time_deviation_in_hours*60, time_deviation_in_hours*60))
        target_time = base_time + random_deviation

        if recurrence == 'daily':
            return f"cron({target_time.minute} {target_time.hour} * * ? *)"
        elif recurrence == 'weekly':
            return f"cron({target_time.minute} {target_time.hour} ? * {target_time.strftime('%a').upper()} *)"

    def get_all_for_user(self, user_id: str) -> List[ScheduledNotification]:
        return [ScheduledNotification(**item) for item in self.db_gateway.query("user_id", user_id)]

    def delete(self, notification_id: str):
        notification = self.db_gateway.get_item("id", notification_id)
        if notification:
            self.cron_gateway.delete(notification['aws_cronjob_id'])
            self.db_gateway.delete_item("id", notification_id)

    def update(self, notification: ScheduledNotification):
        self.db_gateway.write(notification.dict())

    def process_notification(self, notification_id: str) -> str:
        notification = self.get(notification_id)
        if not notification or not notification.activated:
            return ""

        return ask_text(notification.purpose_prompt)

    def get(self, notification_id: str) -> Optional[ScheduledNotification]:
        item = self.db_gateway.get_item("id", notification_id)
        return ScheduledNotification(**item) if item else None