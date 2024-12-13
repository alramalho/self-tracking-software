from ai.clients import openai_client, instructor_groq_client, normal_groq_client
from constants import LLM_MODEL
from loguru import logger
from pydantic import BaseModel
from typing import TypeVar, Type


def ask_text(text: str, system: str, model: str = LLM_MODEL, temperature: float = 0.7) -> str:
    logger.info(f"Asking text: {text}\n\n to assistant with syste\n'{system}' with temperature {temperature}")

    if model == "gpt-4o-mini":
        client = openai_client
    else:
        client = normal_groq_client

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        temperature=temperature,
    )

    logger.info(f"Assistant response: {response.choices[0].message.content}")
    return response.choices[0].message.content


T = TypeVar("T", bound=BaseModel)

import time

def ask_schema(text: str, system: str, pymodel: Type[T], model: str = LLM_MODEL) -> T:
    start_time = time.time()

    logger.info(f"Asking schema: \n{pymodel.model_json_schema()}\nText: '{text}'\nSystem: '{system}'")
    
    if model == "gpt-4o-mini":
        completion = openai_client.beta.chat.completions.parse(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            response_format=pymodel,
        )
        result = completion.choices[0].message.parsed
    else:
        result = instructor_groq_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": text},
            ],
            response_model=pymodel,
        )

    elapsed_time = (time.time() - start_time) * 1000
    logger.info(f"Assistant response: {result.model_dump_json(indent=2)}")
    logger.info(f"Elapsed time for '{model}' ask_schema call: {elapsed_time:.2f} ms")
    return result
