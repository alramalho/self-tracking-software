import re
from decimal import Decimal
from typing import List, Optional

from entities.message import Message
from entities.user import User
from gateways.aws.ses import SESGateway
from gateways.database.mongodb import MongoDBGateway


class MessagesGateway:
    def __init__(self):
        self.db_gateway = MongoDBGateway("messages")

    def get_message_by_id(self, message_id: str) -> Optional[Message]:
        msgs = self.db_gateway.query("id", message_id)
        if len(msgs) > 0:
            return Message(**msgs[-1])
        return None

    def update_message(self, message: Message):
        self.db_gateway.write(message.dict())
        return message
