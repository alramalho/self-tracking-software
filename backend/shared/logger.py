import datetime
import os
import sys

from loguru import logger
from constants import ENVIRONMENT


def log_level_exists(level):
    return level in logger._core.levels

def log_exists():
    return "AWS" in logger._core.levels

def create_logger(level="INFO"):
    if log_exists():
        return

    logger.remove()

    logger_format = "<cyan>{thread.name}</cyan> | <green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <cyan>{name}:{function}:{line}</cyan> | <level>{level.icon} {level: <8}</level> - <level>{message}</level>"
    logger.add(sys.stderr, colorize=True, format=logger_format, level=level)

    if ENVIRONMENT == "dev":
        if not os.path.exists("logs"):
            os.makedirs("logs")

        log_id = len([f for f in os.listdir("logs")]) + 1

        file_name = f"logs/{datetime.datetime.now(datetime.UTC).strftime('%Y_%m_%d')}_execution_{log_id:03d}.ans"

        logger.add(file_name, colorize=True, format=logger_format, level="DEBUG")

    # Loguru's default levels are DEBUG (10), INFO (20), SUCCESS (25), WARNING (30), ERROR (40), and CRITICAL (50)
    if not log_level_exists("AUTH"):
        logger.level("AUTH", no=20, color="<white>", icon="🔑")
        logger.log("AUTH", "AUTH logger created")

    if not log_level_exists("CONTROLLERS"):
        logger.level("CONTROLLERS", no=20, color="<white>", icon="🦾")
    logger.log("CONTROLLERS", "CONTROLLERS logger created")

    if not log_level_exists("DB"):
        logger.level("DB", no=10, color="<cyan>", icon="📊")
        logger.log("DB", "DB logger created")

    if not log_level_exists("HUME"):
        logger.level("HUME", no=20, color="<yellow>", icon="🧘")
        logger.log("HUME", "HUME logger created")

    if not log_level_exists("AI_FRAMEWORK"):
        logger.level("AI_FRAMEWORK", no=30, color="<green>", icon="🤖")
        logger.log("AI_FRAMEWORK", "AI_FRAMEWORK logger created")

    if not log_level_exists("LOOPS"):
        logger.level("LOOPS", no=20, color="<yellow>", icon="📧")
        logger.log("LOOPS", "LOOPS logger created")

    logger.info(f"Using {ENVIRONMENT.capitalize()} enviroment! ⚠️")
