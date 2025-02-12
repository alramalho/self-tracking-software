from shared.logger import create_logger
logger = create_logger()
import sys
import os
from services.telegram_service import TelegramService

def notify_test_failure(test_type: str, error_output: str):
    telegram = TelegramService()
    
    # Clean and escape the error output
    def escape_html(text: str) -> str:
        return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    
    # Remove null bytes and other problematic characters
    cleaned_error = error_output.replace('\x00', '').replace('\u0000', '')
    # Escape HTML special characters
    escaped_error = escape_html(cleaned_error)
    # Limit to 3000 characters to stay well within Telegram's limits
    truncated_error = escaped_error[:3000] + "..." if len(escaped_error) > 3000 else escaped_error
    
    message = (
        f"❌ <b>Daily Tests Failed</b>\n\n"
        f"<b>Test Type:</b> {test_type}\n"
        f"<b>Environment:</b> {os.getenv('ENVIRONMENT', 'development')}\n"
        f"<b>Error Output:</b>\n<pre>{truncated_error}</pre>"
    )
    
    telegram.send_message(message)
    logger.info("Sent test failure notification to Telegram")

if __name__ == "__main__":

    logger.info("Sending test failure notification")

    if len(sys.argv) != 3:
        print("Usage: python notify_test_failure.py <test_type> <error_output>")
        sys.exit(1)
        
    test_type = sys.argv[1]
    error_output = sys.argv[2]
    notify_test_failure(test_type, error_output) 