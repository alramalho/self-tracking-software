from pymongo import MongoClient
from typing import List
from entities.plan_group import PlanGroup
from gateways.database.mongodb import MongoDBGateway
from entities.plan_group import PlanGroupMember
from loguru import logger
class PlanGroupNotFoundException(Exception):
    pass

class PlanGroupsGateway:
    def __init__(self):
        self.db_gateway = MongoDBGateway("plan_groups")

    def upsert_plan_group(self, plan_group: PlanGroup):
        self.db_gateway.write(plan_group.dict())
        return plan_group
    
    def get(self, plan_group_id: str) -> PlanGroup:
        data = self.db_gateway.query("id", plan_group_id)
        if len(data) > 0:
            return PlanGroup(**data[0])
        return None

    def get_plan_group_by_plan_id(self, plan_id: str) -> PlanGroup:
        data = self.get_all_plan_groups_by_plan_ids([plan_id])
        if len(data) > 0:
            return data[0]
        return None
    
    def get_all_plan_groups_by_plan_ids(self, plan_group_ids: List[str]) -> List[PlanGroup]:
        if len(plan_group_ids) == 0:
            return []
        plan_groups_data = self.db_gateway.query("plan_ids", {"$elemMatch": {"$in": plan_group_ids}})
        return [PlanGroup(**plan_group_data) for plan_group_data in plan_groups_data]

    def delete_plan_group(self, plan_group_id: str):
        self.db_gateway.delete_all("id", plan_group_id)
    
    def add_member(self, plan_group: PlanGroup, member: PlanGroupMember):
        group_member_ids = [member.user_id for member in plan_group.members]
        if member.user_id not in group_member_ids:
            plan_group.members.append(member)
            self.upsert_plan_group(plan_group)
        else:
            logger.info(f"Member {member.user_id} already exists in plan group {plan_group.id}")
