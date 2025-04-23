from shared.logger import create_logger
create_logger(level="DEBUG")
import asyncio

from gateways.users import UsersGateway
from controllers.plan_controller import PlanController
from gateways.vector_database.pinecone import PineconeVectorDB
from gateways.recommendations import RecommendationsGateway

users_gateway = UsersGateway()
plan_controller = PlanController()
recommendations_gateway = RecommendationsGateway()
users_pinecone_vector_db = PineconeVectorDB("users")
plans_pinecone_vector_db = PineconeVectorDB("plans")

user = users_gateway.get_user_by("username", "alex")
# user_plans = plan_controller.get_all_user_active_plans(user)
# for plan in user_plans:
#     plans_pinecone_vector_db.upsert_record(text=plan.goal, identifier=plan.id, metadata={"user_id": user.id})

# print(f"Upserted {len(user_plans)} plans for user {user.id}")

# if user.profile:
#     users_pinecone_vector_db.upsert_record(text=user.profile, identifier=user.id, metadata={"user_id": user.id})
#     print(f"Upserted user profile for user {user.id}")

asyncio.run(recommendations_gateway.compute_recommended_users(user))