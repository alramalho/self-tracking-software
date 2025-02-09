from pydantic import BaseModel
from typing import TypeVar, Type
import time
import asyncio
from shared.logger import logger
from threading import Thread
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIModel
from pydantic_ai.models.gemini import GeminiModel
from pydantic_ai.models.mistral import MistralModel
from constants import LLM_MODEL, DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, MISTRAL_API_KEY

T = TypeVar("T", bound=BaseModel)

class TextResponse(BaseModel):
    text: str

def get_model(model: str = LLM_MODEL):
    if 'deepseek' in model:
        return OpenAIModel(model, base_url='https://api.deepseek.com', api_key=DEEPSEEK_API_KEY)
    elif 'gpt' in model:
        return OpenAIModel(model, api_key=OPENAI_API_KEY)
    elif 'gemini' in model:
        return GeminiModel(model, api_key=GEMINI_API_KEY)
    elif 'mistral' in model:
        return MistralModel(model, api_key=MISTRAL_API_KEY)
    else:
        raise ValueError(f"Invalid model: {model}")

def run_async_in_sync(coro):
    result = None
    error = None
    
    def run_in_thread():
        nonlocal result, error
        try:
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(coro)
            loop.close()
        except Exception as e:
            error = e

    # Run the coroutine in a separate thread
    thread = Thread(target=run_in_thread)
    thread.start()
    thread.join()
    
    if error:
        raise error
    return result

def ask_text(
    text: str, system: str, model: str = LLM_MODEL, temperature: float = 0
) -> str:
    agent: Agent[None, TextResponse] = Agent(
        get_model(model),
        result_type=TextResponse,
        system_prompt=system,
        model_settings={'temperature': temperature},
    )
    # Instead of run_sync, use our custom async runner
    result = run_async_in_sync(agent.run(text))
    return result.data.text

def ask_schema(
    text: str,
    system: str,
    pymodel: Type[T],
    model: str = LLM_MODEL,
    temperature: float = 0,
) -> T:
    start_time = time.time()

    logger.info(f"Asking schema {text}")

    agent: Agent[None, T] = Agent(
        get_model(model),
        result_type=pymodel,
        system_prompt=system,
        model_settings={'temperature': temperature},
    )
    # Instead of run_sync, use our custom async runner
    result = run_async_in_sync(agent.run(text))

    elapsed_time = (time.time() - start_time) * 1000
    # logger.debug(f"Elapsed time for '{model}' ask_schema call: {elapsed_time:.2f} ms")
    return result.data

async def ask_text_async(
    text: str, system: str, model: str = LLM_MODEL, temperature: float = 0
) -> str:
    start_time = time.time()

    agent: Agent[None, TextResponse] = Agent(
        get_model(model),
        result_type=TextResponse,
        system_prompt=system,
        model_settings={'temperature': temperature},
    )
    result = await agent.run(text)

    elapsed_time = (time.time() - start_time) * 1000
    # logger.debug(f"Elapsed time for '{model}' ask_text_async call: {elapsed_time:.2f} ms")
    return result.data.text

async def ask_schema_async(
    text: str,
    system: str,
    pymodel: Type[T],
    model: str = LLM_MODEL,
    temperature: float = 0,
) -> T:
    start_time = time.time()

    agent: Agent[None, T] = Agent(
        get_model(model),
        result_type=pymodel,
        system_prompt=system,
        model_settings={'temperature': temperature},
    )
    result = await agent.run(text)

    elapsed_time = (time.time() - start_time) * 1000
    # logger.debug(f"Elapsed time for '{model}' ask_schema_async call: {elapsed_time:.2f} ms")
    return result.data

