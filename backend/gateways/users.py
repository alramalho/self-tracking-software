import datetime
from typing import Any, List, Tuple

from entities.user import User
from loguru import logger
from gateways.database.mongodb import MongoDBGateway

class UserDoesNotExistException(Exception):
    pass


class UserAlreadyExistsException(Exception):
    pass


# todo: this users gateway now has permissions and CRUD responsiblities... we should split?
class UsersGateway:
    def __init__(self,):
        self.db_gateway = MongoDBGateway("users")

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

    def update_field(self, user_id: str, field_name: str, new_value: Any) -> User:
        return self.update_fields(user_id, {field_name: new_value})

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
    

if __name__ == "__main__":
    from shared.logger import create_logger

    logger = create_logger()
    from gateways.database.mongodb import MongoDBGateway
    from ai.assistant.memory import DatabaseMemory

    gateway = UsersGateway()
    memory = DatabaseMemory(MongoDBGateway("messages"), "66b29679de73d9a05e77a247")

    print(memory.read_all_as_str())