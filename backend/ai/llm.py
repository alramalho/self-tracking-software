from ai.clients import openai_client as client
from constants import LLM_MODEL
from loguru import logger
from pydantic import BaseModel
from typing import TypeVar, Type


def ask_text(text: str, system: str, model: str = LLM_MODEL) -> str:
    logger.info(f"Asking text: {text} to assistant with system {system}")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        temperature=0.7,
    )
    return response.choices[0].message.content


T = TypeVar("T", bound=BaseModel)


def ask_schema(text: str, system: str, pymodel: Type[T], model: str = LLM_MODEL) -> T:

    logger.info(f"Asking schema: \n{pymodel.model_json_schema()}\nText: '{text}'\nSystem: '{system}'")

    completion = client.beta.chat.completions.parse(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ],
        response_format=pymodel,
    )

    return completion.choices[0].message.parsed
