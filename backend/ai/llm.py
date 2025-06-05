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
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.deepseek import DeepSeekProvider
from pydantic_ai.providers.google_vertex import GoogleVertexProvider
from pydantic_ai.providers.mistral import MistralProvider
from constants import (
    LLM_MODEL,
    DEEPSEEK_API_KEY,
    GEMINI_API_KEY,
    OPENAI_API_KEY,
    FIREWORKS_API_KEY,
    MISTRAL_API_KEY,
    OPENROUTER_API_KEY,
)

T = TypeVar("T", bound=BaseModel)


class TextResponse(BaseModel):
    text: str


def get_model(model: str = LLM_MODEL):
    if "lmstudio" in model:
        return OpenAIModel(
            model_name=model.replace("lmstudio:", ""),
            provider=OpenAIProvider(
                base_url="http://172.0.0.1:1234/v1", api_key="lmstudio"
            ),
        )
    elif "openrouter" in model:
        return OpenAIModel(
            model_name=model.replace("openrouter:", ""),
            provider=OpenAIProvider(
                base_url="https://openrouter.ai/api/v1", api_key=OPENROUTER_API_KEY
            ),
        )
    elif "fireworks" in model:
        return OpenAIModel(
            model_name=model.replace("fireworks:", ""),
            provider=OpenAIProvider(
                base_url="https://api.fireworks.ai/inference/v1",
                api_key=FIREWORKS_API_KEY,
            ),
        )
    elif "gemini" in model:
        return GeminiModel(
            model_name=model, provider=GoogleVertexProvider(api_key=GEMINI_API_KEY)
        )
    elif "gpt" in model:
        return OpenAIModel(
            model_name=model, provider=OpenAIProvider(api_key=OPENAI_API_KEY)
        )
    elif "deepseek" in model:
        return OpenAIModel(
            model_name=model, provider=DeepSeekProvider(api_key=DEEPSEEK_API_KEY)
        )
    elif "mistral" in model:
        return MistralModel(
            model_name=model, provider=MistralProvider(api_key=MISTRAL_API_KEY)
        )
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
    text: str, system: str | None = None, model: str = LLM_MODEL, temperature: float = 0
) -> str:
    agent: Agent[None, TextResponse] = Agent(
        get_model(model),
        result_type=TextResponse,
        system_prompt=system if system else "",
        model_settings={"temperature": temperature},
    )
    # Instead of run_sync, use our custom async runner
    result = run_async_in_sync(agent.run(text))
    logger.info(
        f"Asked text {text} with model {model} and got result {result.data.text}"
    )
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
        model_settings={"temperature": temperature},
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
        model_settings={"temperature": temperature},
    )
    result = await agent.run(text)

    elapsed_time = (time.time() - start_time) * 1000
    # logger.debug(f"Elapsed time for '{model}' ask_text_async call: {elapsed_time:.2f} ms")
    return result.data.text


async def ask_schema_async(
    text: str,
    pymodel: Type[T],
    system: str = "",
    model: str = LLM_MODEL,
    temperature: float = 0,
) -> T:
    start_time = time.time()

    agent: Agent[None, T] = Agent(
        get_model(model),
        result_type=pymodel,
        system_prompt=system,
        model_settings={"temperature": temperature},
    )
    result = await agent.run(text)

    elapsed_time = (time.time() - start_time) * 1000
    # logger.debug(f"Elapsed time for '{model}' ask_schema_async call: {elapsed_time:.2f} ms")
    return result.data


from typing import Literal, List


def ask_schema_simple_openai(
    message_history: dict,
    pymodel: Type[T],
    model: str = LLM_MODEL,
    temperature: float = 0.4,
) -> T:
    from openai import OpenAI

    client = OpenAI(
        api_key=OPENAI_API_KEY,
    )
    completion = client.beta.chat.completions.parse(
        model=model,
        messages=message_history,
        temperature=temperature,
        response_format=pymodel
    )
    return completion.choices[0].message.parsed
