from fastapi import APIRouter, Depends, HTTPException
# from pydantic import BaseModel
# from typing import List, Optional, Dict, Any, Literal
from auth.clerk import is_clerk_user
# from entities.user import User
# from gateways.users import UsersGateway
# from gateways.activities import ActivitiesGateway
# from gateways.moodreports import MoodsGateway
# from ai.assistant.memory import DatabaseMemory
# from gateways.database.mongodb import MongoDBGateway
# from services.conversation_service import talk_with_assistant, get_activities_from_conversation, get_activity_entries_from_conversation, get_mood_report_from_conversation

# class Message(BaseModel):
#     is_from_user: bool
#     sent_time_ago: str
#     content: str

# class EvaluationRequest(BaseModel):
#     user_id: str
#     question: str
#     agent_mode: Literal["pro", "basic", "welcome", "denk", "denk-welcome", "trackingso"]
#     conversation_history: List[Message]

# class EvaluationResponse(BaseModel):
#     answer: str
#     activities: List[Dict[str, Any]]
#     activity_entries: List[Dict[str, Any]]
#     mood_report: Optional[Dict[str, Any]]
#     cost: Dict[str, float]

evaluation_router = APIRouter(prefix="/evaluate", dependencies=[Depends(is_clerk_user)])

# @evaluation_router.post("/", response_model=EvaluationResponse)
# async def evaluate(request: EvaluationRequest, user: User = Depends(is_clerk_user)):
#     if user.id != request.user_id:
#         raise HTTPException(status_code=403, detail="User ID mismatch")

#     users_gateway = UsersGateway()
#     activities_gateway = ActivitiesGateway()
#     moods_gateway = MoodsGateway()

#     # Simulate conversation history
#     memory = DatabaseMemory(MongoDBGateway("messages"), user_id=user.id)
#     for message in request.conversation_history:
#         if message.is_from_user:
#             memory.add_user_message(message.content)
#         else:
#             memory.add_assistant_message(message.content)

#     answer = talk_with_assistant(user.id, request.question, users_gateway, activities_gateway)

#     activities, _ = get_activities_from_conversation(user.id, activities_gateway)
#     activity_entries, _ = get_activity_entries_from_conversation(user.id, activities_gateway)
#     mood_report, _ = get_mood_report_from_conversation(user.id)

#     cost = {"total_in_eur": 0.01}  # Placeholder value

#     return EvaluationResponse(
#         answer=answer,
#         activities=[a.model_dump() for a in activities],
#         activity_entries=[e.model_dump() for e in activity_entries],
#         mood_report=mood_report.model_dump() if mood_report else None,
#         cost=cost
#     )

# # Import these functions or implement them in this file