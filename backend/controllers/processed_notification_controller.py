from models.processed_notification import ProcessedNotification
from gateways.database.mongodb import MongoDBGateway
from typing import List
from datetime import datetime

class ProcessedNotificationController:
    def __init__(self):
        self.db_gateway = MongoDBGateway("processed_notifications")

    def create(self, scheduled_notification_id: str, user_id: str, message: str) -> ProcessedNotification:
        notification = ProcessedNotification(
            scheduled_notification_id=scheduled_notification_id,
            user_id=user_id,
            processed_at=datetime.now(),
            message=message
        )
        self.db_gateway.write(notification.dict())
        return notification

    def mark_as_opened(self, notification_id: str) -> ProcessedNotification | None:
        notification_data = self.db_gateway.query("id", notification_id)
        if not notification_data:
            return None
        
        notification = ProcessedNotification(**notification_data[0])
        notification.opened_at = datetime.now()
        self.db_gateway.write(notification.dict())
        return notification

    def get(self, notification_id: str) -> ProcessedNotification | None:
        notification_data = self.db_gateway.query("id", notification_id)
        return ProcessedNotification(**notification_data[0]) if notification_data else None
    
    def get_all_for_user(self, user_id: str) -> List[ProcessedNotification]:
        return [ProcessedNotification(**notification) for notification in self.db_gateway.query("user_id", user_id)]    
    
    def get_last_notifications_sent_to_user(self, user_id: str, limit: int = 10) -> List[ProcessedNotification]:
        notifications = self.get_all_for_user(user_id)
        ordered_notifications = sorted(notifications, key=lambda x: x.processed_at, reverse=True)
        return ordered_notifications[:limit]