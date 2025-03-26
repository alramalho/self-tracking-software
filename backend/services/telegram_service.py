import os
import requests
from loguru import logger
from constants import ENVIRONMENT, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN
from entities.activity import Activity, ActivityEntry
from entities.metric import Metric, MetricEntry
from typing import Optional, List
import traceback
from datetime import UTC, datetime
from gateways.activities import ActivitiesGateway
from gateways.metrics import MetricsGateway
from shared.utils import _dict_to_markdown


class TelegramService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TelegramService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.bot_token = TELEGRAM_BOT_TOKEN
            self.chat_id = TELEGRAM_CHAT_ID
            self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
            self._initialized = True

    def send_message(self, message: str) -> Optional[dict]:
        """Send a message to the configured Telegram chat."""

        if not self.bot_token or not self.chat_id:
            logger.warning("Telegram credentials not configured, skipping message")
            return None

        try:
            response = requests.post(
                f"{self.base_url}/sendMessage",
                json={"chat_id": self.chat_id, "text": message, "parse_mode": "HTML"},
            )
            if not response.ok:
                logger.error(f"Telegram API error: Status {response.status_code}")
                logger.error(f"Response content: {response.text}")

            if response.status_code == 400:
                logger.error(f"Tried to sent telegram message but got a 400. Message: {message}")
                self.send_message("❌ Tried to send a telegram error message but got a 400! Check the logs")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(traceback.format_exc())
            logger.error(f"Failed to send Telegram message: {str(e)}")
            return None

    def send_error_notification(
        self,
        error_message: str,
        user_username: str,
        user_id: str,
        path: str,
        method: str,
        status_code: str,
    ) -> None:
        """Send a formatted error notification to Telegram."""

        message = (
            f"🚨 <b>Error Detected on user {user_username}</b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>Environment:</b> {ENVIRONMENT}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Path:</b> {path}\n"
            f"<b>Status Code:</b> {status_code}\n"
            f"<b>Method:</b> {method}\n"
            f"<b>Error:</b>\n<pre>{error_message[:1000]}</pre>"
              # Limit error message length
        )
        self.send_message(message)

    def send_websocket_error_notification(
        self, error_message: str, user_username: str, user_id: str, path: str
    ) -> None:
        """Send a notification when a WebSocket error is detected."""

        message = (
            f"🔌🤖 <b>WebSocket Error Detected on user {user_username}</b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>Environment:</b> {ENVIRONMENT}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Path:</b> {path}\n"
            f"<b>Error:</b>\n<pre>{error_message[:1000]}</pre>"  # Limit error message length
        )
        self.send_message(message)

    def send_bug_report_feedback(
        self, reporter_username: str, reporter_id: str, message: str, email: str
    ) -> None:
        """Send a notification when a bug report feedback is received."""
        message = (
            f"📝🐞 <b>New Bug Report from <pre>{reporter_username}</pre></b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>Environment:</b> {ENVIRONMENT}\n"
            f"<b>Email:</b> <pre>{email}</pre>\n"
            f"<b>Reporter ID:</b> <pre>{reporter_id}</pre>\n"
            f"<b>Message:</b>\n<pre>{message[:500]}</pre>"  # Limit feedback length
        )
        self.send_message(message)

    def send_suggestion_rejection_notification(
        self,
        user_username: str,
        user_id: str,
        details: str,
    ) -> None:
        """Send a notification when a suggestion is rejected."""
        message = (
            f"🚫 <b>Suggestion Rejected on user {user_username}</b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Details:</b> \n\n{details}\n"
        )
        self.send_message(message)
    def send_daily_checkin_rejection_notification(
        self,
        user_username: str,
        user_id: str,
        message: str,
        activity_entries: Optional[List[ActivityEntry]],
        metric_entries: Optional[List[MetricEntry]],
        rejection_feedback: str,
    ) -> None:
        """Send a notification when a daily checkin is rejected."""

        metrics_gateway = MetricsGateway()
        activities_gateway = ActivitiesGateway()

        message = (
            f"🚫 <b>Daily Checkin Rejected on user {user_username}</b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Message:</b> {message}\n"
            f"<b>Activity Entries:</b> {"\n".join([f"– {activities_gateway.get_readable_activity_entry(a)}" for a in activity_entries])}\n"
            f"<b>Metric Entries:</b> {"\n".join([f"– {metrics_gateway.get_readable_metric_entry(m)}" for m in metric_entries])}\n"
            f"<b>Rejection Feedback:</b> {rejection_feedback}\n"
        )
        self.send_message(message)

    def send_daily_checkin_acceptance_notification(
        self,
        user_username: str,
        user_id: str,
        message: str,
        activity_entries: Optional[List[ActivityEntry]],
        metric_entries: Optional[List[MetricEntry]],
    ) -> None:
        """Send a notification when a daily checkin is rejected."""
        metrics_gateway = MetricsGateway()
        activities_gateway = ActivitiesGateway()

        message = (
            f"✅ <b>Daily Checkin Accepted on user {user_username}</b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Message:</b> {message}\n"
            f"<b>Activity Entries:</b> {"\n".join([f"– {activities_gateway.get_readable_activity_entry(a)}" for a in activity_entries])}\n"
            f"<b>Metric Entries:</b> {"\n".join([f"– {metrics_gateway.get_readable_metric_entry(m)}" for m in metric_entries])}\n"
        )
        self.send_message(message)

    def _escape_markdown(self, text: str) -> str:
        return text.replace(">", "<b><i>>").replace(":", ":</i></b>")

    def send_dynamic_ui_attempt_error_notification(
        self,
        id: str,
        user_username: str,
        user_id: str,
        conversation_history: str,
        question_checks: dict,
        attempts: int,
        extracted_data: dict,
    ) -> None:
        """Send a notification when a dynamic UI attempt error is detected."""
        conversation_history = self._escape_markdown(conversation_history.replace(">", "><b><i>").replace(":", ":</i></b>")[:1000])
        formatted_data = _dict_to_markdown(extracted_data)
        formatted_question_checks = _dict_to_markdown(question_checks)
        message = (
            f"⚠️🤖 <b>Dynamic UI Attempt Error on user {user_username} on {id}</b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Question Checks:</b>\n{formatted_question_checks}\n"
            f"<b>Attempts:</b> {attempts}\n"
            f"<b>Extracted Data:</b> \n{formatted_data}\n"
            f"<b>Conversation History:</b> {conversation_history}\n"
        )
        self.send_message(message)

    def send_dynamic_ui_skip_notification(
        self,
        id: str,
        user_username: str,
        user_id: str,
        conversation_history: str,
        question_checks: dict,
        attempts: int,
        extracted_data: dict,
    ) -> None:
        """Send a notification when a dynamic UI attempt error is detected."""
        conversation_history = self._escape_markdown(conversation_history.replace(">", "><b><i>").replace(":", ":</i></b>")[:1000])
        formatted_data = _dict_to_markdown(extracted_data)
        formatted_question_checks = _dict_to_markdown(question_checks)
        message = (
            f"⚠️🤖 <b>Dynamic UI Skip ⏭️ on user {user_username} on {id}</b>\n\n"
            f"<b>UTC Time:</b> {datetime.now(UTC).strftime('%H:%M, %A %B %d, %Y')}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Question Checks:</b>\n{formatted_question_checks}\n"
            f"<b>Attempts:</b> {attempts}\n"
            f"<b>Extracted Data:</b> \n{formatted_data}\n"
            f"<b>Conversation History:</b> {conversation_history}\n"
        )
        self.send_message(message)


if __name__ == "__main__":
    telegram_service = TelegramService()
    telegram_service.send_dynamic_ui_attempt_error_notification(
        id="123",
        user_username="test",
        user_id="123",
        extracted_data={
            "question_checks": {
                "question_1": True,
                "question_2": False,
            },
            
        },
        conversation_history="test",
        question_checks={
            "question_1": True,
            "question_2": False,
        },
        attempts=1
    )