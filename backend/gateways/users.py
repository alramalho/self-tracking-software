import datetime
from typing import Any, List

from entities.user import User
from gateways.database.base import DBGateway
from loguru import logger

class UserDoesNotExistException(Exception):
    pass


class UserAlreadyExistsException(Exception):
    pass


# todo: this users gateway now has permissions and CRUD responsiblities... we should split?
class UsersGateway:
    def __init__(self, db_gateway: DBGateway):
        self.db_gateway = db_gateway

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

if __name__ == "__main__":
    from gateways.database.mongodb import MongoDBGateway

    gateway = UsersGateway(MongoDBGateway("users"))

    user = User(name="Alex", email="alexandre.ramalho.1998@gmail.com")
    gateway.create_user(user)