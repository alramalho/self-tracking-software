import re
from decimal import Decimal
from typing import List, Optional

from entities.message import Message
from entities.user import User
from gateways.aws.dynamodb import DynamoDBGateway
from gateways.aws.ses import SESGateway
from gateways.database.base import DBGateway
from gateways.users_crud import UsersCRUDGateway
from shared.constants import COST_TABLE_NAME, MESSAGES_TABLE_NAME, USERS_TABLE_NAME


class MessagesGateway:
    def __init__(self, db_gateway: DBGateway, user: User):
        self.user = user
        self.db_gateway = db_gateway

    def get_message(self, message_id: str) -> Optional[Message]:
        msgs = self.db_gateway.query("id", message_id)
        if len(msgs) > 0:
            return Message(**msgs[-1])
        return None

    def hide_openai_api_key_messages(self):
        messages = [
            Message(**m)
            for m in self.db_gateway.query("sender_id", self.user.id)
            if "sk-" in m["text"]
        ]
        messages.extend(
            [
                Message(*m)
                for m in self.db_gateway.query("receiver_id", self.user.id)
                if "sk-" in m["text"]
            ]
        )

        for message in messages:
            self.db_gateway.delete_all("id", message.id)
            words = []
            for word in re.split(", |; ", message.text):
                if "sk-" in word:
                    word = word.replace(word, "<hidden open ai key>")
                words.append(word)
            message.text = " ".join(words)
            self.db_gateway.write(message.dict())

    def get_last_user_message(self) -> Message:
        data_list = self.db_gateway.query("sender_id", self.user.id) or []
        messages = [
            Message(**data)
            for data in data_list
            if data.get("sender_name") == self.user.name
        ]
        messages.sort(key=lambda x: x.created_at)
        if len(messages) > 0:
            return messages[-1]
        else:
            return None

    def get_user_conversation(self) -> List[Message]:
        list1 = [
            Message(**data) for data in self.db_gateway.query("sender_id", self.user.id)
        ]
        list2 = [
            Message(**data)
            for data in self.db_gateway.query("recipient_id", self.user.id)
        ]
        messages = list1 + list2
        messages.sort(key=lambda x: x.created_at)
        return messages

    def get_conversation_snippet(self, message_id: str) -> List[Message]:
        all_messages = self.get_user_conversation()
        snipped_messages = []
        for i, m in enumerate(all_messages):
            if m.id == message_id:
                snipped_messages.append(m)
                for j in range(i + 1, len(all_messages)):
                    if all_messages[j].sender_id == self.user.id:
                        break
                    snipped_messages.append(all_messages[j])
                break

        return snipped_messages

    def get_message_cost(self, message_id) -> Decimal:
        from gateways.cost import CostGateway

        cost_gateway = CostGateway.setup(DynamoDBGateway(COST_TABLE_NAME), self.user)
        return sum([c.cost for c in cost_gateway.get_all_by_message_id(message_id)])

    def count_user_exchaned_messages(self) -> int:
        sent = self.db_gateway.count("sender_id", self.user.id)
        received = self.db_gateway.count("recipient_id", self.user.id)
        return sent + received

    def clear_user_conversations(self) -> User:
        self.db_gateway.delete_all("sender_id", self.user.id)
        self.db_gateway.delete_all("recipient_id", self.user.id)

    def new_user_message(self, message: str):
        self.db_gateway.write(
            Message.new(
                text=message,
                recipient_id="0",
                recipient_name="Jarvis",
                sender_id=self.user.id,
                sender_name=self.user.name,
            ).dict()
        )

    def new_jarvis_message(self, message: str):
        self.db_gateway.write(
            Message.new(
                text=message,
                sender_id="0",
                sender_name="Jarvis",
                recipient_id=self.user.id,
                recipient_name=self.user.name,
            ).dict()
        )

    def new_system_message(self, message: str):
        self.db_gateway.write(
            Message.new(
                text=message,
                sender_name="System",
                sender_id=self.user.id,
                recipient_name=self.user.name,
                recipient_id="0",
            ).dict()
        )


if __name__ == "__main__":
    users_gateway = UsersCRUDGateway(DynamoDBGateway(USERS_TABLE_NAME))
    messages_gateway = MessagesGateway(
        DynamoDBGateway(MESSAGES_TABLE_NAME),
        users_gateway.get_user_by_id("ded03f21-3368-41f0-9e20-b1730726a5ec"),
    )

    ses = SESGateway()

    messages = messages_gateway.get_user_conversation()[-50:]
    conversation = "\n".join(
        [f"<p>{m.sender_name} ({m.created_at}): {m.text}</p>" for m in messages]
    )
    print(conversation)
