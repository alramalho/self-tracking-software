from typing import Dict
from constants import POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB

POSTGRES_CREDENTIALS = {
    "user": POSTGRES_USER,
    "password": POSTGRES_PASSWORD,
    "host": POSTGRES_HOST,
    "port": POSTGRES_PORT,
    "database": POSTGRES_DB,
}

TORTOISE_ORM: Dict = {
    "connections": {
        "default": f"postgres://{POSTGRES_CREDENTIALS['user']}:{POSTGRES_CREDENTIALS['password']}@{POSTGRES_CREDENTIALS['host']}:{POSTGRES_CREDENTIALS['port']}/{POSTGRES_CREDENTIALS['database']}?statement_cache_size=0"
    },
    "apps": {
        "models": {
            "models": ["entities.models", "aerich.models"],
            "default_connection": "default",
        }
    },
    "use_tz": True,
}

# For Aerich to manage migrations
TORTOISE_APP_CONFIG = {
    "connections": TORTOISE_ORM["connections"],
    "apps": {
        "models": {
            "models": ["entities.models"],
            "default_connection": "default",
        }
    },
}