from ai.clients import sync_openai_client, async_openai_client
from constants import LLM_MODEL
from loguru import logger
from pydantic import BaseModel
from typing import TypeVar, Type
import time
import aiohttp
from typing import Optional
import os
import asyncio


def ask_text(text: str, system: str, model: str = LLM_MODEL, temperature: float = 0.7) -> str:
    # logger.debug(f"Asking text: {text}\n\n to assistant with system\n'{system}' with temperature {temperature}")
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": text},
    ]

    response = sync_openai_client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )

    # logger.debug(f"Assistant response: {response.choices[0].message.content}")
    return response.choices[0].message.content


T = TypeVar("T", bound=BaseModel)

def ask_schema(text: str, system: str, pymodel: Type[T], model: str = LLM_MODEL) -> T:
    start_time = time.time()

    # logger.debug(f"Asking schema: \n{pymodel.model_json_schema()}\nText: '{text}'\nSystem: '{system}'")
    
    completion = sync_openai_client.beta.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        response_format=pymodel,
    )
    result = completion.choices[0].message.parsed

    elapsed_time = (time.time() - start_time) * 1000
    # logger.debug(f"Assistant response: {result.model_dump_json(indent=2)}")
    logger.debug(f"Elapsed time for '{model}' ask_schema call: {elapsed_time:.2f} ms")
    return result

async def ask_text_async(text: str, system: str, model: str = LLM_MODEL, temperature: float = 0.7) -> str:
    start_time = time.time()
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": text},
    ]

    response = await async_openai_client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
    )

    elapsed_time = (time.time() - start_time) * 1000
    logger.debug(f"Elapsed time for '{model}' ask_text_async call: {elapsed_time:.2f} ms")
    return response.choices[0].message.content

async def ask_schema_async(text: str, system: str, pymodel: Type[T], model: str = LLM_MODEL) -> T:
    start_time = time.time()
    
    completion = await async_openai_client.beta.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        response_format=pymodel,
    )
    result = completion.choices[0].message.parsed

    elapsed_time = (time.time() - start_time) * 1000
    logger.debug(f"Elapsed time for '{model}' ask_schema_async call: {elapsed_time:.2f} ms")
    return result

# Test code

if __name__ == "__main__":
    class TestSchema(BaseModel):
        name: str
        description: str

    async def run_parallel_tests():
        # Test parameters
        test_text = "Tell me about a random animal"
        test_system = "You are a helpful assistant that provides information about animals."
        
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

        print(f"\nSequential execution completed in {end_time - start_time:.2f} seconds")

    # Run the tests
    asyncio.run(run_parallel_tests())
