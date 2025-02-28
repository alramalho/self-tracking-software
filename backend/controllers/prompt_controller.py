from typing import Dict
from datetime import datetime, timedelta
import pytz
import random
from pydantic import BaseModel, Field
from typing import List, Literal
from loguru import logger

from gateways.activities import ActivitiesGateway
from gateways.metrics import MetricsGateway
from controllers.plan_controller import PlanController
from controllers.milestones_controller import MilestonesController
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from gateways.messages import MessagesGateway
from ai.assistant.flowchart_nodes import Node, NodeType
from services.notification_manager import NotificationManager
from gateways.users import UsersGateway
from ai.assistant.recurrent_checkin_assistant import RecurrentCheckinAssistant

class RecurrentMessageGenerator:
    def __init__(self):
        self.users_gateway = UsersGateway()

    async def generate_message(self, user_id: str, message_type: str) -> str:
        if message_type == "user-recurrent-checkin":
            return await self._generate_recurrent_checkin_message(user_id)
        else:
            raise ValueError(f"Message type {message_type} not found")

    async def _generate_recurrent_checkin_message(self, user_id: str) -> str:
        user = self.users_gateway.get_user_by_id(user_id)
        assistant = RecurrentCheckinAssistant(user)
        return await assistant.generate_message()
