from gateways.database.mongodb import MongoDBGateway
from entities.plan import Plan, PlanSession, PlanInvitee
from entities.activity import Activity
from ai.llm import ask_schema
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, create_model
from gateways.activities import ActivitiesGateway, ActivityAlreadyExistsException
from datetime import datetime, timedelta
from entities.user import User
import concurrent.futures
from loguru import logger
from bson import ObjectId


class PlanController:
    def __init__(self):
        self.db_gateway = MongoDBGateway("plans")
        self.activities_gateway = ActivitiesGateway()

    def create_plan(self, plan: Plan) -> Plan:
        self.db_gateway.write(plan.dict())
        logger.info(f"Created plan for user {plan.user_id}: {plan.goal}")
        return plan
    
    def create_plan_from_generated_plan(self, user_id: str, generated_plan_data: Dict[str, Any]) -> Plan:
        sessions = [PlanSession(**session) for session in generated_plan_data.get("sessions", [])]
        plan = Plan.new(
            user_id=user_id,
            goal=generated_plan_data["goal"],
            emoji=generated_plan_data.get("emoji", ""),
            finishing_date=generated_plan_data.get("finishing_date", None),
            invitees=[
                PlanInvitee(**invitee) for invitee in generated_plan_data.get("invitees", [])
            ],
            sessions=sessions,
        )

        for activity in generated_plan_data.get("activities", []):
            converted_activity = Activity.new(
                id=activity.get("activity_id"),
                user_id=user_id,
                title=activity.get("title"),
                measure=activity.get("measure"),
                emoji=activity.get("emoji"),
            )
            try:
                self.activities_gateway.create_activity(
                    converted_activity
                )
            except ActivityAlreadyExistsException:
                logger.info(
                    f"Activity {converted_activity.id} ({converted_activity.title}) already exists"
                )

        self.db_gateway.write(plan.dict())
        return plan

    def get_recommended_plans(self, user: User, limit: int = 5) -> List[Plan]:

        # get all plans
        all_plans = [
            Plan(**plan)
            for plan in self.db_gateway.scan()
            if plan["user_id"] != user.id
        ]
        user_plans = self.get_plans(user.plan_ids)

        # get a list of plans for each user plan based on similarity search of that plan and the user plan (n x N)
        results_map = []
        for user_plan in user_plans:
            top_goals_obj = self.db_gateway.vector_search(
                "goal",
                user_plan.goal,
                exclude_ids=[plan.id for plan in user_plans],
                limit=limit,
            )
            results_map.append(top_goals_obj)

        # order the list based on the similarity of the plans (desc numerical order)
        results_map = sorted(results_map, key=lambda x: x[0]["score"], reverse=True)
        top_goals = [obj["goal"] for obj in results_map[:limit]]

        top_plans = [plan for plan in all_plans if plan.goal in top_goals]

        # todo: give importance to diveristy of data (multiple users & plan types) – penalty on similarity to cumulative result set?
        # todo: give time penalty – prioritize activities that are closer to the current date

        # return the list of plans
        return top_plans

    def get_recommended_activities(self, user: User, limit: int = 5) -> List[Activity]:

        # get all activities
        user_activities = self.activities_gateway.get_all_activities_by_user_id(
            user.id
        )[
            :5
        ]  # limit to 5 to avoid too much data
        user_activities_ids = [activity.id for activity in user_activities]

        # get a list of activities for each user activity based on similarity search of that activity and the user activity (n x N)
        top_activity_objs = []

        for user_activity in user_activities:
            top_activity_objs.extend(
                self.activities_gateway.activities_db_gateway.vector_search(
                    "title",
                    user_activity.title,
                    exclude_ids=user_activities_ids,
                    limit=limit,
                )
            )

        top_activities = [
            self.activities_gateway.get_activity_by_id(a["id"])
            for a in top_activity_objs
        ]

        # todo: give importance to diveristy of data (multiple users & plan types) – penalty on similarity to cumulative result set?
        # todo: give time penalty – prioritize activities that are closer to the current date

        # return the list of activities
        return top_activities

    def get_plan(self, plan_id: str) -> Optional[Plan]:
        data = self.db_gateway.query("id", plan_id)
        if len(data) > 0:
            return Plan(**data[0])
        else:
            logger.error(f"Plan not found: {plan_id}")
            return None

    def generate_plans(
        self,
        goal: str,
        finishing_date: Optional[str] = None,
        plan_description: Optional[str] = None,
    ) -> List[Dict]:
        current_date = datetime.now().strftime("%Y-%m-%d, %A")
        if not finishing_date:
            finishing_date = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")

        number_of_weeks = self._count_number_of_weeks_till(finishing_date)
        system_prompt = f"""
        You will act as a personal coach for the goal of {goal}, given the finishing date of {finishing_date} and that today is {current_date}.
        No date should be before today ({current_date}).
        For that, wll you will develop a progressive plan over the course of {number_of_weeks} weeks.
        
        The plan should be progressive (intensities or recurrence of activities should increase over time).
        The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.
        """

        user_prompt = f"Please generate me a plan to achieve the goal of {goal} by {finishing_date}."

        if plan_description:
            user_prompt += f"\nAdditional plan description: {plan_description}"

        class GeneratedActivity(BaseModel):
            emoji: str
            title: str
            measure: str = Field(
                description="The unit of measure for this activity. (e.g. 'minutes', 'kilometers', 'times')"
            )

        class GeneratedSession(BaseModel):
            date: str
            activity_name: str = Field(
                description="The name of the activity to be performed. Should match exactly with the activity title."
            )
            quantity: int = Field(
                description="The quantity of the activity to be performed. Directly related to the actvity and should be measured in the same way."
            )
            descriptive_guide: str

        class GeneratedSessionWeek(BaseModel):
            week_number: int
            reasoning: str = Field(
                ...,
                description="A step by step thinking on how intense the week should be given the ammount of weeks left to achieve the goal.",
            )
            sessions_per_week: str
            sessions: List[GeneratedSession] = Field(
                ...,
                description="List of sessions for this plan. The length should be the same as the sessions_per_week.",
            )

        class GeneratedPlan(BaseModel):
            emoji: str
            overview: str = Field(..., description="A short overview of the plan")
            activities: List[GeneratedActivity] = Field(
                ..., description="List of activities for this plan"
            )
            sessions_weeks: List[GeneratedSessionWeek] = Field(
                ..., description="List of sessions weeks for this plan"
            )

        def generate_plan_for_intensity(intensity: str) -> Dict:
            class GeneratePlansResponse(BaseModel):
                reasoning: str = Field(
                    ...,
                    description=f"A reflection on what is the goal and how does that affect the plan and its progresison. Most notably, how it affects the intensity of the weeks, and how progressive should they be to culiminate init the goal of {goal} by the finishing date.",
                )
                plan: GeneratedPlan = Field(
                    ..., description=f"The generated plan of {intensity} intensity"
                )

            response = ask_schema(
                user_prompt,
                f"{system_prompt}\nThis plan should be a {intensity} intensity plan.",
                GeneratePlansResponse,
            )

            new_activities = [
                {**activity.dict(), "id": activity.id}
                for activity in response.plan.activities
            ]
            return {
                "goal": goal,
                "finishing_date": finishing_date,
                "activities": new_activities,      
                "sessions": [
                    {**session.dict(), "activity_id": next((a["id"] for a in new_activities if a["title"].lower() == session.activity_name), None)}
                    for session_week in response.plan.sessions_weeks
                    for session in session_week.sessions
                    if session.date >= current_date
                ],
                "intensity": intensity,
                "overview": response.plan.overview,
            }

        intensities = ["low", "medium", "high"]

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_to_intensity = {
                executor.submit(generate_plan_for_intensity, intensity): intensity
                for intensity in intensities
            }
            simplified_plans = []

            for future in concurrent.futures.as_completed(future_to_intensity):
                intensity = future_to_intensity[future]
                try:
                    plan = future.result()
                    simplified_plans.append(plan)
                except Exception as exc:
                    print(
                        f"{intensity} intensity plan generation generated an exception: {exc}"
                    )

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

    def get_plans(self, plan_ids: List[str]) -> List[Plan]:
        plans = []
        for plan_id in plan_ids:
            plan = self.get_plan(plan_id)
            if plan:
                plans.append(plan)
        return plans
    
    def permanently_delete_plan(self, plan_id: str) -> None:
        self.db_gateway.delete_all('id', plan_id)
        logger.info(f"Plan {plan_id} forever deleted")
