
from ai.clients import openai_client as client
from constants import LLM_MODEL, ENVIRONMENT
from datetime import datetime
from ai.assistant.assistant import Assistant
from ai.assistant.memory import DatabaseMemory
from gateways.users import UsersGateway
from gateways.database.mongodb import MongoDBGateway

def talk_with_assistant(text:str):
    users_gateway = UsersGateway(MongoDBGateway("users"))
    user = users_gateway.get_user_by_id("66b29679de73d9a05e77a247")
    memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user.id)
    assistant = Assistant(memory=memory, user=user)
    return assistant.get_response(text)
