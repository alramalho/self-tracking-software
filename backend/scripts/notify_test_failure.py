from shared.logger import create_logger
logger = create_logger()
import sys
import os
from services.telegram_service import TelegramService

def notify_test_failure(test_type: str, error_output: str):
    telegram = TelegramService()
    
    message = (
        f"❌ <b>Daily Tests Failed</b>\n\n"
        f"<b>Test Type:</b> {test_type}\n"
        f"<b>Environment:</b> {os.getenv('ENVIRONMENT', 'production')}\n"
        f"<b>Error Output:</b>\n<pre>{error_output[2000:]}</pre>"  # Limit error message length
    )
    
    telegram.send_message(message)

    logger.info(f"Set notification \n'{message}'\n to Telegram")

if __name__ == "__main__":

    logger.info("Sending test failure notification")

    if len(sys.argv) != 3:
        print("Usage: python notify_test_failure.py <test_type> <error_output>")
        sys.exit(1)
        
    test_type = sys.argv[1]
    error_output = sys.argv[2]
    notify_test_failure(test_type, error_output) 