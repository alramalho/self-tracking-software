from gateways.database.mongodb import MongoDBGateway
from entities.plan import Plan, PlanSession
from entities.activity import Activity
from ai.llm import ask_schema
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, create_model
from gateways.activities import ActivitiesGateway
from datetime import datetime

class PlanController:
    def __init__(self):
        self.db_gateway = MongoDBGateway("plans")
        self.activities_gateway = ActivitiesGateway()

    def create_plan(self, user_id: str, plan_data: Dict) -> Plan:
        sessions = [PlanSession(**session) for session in plan_data.get('sessions', [])]
        plan = Plan.new(
            user_id=user_id,
            goal=plan_data['goal'],
            finishing_date=plan_data.get('finishing_date'),
            sessions=sessions
        )
        
        # Create activities and get their IDs
        activity_ids = []
        for activity_description in plan_data.get('activity_descriptions', []):
            activity = Activity.new(user_id, activity_description, "count")  # Default measure to "count"
            created_activity = self.activities_gateway.create_activity(activity)
            activity_ids.append(created_activity.id)
        
        plan.activity_ids = activity_ids
        self.db_gateway.write(plan.dict())
        return plan

    def get_plan(self, plan_id: str) -> Plan:
        data = self.db_gateway.query("id", plan_id)
        if len(data) > 0:
            return Plan(**data[0])
        else:
            raise Exception("Plan not found")

    def generate_plans(self, goal: str, finishing_date: Optional[str] = None, plan_description: Optional[str] = None) -> List[Dict]:
        current_date = datetime.now().strftime("%Y-%m-%d")
        system_prompt = f"""
        You will act as a personal coach for the goal of {goal}.

        Generate a progressive plan where activities intensity and/or recurrence should increase over time.
        The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.

        Current date: {current_date}
        """

        user_prompt = f"Help me achieve the goal: {goal}\nFinishing Date: {finishing_date}"
        
        if plan_description:
            user_prompt += f"\nAdditional plan description: {plan_description}"
        class GeneratedActivity(BaseModel):
            description: str
            frequency: str

        class GeneratedSession(BaseModel):
            date: str
            descriptive_guide: str

        class GeneratedPlan(BaseModel):
            intensity: str = Field(..., description="The intensity level of the plan: low, medium, or high")
            activities: List[GeneratedActivity] = Field(..., description="List of activities for this plan")
            sessions: List[GeneratedSession] = Field(..., description="List of sessions for this plan")

        class GeneratePlansResponse(BaseModel):
            plans: List[GeneratedPlan] = Field(..., description="List of 3 generated plans with varying intensities")

        response = ask_schema(user_prompt, system_prompt, GeneratePlansResponse)
        
        simplified_plans = []
        for generated_plan in response.plans:
            simplified_plan = {
                "goal": goal,
                "finishing_date": finishing_date,
                "activity_descriptions": [activity.description for activity in generated_plan.activities],
                "sessions": [session.dict() for session in generated_plan.sessions],
                "intensity": generated_plan.intensity
            }
            simplified_plans.append(simplified_plan)
        
        return simplified_plans

    def update_plan(self, plan: Plan) -> Plan:
        self.db_gateway.write(plan.dict())
        return plan