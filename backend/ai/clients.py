

from openai import AsyncOpenAI, OpenAI
from constants import OPENAI_API_KEY  


async_openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
sync_openai_client = OpenAI(api_key=OPENAI_API_KEY)