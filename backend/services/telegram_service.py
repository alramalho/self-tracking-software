import os
import requests
from loguru import logger
from constants import ENVIRONMENT, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN
from entities.activity import Activity, ActivityEntry
from entities.metric import Metric, MetricEntry
from typing import Optional, List
from ai.llm import ask_text
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
                logger.error(
                    f"Tried to sent telegram message but got a 400. Message: {message}"
                )
                self.send_message(
                    "🤖 Summary: \n" + 
                    ask_text(
                        f"Please rewrite / summarize this message in markdown format suitable for telegram message (no special character). If there is a conversation history, you must include in full it in the summary: {message}"
                    )
                )
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
        conversation_history = self._escape_markdown(
            conversation_history[-1000:]
            .replace(">", "><b><i>")
            .replace(":", ":</i></b>")
        )
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
        conversation_history = self._escape_markdown(
            conversation_history[-1000:]
            .replace(">", "><b><i>")
            .replace(":", ":</i></b>")
        )
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
    telegram_service.send_message(
        """
Tried to sent telegram message but got a 400. Message: ⚠️🤖 <b>Dynamic UI Attempt Error on user alez on profile-setup</b>

<b>UTC Time:</b> 10:14, Friday May 23, 2025
<b>User ID:</b> 67221c9a16c1b29764a4d7f1
<b>Question Checks:</b>
Who you are (your age, occupation, etc.): True
What do you want to achieve (your vision): True
<b>Attempts:</b> 3
<b>Extracted Data:</b> 
message: Thank you for sharing your vision of becoming a better AI engineer and for providing your details as a 27-year-old software engineer! If you have any more questions or need assistance, feel free to ask.
user:
  id: 67221c9a16c1b29764a4d7f1
  name: Alez
  profile: 27-year-old male software engineer aspiring to become a better AI engineer.
  picture: None
  age: 27
  username: alez
  timezone: Europe/Berlin
  clerk_id: user_2o9jg8YbDk6TuLA6WSdw4cw0BA5
  language: English
  plan_type: free
  daily_checkin_settings: None
  email: gtmcspixzrduwdxwfq@nbmbb.com
  created_at: 2024-10-30T11:46:34.682921+00:00
  deleted: False
  deleted_at: None
  is_pwa_installed: True
  is_pwa_notifications_enabled: True
  looking_for_ap: False
  pwa_subscription_endpoint: https://web.push.apple.com/QOX01ycxp0EIY3bFQdn0HUCL42THRMZsOdNO4EMcsvgI_DdhQ-IioewKZ0lYfOea0RvU0q1zxYQt0ecTUy92DoAP4ckxZq6gguQlQp5lGFVVGxNWhHWcbd-xlGt81M9JSZi0TxFD8uDl5aBHwWphYl-0Cg5me7BH6azecRtJ6Ek
  pwa_subscription_key: BG1nr2uBmCgor2UjS3xX+p7n2dpz8e10+EcO97GHx5vwMqZXhy/C+ukOYu74EHk0mfXMWw8uLjPBiKhZUGFSHZE=
  pwa_subscription_auth_token: e5XoAB1ZO8sfwHDpGgeaMA==
  plan_ids: ['67221cd116c1b29764a4d807', '672def13bb26ae73210292b8', '672df6755bae6fe1df7b4fc1', '674b3e089cbca09543defad4']
  friend_ids: []
  plan_invitations: []
  referred_user_ids: []
  unactivated_email_sent_at: None
  theme_base_color: random
  stripe_settings: None
  default_activity_visibility: public
  recommendations_outdated: True
  recommendations_last_calculated_at: 2025-05-23T10:13:58.930158+00:00
question_checks:
  Who you are (your age, occupation, etc.): True
  What do you want to achieve (your vision): True
<b>Conversation History:</b> ... (older than 30 minutes messages omitted) ...
--- Today (2025-05-23) ---
<b><i>><b<b><i>><i<b><i>> Alez (Just now):</i></b></i<b><i>></b<b><i>> shoosh im a 27m swe eng
i want to a better ai engineer
<b><i>><b<b><i>><i<b><i>> Jarvis (Just now):</i></b></i<b><i>></b<b><i>> Thank you for sharing your vision of becoming a better AI engineer! Could you please tell me a bit more about yourself, such as your age and occupation?
<b><i>><b<b><i>><i<b><i>> Alez (Just now):</i></b></i<b><i>></b<b><i>> shoosh im a 27m swe eng.
i want to a better ai engineer
<b><i>><b<b><i>><i<b><i>> Jarvis (Just now):</i></b></i<b><i>></b<b><i>> Thank you for sharing your vision of becoming a better AI engineer and for providing your details as a 27-year-old software engineer! If you have any more questions or need assistance, feel free to ask.
"""
    )
