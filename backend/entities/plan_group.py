from pydantic import BaseModel
from typing import List, Optional
from bson import ObjectId

class PlanGroupMember(BaseModel):
    user_id: str
    username: str
    name: str
    picture: Optional[str] = None

class PlanGroup(BaseModel):
    id: str
    plan_ids: List[str]
    members: List[PlanGroupMember]

    @classmethod
    def new(cls, plan_ids: List[str], members: List[PlanGroupMember] = [], id: Optional[str] = None) -> "PlanGroup":
        return cls(
            id=id or str(ObjectId()),
            plan_ids=plan_ids,
            members=members,
        )
