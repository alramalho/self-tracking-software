from pydantic import BaseModel
from typing import TypeVar, Type, Optional, Union
import time
from loguru import logger
import asyncio
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
        return OpenAIModel(model, api_key=DEEPSEEK_API_KEY)
    elif 'gpt' in model:
        return OpenAIModel(model, api_key=OPENAI_API_KEY)
    elif 'gemini' in model:
        return GeminiModel(model, api_key=GEMINI_API_KEY)
    elif 'mistral' in model:
        return MistralModel(model, api_key=MISTRAL_API_KEY)
    else:
        raise ValueError(f"Invalid model: {model}")

def ask_text(
    text: str, system: str, model: str = LLM_MODEL, temperature: float = 0
) -> str:
    agent: Agent[None, TextResponse] = Agent(
        get_model(model),
        result_type=TextResponse,
        system_prompt=system,
        model_settings={'temperature': temperature},
    )
    result = agent.run_sync(text)
    return result.data.text


def ask_schema(
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
    result = agent.run_sync(text)

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


# Test code
if __name__ == "__main__":

    class TestSchema(BaseModel):
        name: str
        description: str

    async def run_parallel_tests():
        # Test parameters
        test_text = "Tell me about a random animal"
        test_system = (
            "You are a helpful assistant that provides information about animals."
        )

        # Create multiple tasks
        tasks = []
        for i in range(5):  # Test with 5 parallel requests
            if i % 2 == 0:
                # Text completion tasks
                tasks.append(ask_text_async(test_text, test_system))
            else:
                # Schema completion tasks
                tasks.append(ask_schema_async(test_text, test_system, TestSchema))

        # Time the parallel execution
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        end_time = time.time()

        # Print results
        print(f"\nParallel execution completed in {end_time - start_time:.2f} seconds")
        print(f"Number of responses: {len(results)}")
        for i, result in enumerate(results):
            print(f"\nResult {i + 1}:")
            print(result)

        # Now test sequential execution
        start_time = time.time()
        sequential_results = []
        for i in range(5):
            if i % 2 == 0:
                result = await ask_text_async(test_text, test_system)
            else:
                result = await ask_schema_async(test_text, test_system, TestSchema)
            sequential_results.append(result)
        end_time = time.time()

        print(
            f"\nSequential execution completed in {end_time - start_time:.2f} seconds"
        )

    # Run the tests
    asyncio.run(run_parallel_tests())
