from ai.clients import openai_client as client
from constants import LLM_MODEL
from loguru import logger

def ask_text(text: str, system:str) -> str:
    logger.info(f"Asking text: {text} to assistant with system {system}") 

    response = client.chat.completions.create(
    model=LLM_MODEL,
    messages=[
        {"role": "system", "content": system},
        {"role": "user", "content": text}
    ],
    temperature=0.7,
    )
    return response.choices[0].message.content