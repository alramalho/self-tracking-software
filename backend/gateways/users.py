import datetime
from typing import Any, List, Tuple

from entities.user import User
from loguru import logger
from gateways.database.mongodb import MongoDBGateway
from entities.friend_request import FriendRequest
from gateways.friend_requests import FriendRequestGateway
class UserDoesNotExistException(Exception):
    pass


class UserAlreadyExistsException(Exception):
    pass


# todo: this users gateway now has permissions and CRUD responsiblities... we should split?
class UsersGateway:
    def __init__(self):
        self.db_gateway = MongoDBGateway("users")
        self.friend_request_gateway = FriendRequestGateway()

    def get_all_users(self) -> list[User]:
        return [User(**data) for data in self.db_gateway.scan()]

    def get_user_by_id(self, id: str) -> User:
        return self.get_user_by("id", id)

    def get_user_by_safely(self, keyname: str, keyvalue: str) -> User:
        data = self.db_gateway.query(keyname, keyvalue)
        if len(data) > 0:
            return User(**data[0])
        else:
            return None

    def get_all_users_by_safely(self, keyname: str, keyvalue: str) -> List[User]:
        data = self.db_gateway.query(keyname, keyvalue)
        return [User(**d) for d in data]

    def get_all_users_by_regex(self, keyname: str, pattern: str) -> List[User]:
        data = self.db_gateway.regex_query(keyname, pattern)
        return [User(**d) for d in data]

    def get_user_by(self, keyname: str, keyvalue: str) -> User:
        data = self.db_gateway.query(keyname, keyvalue)
        if len(data) > 0:
            return User(**data[0])
        else:
            raise UserDoesNotExistException()

    def create_user(self, user: User) -> User:
        if len(self.db_gateway.query("id", user.id)) != 0:
            logger.info(f"User {user.id} ({user.name}) already exists")
            raise UserAlreadyExistsException()
        self.db_gateway.write(user.dict())
        logger.info(f"User {user.id} ({user.name}) created")
        return user

    def update_user(self, user: User) -> User:
        self.db_gateway.write(user.dict())
        logger.info(f"User {user.id} ({user.name}) updated")
        return user
    
    def add_friend(self, user_id: str, friend_id: str) -> User:
        user = self.get_user_by_id(user_id)
        friend = self.get_user_by_id(friend_id)
        
        if friend_id not in user.friend_ids:
            user.friend_ids.append(friend_id)
            self.update_user(user)

        if user_id not in friend.friend_ids:
            friend.friend_ids.append(user_id)
            self.update_user(friend)

        return user

    def update_fields(self, user_id: str, fields: dict) -> User:
        user = self.get_user_by_id(user_id)
        for field_name, new_value in fields.items():
            if not hasattr(user, field_name):
                raise Exception(f"User does not have field {field_name}")

            setattr(user, field_name, new_value)
        self.db_gateway.write(user.dict())
        logger.info(f"User {user.id} ({user.name}) fields {fields} updated")
        return user
    
    def delete_user(self, user_id: str):
        user = self.get_user_by_id(user_id)
        user.deleted = True
        user.deleted_at = datetime.datetime.now(datetime.UTC).isoformat()
        self.db_gateway.write(user.dict())
        logger.info(f"User {user.id} ({user.name}) marked as deleted")

    def permanently_delete_user(self, user_id: str):
        self.db_gateway.delete_all('id', user_id)
        logger.info(f"User {user_id} forever deleted")

    def update_field(self, user_id: str, field_name: str, new_value: Any) -> User:
        return self.update_fields(user_id, {field_name: new_value})

    def append_to_field(self, user_id: str, field_name: str, new_value: Any) -> User:
        user = self.get_user_by_id(user_id)
        if not hasattr(user, field_name):
            raise Exception(f"User does not have field {field_name}")

        field = getattr(user, field_name)
        if type(field) != list:
            raise Exception(f"Field {field_name} is not a list")
        
        if field is None:
            setattr(user, field_name, [])

        getattr(user, field_name).append(new_value)
        self.db_gateway.write(user.dict())
        logger.info(f"User {user.id} ({user.name}) field {field_name} updated")
        return user

    def get_subscription_info(self, user_id: str):
        # Fetch the subscription info from your database
        # This is just a placeholder implementation
        user = self.get_user_by_id(user_id)
        return {
            "endpoint": user.pwa_subscription_endpoint,
            "keys": {
                "p256dh": user.pwa_subscription_key,
                "auth": user.pwa_subscription_auth_token
            }
        }
    
    def update_onboarding_progress(self, user_id: str, step: str, data: Any) -> User:
        user = self.get_user_by_id(user_id)
        user.onboarding_progress[step] = data
        return self.update_user(user)
    

    def set_selected_plan(self, user_id: str, plan_id: str) -> User:
        user = self.get_user_by_id(user_id)
        user.selected_plan_id = plan_id
        return self.update_user(user)

    def add_plan_to_user(self, user_id: str, plan_id: str) -> User:
        user = self.get_user_by_id(user_id)
        if plan_id not in user.plan_ids:
            user.plan_ids.append(plan_id)
        return self.update_user(user)

    def remove_plan_from_user(self, user_id: str, plan_id: str) -> User:
        user = self.get_user_by_id(user_id)
        if plan_id in user.plan_ids:
            user.plan_ids.remove(plan_id)
        return self.update_user(user)

    def send_friend_request(self, sender_id: str, recipient_id: str) -> FriendRequest:
        friend_request = FriendRequest.new(sender_id, recipient_id)
        created_request = self.friend_request_gateway.create_friend_request(friend_request)
        return created_request

    def accept_friend_request(self, request_id: str) -> Tuple[User, User]:
        friend_request = self.friend_request_gateway.get_friend_request(request_id)
        if not friend_request:
            raise Exception(f"Invalid friend request '{request_id}'")
        
        if friend_request.status == "rejected":
            raise Exception(f"Friend request '{request_id}' is rejected")

        sender = self.get_user_by_id(friend_request.sender_id)
        recipient = self.get_user_by_id(friend_request.recipient_id)

        if friend_request.status == "accepted":
            return sender, recipient
        
        if recipient.id not in sender.friend_ids:
            self.add_friend(sender.id, recipient.id)
    
        if sender.id not in recipient.friend_ids:
            self.add_friend(recipient.id, sender.id)

        self.friend_request_gateway.update_friend_request(request_id, "accepted")

        return sender, recipient

    def reject_friend_request(self, request_id: str) -> User:
        friend_request = self.friend_request_gateway.get_friend_request(request_id)
        if not friend_request:
            raise Exception(f"Invalid friend request '{request_id}'")
        
        if friend_request.status == "accepted":
            raise Exception(f"Friend request '{request_id}' is already accepted")
        
        sender = self.get_user_by_id(friend_request.sender_id)

        if friend_request.status == "rejected":
            return sender


        self.friend_request_gateway.update_friend_request(request_id, "rejected")

        return sender

    def get_friend_count(self, user_id: str) -> int:
        user = self.get_user_by_id(user_id)
        return len(user.friend_ids)


if __name__ == "__main__":
    from shared.logger import create_logger

    logger = create_logger()
    from gateways.database.mongodb import MongoDBGateway
    from ai.assistant.memory import DatabaseMemory

    gateway = UsersGateway()
    memory = DatabaseMemory(MongoDBGateway("messages"), "66b29679de73d9a05e77a247")

    print(memory.read_all_as_str())
