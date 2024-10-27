from typing import List, Optional
from entities.plan_invitation import PlanInvitation 
from gateways.database.mongodb import MongoDBGateway
from loguru import logger
from datetime import datetime, UTC

class PlanInvitationsGateway:
    def __init__(self):
        self.db_gateway = MongoDBGateway("plan_invitations")

    def get(self, id: str) -> Optional[PlanInvitation]:
        data = self.db_gateway.query("id", id)
        if len(data) > 0:
            return PlanInvitation(**data[0])
        return None

    def get_all_by_user_id(self, user_id: str) -> List[PlanInvitation]:
        data = self.db_gateway.query("recipient_id", user_id)
        return [PlanInvitation(**item) for item in data if item["status"] == "pending"]

    def upsert_plan_invitation(self, plan_invitation: PlanInvitation) -> PlanInvitation:
        self.db_gateway.write(plan_invitation.dict())
        logger.info(f"Plan invitation created: {plan_invitation.id}")
        return plan_invitation
