from typing import List, Optional
from entities.friend_request import FriendRequest
from gateways.database.dynamodb import DynamoDBGateway
from loguru import logger
from datetime import datetime, UTC

class FriendRequestGateway:
    def __init__(self):
        self.db_gateway = DynamoDBGateway("friend_requests")

    def create_friend_request(self, friend_request: FriendRequest) -> FriendRequest:
        self.db_gateway.write(friend_request.dict())
        logger.info(f"Friend request created: {friend_request.id}")
        return friend_request

    def get_friend_request(self, request_id: str) -> Optional[FriendRequest]:
        data = self.db_gateway.query("id", request_id)
        return FriendRequest(**data[0]) if data else None

    def update_friend_request(self, request_id: str, status: str) -> Optional[FriendRequest]:
        friend_request = self.get_friend_request(request_id)
        if friend_request:
            friend_request.status = status
            friend_request.updated_at = datetime.now(UTC).isoformat()
            self.db_gateway.write(friend_request.dict())
            logger.info(f"Friend request updated: {request_id}")
            return friend_request
        return None

    def get_pending_sent_requests(self, user_id: str) -> List[FriendRequest]:
        data = self.db_gateway.query("sender_id", user_id)
        return [FriendRequest(**item) for item in data if item["status"] == "pending"]

    def get_pending_received_requests(self, user_id: str) -> List[FriendRequest]:
        data = self.db_gateway.query("recipient_id", user_id)
        return [FriendRequest(**item) for item in data if item["status"] == "pending"]

    def delete_friend_request(self, request_id: str):
        self.db_gateway.delete("id", request_id)
        logger.info(f"Friend request deleted: {request_id}")
