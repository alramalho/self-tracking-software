from posthog import Posthog
from constants import POSTHOG_API_KEY, POSTHOG_HOST
posthog = Posthog(
    project_api_key=POSTHOG_API_KEY,
    host=POSTHOG_HOST,
)

