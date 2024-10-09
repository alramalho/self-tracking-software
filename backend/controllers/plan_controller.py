from gateways.database.mongodb import MongoDBGateway
from entities.plan import Plan, PlanSession
from entities.activity import Activity
from ai.llm import ask_schema
from typing import List, Optional, Dict
from pydantic import BaseModel, Field, create_model
from gateways.activities import ActivitiesGateway
from datetime import datetime
import concurrent.futures

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
        for activity in plan_data.get('activities', []):
            converted_activity = Activity.new(
                user_id=user_id,
                title=activity.get('title'),
                measure=activity.get('measure')
            )
            created_activity = self.activities_gateway.create_activity(converted_activity)
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
        current_date = datetime.now().strftime("%Y-%m-%d, %A")
        number_of_weeks = self._count_number_of_weeks_till(finishing_date)
        system_prompt = f"""
        You will act as a personal coach for the goal of {goal}.

        Generate a progressive plan where activities intensity and/or recurrence should increase over time.
        The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.

        The plan should encompass and be gently progressive over the span of {number_of_weeks} (weeks till the finishing date).

        Current date: {current_date}
        """

        user_prompt = f"Help me achieve the goal: {goal}\nFinishing Date: {finishing_date}"
        
        if plan_description:
            user_prompt += f"\nAdditional plan description: {plan_description}"

        class GeneratedActivity(BaseModel):
            emoji: str
            title: str
            measure: str = Field(description="The unit of measure for this activity. (e.g. 'minutes', 'kilometers', 'times')")

        class GeneratedSession(BaseModel):
            date: str
            activity_name: str
            quantity: int = Field(description="The quantity of the activity to be performed. Directly related to the actvity and should be measured in the same way.")
            descriptive_guide: str

        class GeneratedSessionWeek(BaseModel):
            reasoning: str = Field(..., description="A step by step thinking on how intense the week should be given the ammount of weeks left to achieve the goal.")
            times_per_week: str
            sessions: List[GeneratedSession] = Field(..., description="List of sessions for this plan. The length should be the same as the times_per_week.")

        class GeneratedPlan(BaseModel):
            overview: str = Field(..., description="A short overview of the plan")
            activities: List[GeneratedActivity] = Field(..., description="List of activities for this plan")
            sessions_weeks: List[GeneratedSessionWeek] = Field(..., description="List of sessions weeks for this plan")

        def generate_plan_for_intensity(intensity: str) -> Dict:
            class GeneratePlansResponse(BaseModel):
                reasoning: str = Field(..., description=f"A reflection on what is the goal and how does that affect the plan and its progresison. Most notably, how it affects the intensity of the weeks, and how progressive should they be to culiminate init the goal of {goal} by the finishing date.")
                plan: GeneratedPlan = Field(..., description=f"The generated plan of {intensity} intensity")

            response = ask_schema(user_prompt, f"{system_prompt}\nGenerate a {intensity} intensity plan.", GeneratePlansResponse)            
            return {
                "goal": goal,
                "finishing_date": finishing_date,
                "activities": [activity.dict() for activity in response.plan.activities],
                "sessions": [session.dict() for session_week in response.plan.sessions_weeks for session in session_week.sessions],
                "intensity": intensity,
                "overview": response.plan.overview
                }

        intensities = ["low", "medium", "high"]
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_to_intensity = {executor.submit(generate_plan_for_intensity, intensity): intensity for intensity in intensities}
            simplified_plans = []
            
            for future in concurrent.futures.as_completed(future_to_intensity):
                intensity = future_to_intensity[future]
                try:
                    plan = future.result()
                    simplified_plans.append(plan)
                except Exception as exc:
                    print(f'{intensity} intensity plan generation generated an exception: {exc}')
        
        return simplified_plans
    
    def _count_number_of_weeks_till(self, finishing_date: Optional[str] = None) -> int:
        if finishing_date:
            current_date = datetime.now()
            finishing_date = datetime.strptime(finishing_date, "%Y-%m-%d")
            return (finishing_date - current_date).days // 7 + 1
        return 0

    def update_plan(self, plan: Plan) -> Plan:
        self.db_gateway.write(plan.dict())
        return plan