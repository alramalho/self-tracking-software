
from ai.clients import openai_client as client
from constants import LLM_MODEL

def ask_text(text:str):
    response = client.chat.completions.create(
    model=LLM_MODEL,
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": text}
    ]
    )
    return response.choices[0].message.content
