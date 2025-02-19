import os
import requests
from loguru import logger
from constants import ENVIRONMENT, TELEGRAM_CHAT_ID, TELEGRAM_BOT_TOKEN
from typing import Optional
import traceback
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
                json={
                    "chat_id": self.chat_id,
                    "text": message,
                    "parse_mode": "HTML"
                }
            )
            if not response.ok:
                logger.error(f"Telegram API error: Status {response.status_code}")
                logger.error(f"Response content: {response.text}")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(traceback.format_exc())
            logger.error(f"Failed to send Telegram message: {str(e)}")
            return None

    def send_error_notification(self, error_message: str, user_username: str, user_id: str, path: str, method: str, status_code: str) -> None:
        """Send a formatted error notification to Telegram."""

        message = (
            f"🚨 <b>Error Detected on user {user_username}</b>\n\n"
            f"<b>Environment:</b> {ENVIRONMENT}\n"
            f"<b>User ID:</b> {user_id}\n"
            f"<b>Path:</b> {path}\n"
            f"<b>Status Code:</b> {status_code}\n"
            f"<b>Method:</b> {method}\n"
            f"<b>Error:</b>\n<pre>{error_message[:1000]}</pre>"  # Limit error message length
        )
        self.send_message(message)

    def send_bug_report_feedback(self, reporter_username: str, reporter_id: str, message: str, email: str) -> None:
        """Send a notification when a bug report feedback is received."""
        message = (
            f"📝🐞 <b>New Bug Report from <pre>{reporter_username}</pre></b>\n\n"
            f"<b>Environment:</b> {ENVIRONMENT}\n"
            f"<b>Email:</b> <pre>{email}</pre>\n"
            f"<b>Reporter ID:</b> <pre>{reporter_id}</pre>\n"
            f"<b>Message:</b>\n<pre>{message[:500]}</pre>"  # Limit feedback length
        )
        self.send_message(message) 