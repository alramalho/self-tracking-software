from gateways.database.mongodb import MongoDBGateway
from entities.plan import Plan, PlanSession, PlanInvitee
from entities.activity import Activity
from entities.plan_invitation import PlanInvitation
from ai.llm import ask_schema
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, create_model
from gateways.activities import ActivitiesGateway, ActivityAlreadyExistsException
from gateways.users import UsersGateway
from datetime import datetime, timedelta, UTC
from entities.user import User
import concurrent.futures
from loguru import logger
from bson import ObjectId
from entities.activity import SAMPLE_SEARCH_ACTIVITY

class PlanController:
    def __init__(self):
        self.db_gateway = MongoDBGateway("plans")
        self.activities_gateway = ActivitiesGateway()
        self.users_gateway = UsersGateway()
        self.plan_invitation_gateway = MongoDBGateway("plan_invitations")
        logger.log("CONTROLLERS", "PlanController initialized")

    def create_plan(self, plan: Plan) -> Plan:
        logger.log("CONTROLLERS", f"Creating plan for user {plan.user_id}: {plan.goal}")
        self.db_gateway.write(plan.dict())
        return plan

    def create_plan_from_generated_plan(
        self, user_id: str, generated_plan_data: Dict[str, Any]
    ) -> Plan:
        logger.log("CONTROLLERS", f"Creating plan from generated plan for user {user_id}")
        sessions = [
            PlanSession(**session)
            for session in generated_plan_data.get("sessions", [])
        ]
        plan = Plan.new(
            user_id=user_id,
            goal=generated_plan_data["goal"],
            emoji=generated_plan_data.get("emoji", ""),
            finishing_date=generated_plan_data.get("finishing_date", None),
            invitees=[
                PlanInvitee(**invitee)
                for invitee in generated_plan_data.get("invitees", [])
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
                self.activities_gateway.create_activity(converted_activity)
            except ActivityAlreadyExistsException:
                logger.info(
                    f"Activity {converted_activity.id} ({converted_activity.title}) already exists"
                )

        self.db_gateway.write(plan.dict())
        return plan

    def get_recommended_plans(self, user: User, limit: int = 5) -> List[Plan]:
        logger.log("CONTROLLERS", f"Getting recommended plans for user {user.id}")
        all_plans = [
            Plan(**plan)
            for plan in self.db_gateway.scan()
            if plan["user_id"] != user.id
        ]
        user_plans = self.get_plans(user.plan_ids)

        results_map = []
        for user_plan in user_plans:
            top_goals_obj = self.db_gateway.vector_search(
                "goal",
                user_plan.goal,
                exclude_key="user_id",
                exclude_value=user.id,
                limit=limit,
            )
            results_map.append(top_goals_obj)

        results_map = sorted(results_map, key=lambda x: x[0]["score"], reverse=True)
        top_goals = [obj["goal"] for obj in results_map[:limit]]

        top_plans = [plan for plan in all_plans if plan.goal in top_goals]

        return top_plans

    def get_recommended_activities(self, user: User, limit: int = 5) -> List[Activity]:
        logger.log("CONTROLLERS", f"Getting recommended activities for user {user.id}")
        user_activities = self.activities_gateway.get_all_activities_by_user_id(
            user.id
        )[:5]

        if len(user_activities) == 0:
            user_activities = [SAMPLE_SEARCH_ACTIVITY]

        query = ", ".join([activity.title for activity in user_activities])
        top_activity_objs = (
            self.activities_gateway.activities_db_gateway.vector_search(
                "title",
                query,
                exclude_key="user_id",
                exclude_value=user.id,
                limit=limit,
            )
        )
        logger.log("CONTROLLERS", f"Got {len(top_activity_objs)} activities for query: {query}")

        top_activities = {
            a["id"]: self.activities_gateway.get_activity_by_id(a["id"])
            for a in top_activity_objs
        }

        return list(top_activities.values())

    def get_plan(self, plan_id: str) -> Optional[Plan]:
        logger.log("CONTROLLERS", f"Getting plan: {plan_id}")
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
        logger.log("CONTROLLERS", f"Generating plans for goal: {goal}")
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
                {**activity.dict(), "id": str(ObjectId())}
                for activity in response.plan.activities
            ]
            return {
                "goal": goal,
                "finishing_date": finishing_date,
                "activities": new_activities,
                "sessions": [
                    {
                        **session.dict(),
                        "activity_id": next(
                            (
                                a["id"]
                                for a in new_activities
                                if a["title"].lower() == session.activity_name.lower()
                            ),
                            None,
                        ),
                    }
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
        logger.log("CONTROLLERS", f"Updating plan: {plan.id}")
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
        logger.log("CONTROLLERS", f"Permanently deleting plan: {plan_id}")
        self.db_gateway.delete_all("id", plan_id)

    def update_plan_sessions_with_activity_ids(self, plan: Plan) -> Plan:
        logger.log("CONTROLLERS", f"Updating plan sessions with activity IDs for plan: {plan.id}")
        user_activities = self.activities_gateway.get_all_activities_by_user_id(plan.user_id)
        
        activity_dict = {activity.title.lower(): activity.id for activity in user_activities}
        
        updated_sessions = []
        for session in plan.sessions:
            if not session.activity_id:
                matching_activity_id = activity_dict.get(session.descriptive_guide.lower())
                if matching_activity_id:
                    session.activity_id = matching_activity_id
            updated_sessions.append(session)
        
        plan.sessions = updated_sessions
        
        self.update_plan(plan)
        
        return plan

    def update_all_plans_with_activity_ids(self):
        logger.log("CONTROLLERS", "Updating all plans with activity IDs")
        all_plans = self.db_gateway.scan()
        for plan_data in all_plans:
            plan = Plan(**plan_data)
            self.update_plan_sessions_with_activity_ids(plan)

    def invite_user_to_plan(self, plan_id: str, sender_id: str, recipient_id: str) -> PlanInvitation:
        logger.log("CONTROLLERS", f"Inviting user {recipient_id} to plan {plan_id}")
        invitation = PlanInvitation.new(plan_id, sender_id, recipient_id)
        self.plan_invitation_gateway.write(invitation.dict())
        
        # Update recipient's pending_plan_invitations
        recipient = self.users_gateway.get_user_by_id(recipient_id)
        recipient.pending_plan_invitations.append(invitation.id)
        self.users_gateway.update_user(recipient)
        
        return invitation

    def accept_plan_invitation(self, invitation_id: str) -> Plan:
        logger.log("CONTROLLERS", f"Accepting plan invitation: {invitation_id}")
        invitation = self.plan_invitation_gateway.query("id", invitation_id)[0]
        invitation = PlanInvitation(**invitation)
        
        if invitation.status != "pending":
            raise ValueError("Invitation is not pending")
        
        plan = self.get_plan(invitation.plan_id)
        recipient = self.users_gateway.get_user_by_id(invitation.recipient_id)
        
        # Update invitation status
        invitation.status = "accepted"
        invitation.updated_at = datetime.now(UTC).isoformat()
        self.plan_invitation_gateway.write(invitation.dict())
        
        # Add recipient to plan invitees
        plan.invitees.append(PlanInvitee(user_id=recipient.id, name=recipient.name))
        self.update_plan(plan)
        
        # Add plan to recipient's plan_ids
        recipient.plan_ids.append(plan.id)
        recipient.pending_plan_invitations.remove(invitation_id)
        self.users_gateway.update_user(recipient)
        
        return plan

    def reject_plan_invitation(self, invitation_id: str) -> None:
        logger.log("CONTROLLERS", f"Rejecting plan invitation: {invitation_id}")
        invitation = self.plan_invitation_gateway.query("id", invitation_id)[0]
        invitation = PlanInvitation(**invitation)
        
        if invitation.status != "pending":
            raise ValueError("Invitation is not pending")
        
        # Update invitation status
        invitation.status = "rejected"
        invitation.updated_at = datetime.now(UTC).isoformat()
        self.plan_invitation_gateway.write(invitation.dict())
        
        # Remove invitation from recipient's pending_plan_invitations
        recipient = self.users_gateway.get_user_by_id(invitation.recipient_id)
        recipient.pending_plan_invitations.remove(invitation_id)
        self.users_gateway.update_user(recipient)


if __name__ == "__main__":
    from shared.logger import create_logger
    create_logger(level="INFO")
    plan_controller = PlanController()
    plan_controller.update_all_plans_with_activity_ids()
