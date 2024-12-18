from gateways.database.mongodb import MongoDBGateway
from gateways.plan_invitations import PlanInvitationsGateway
from entities.plan import Plan, PlanSession
from entities.plan_group import PlanGroupMember
from entities.activity import Activity
from entities.plan_invitation import PlanInvitation
from ai.llm import ask_schema
from typing import List, Optional, Dict, Any, Tuple, Literal
from pydantic import BaseModel, Field, create_model
from gateways.activities import ActivitiesGateway, ActivityAlreadyExistsException
from gateways.users import UsersGateway
from datetime import datetime, timedelta, UTC
from entities.user import User
import concurrent.futures
from loguru import logger
from bson import ObjectId
from entities.activity import SAMPLE_SEARCH_ACTIVITY
from copy import deepcopy
from gateways.plan_groups import PlanGroupsGateway
import traceback
from shared.utils import days_ago

class PlanActivityUpdate(BaseModel):
    id: str
    title: str
    measure: str
    emoji: str

class GeneratedPlanUpdate(BaseModel):
    goal: str
    emoji: Optional[str] = None
    finishing_date: Optional[str] = None
    activities: List[PlanActivityUpdate]
    sessions: Optional[List[PlanSession]] = None
    notes: Optional[str] = None
    duration_type: Optional[Literal["habit", "lifestyle", "custom"]] = None
    outline_type: Optional[Literal["specific", "times_per_week"]] = "specific"
    times_per_week: Optional[int] = None

class PlanController:
    def __init__(self):
        self.db_gateway = MongoDBGateway("plans")
        self.activities_gateway = ActivitiesGateway()
        self.users_gateway = UsersGateway()
        self.plan_invitation_gateway = PlanInvitationsGateway()
        self.plan_groups_gateway = PlanGroupsGateway()
        logger.log("CONTROLLERS", "PlanController initialized")

    def _get_readable_plan(self, plan: Plan) -> str:
        # Get unique activities for this plan
        activity_ids = {session.activity_id for session in plan.sessions}
        activities = [self.activities_gateway.get_activity_by_id(aid) for aid in activity_ids]
        activity_names = [a.title for a in activities if a]
        
        # Get current week's activity entries
        today = datetime.now(UTC)
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        # Check if all activities were completed this week
        all_activities_for_plan = []
        for activity_id in activity_ids:
            all_activities_for_plan.extend(self.activities_gateway.get_all_activity_entries_by_activity_id(activity_id))

        this_week_activity_entries_for_plan = [entry for entry in all_activities_for_plan if week_start <= datetime.fromisoformat(entry.date).replace(tzinfo=UTC) <= week_end]

        is_week_completed = any([self.is_week_finisher_of_plan(entry.id, plan) for entry in this_week_activity_entries_for_plan])
        
        activities_str = "', '".join(activity_names)
        completion_str = "completed all of these activities!" if is_week_completed else "didn't complete all their planned activities"
        
        return f"'{plan.goal}' - with activities '{activities_str}'. Last week user {completion_str}"

    def get_readable_plans(self, user_id: str) -> str:
        logger.log("CONTROLLERS", f"Getting readable plans for user {user_id}")
        
        user = self.users_gateway.get_user_by_id(user_id)
        if not user:
            return []
            
        plans = self.get_all_user_active_plans(user)
        if not plans:
            return []

        return "\n".join([f"{i+1}. {self._get_readable_plan(plan)}" for i, plan in enumerate(plans)])

    def create_plan(self, plan: Plan) -> Plan:
        logger.log("CONTROLLERS", f"Creating plan for user {plan.user_id}: {plan.goal}")
        self.db_gateway.write(plan.dict())
        return plan

    def _process_generated_plan_activities(
        self,
        user_id: str,
        generated_plan_data: GeneratedPlanUpdate
    ) -> List[Activity]:
        """Helper method to process and create activities from generated plan data"""
        new_plan_activities = []
        # Get existing user activities for matching
        user_activities = self.activities_gateway.get_all_activities_by_user_id(user_id)
        
        for activity in generated_plan_data.activities:
            # Check if activity already exists (matching title and measure)
            existing_activity = next(
                (a for a in user_activities 
                 if a.title.lower() == activity.title.lower() 
                 and a.measure.lower() == activity.measure.lower()),
                None
            )
            
            if existing_activity:
                # Use existing activity ID
                activity.id = existing_activity.id
                new_plan_activities.append(existing_activity)
            else:
                # Create new activity with new ID
                converted_activity = Activity.new(
                    id=str(ObjectId()),
                    user_id=user_id,
                    title=activity.title,
                    measure=activity.measure,
                    emoji=activity.emoji,
                )
                try:
                    new_plan_activities.append(
                        self.activities_gateway.create_activity(converted_activity)
                    )
                except ActivityAlreadyExistsException:
                    logger.info(
                        f"Activity {converted_activity.id} ({converted_activity.title}) already exists"
                    )
        return new_plan_activities

    def _create_plan_sessions(
        self,
        generated_plan_data: GeneratedPlanUpdate
    ) -> List[PlanSession]:
        """Helper method to create plan sessions from generated plan data"""
        return [
            PlanSession(**session.dict())
            for session in generated_plan_data.sessions
            if session.activity_id
        ]

    def create_plan_from_generated_plan(
        self,
        user_id: str,
        generated_plan_data: GeneratedPlanUpdate
    ) -> Tuple[Plan, List[Activity]]:
        logger.log(
            "CONTROLLERS", f"Creating plan from generated plan for user {user_id}"
        )
        
        # Process activities and sessions
        new_plan_activities = self._process_generated_plan_activities(user_id, generated_plan_data)
        sessions = self._create_plan_sessions(generated_plan_data)
        
        # Create new plan
        plan = Plan.new(
            user_id=user_id,
            goal=generated_plan_data.goal,
            emoji=generated_plan_data.emoji,
            finishing_date=generated_plan_data.finishing_date,
            notes=generated_plan_data.notes,
            duration_type=generated_plan_data.duration_type,
            sessions=sessions,
            outline_type=generated_plan_data.outline_type,
            times_per_week=generated_plan_data.times_per_week,
        )
        
        self.db_gateway.write(plan.dict())
        return plan, new_plan_activities

    def get_all_user_active_plans(self, user: User) -> List[Plan]:
        logger.log("CONTROLLERS", f"Getting all plans for user {user.id}")
        plans = []
        for plan_id in user.plan_ids:
            plan = self.get_plan(plan_id)
            current_date = datetime.now(UTC)
            if plan and plan.finishing_date and current_date < datetime.fromisoformat(plan.finishing_date).replace(tzinfo=UTC):
                plans.append(plan)
        return plans

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
                include_key="user_id",
                include_values=user.friend_ids,
                limit=limit,
            )
            results_map.append(top_goals_obj)

        results_map = sorted(results_map, key=lambda x: x[0]["score"], reverse=True)
        top_goals = [obj["goal"] for obj in results_map[:limit]]

        top_plans = [plan for plan in all_plans if plan.goal in top_goals]

        return top_plans

    def get_recommended_activities(self, user: User, limit: int = 5) -> List[Activity]:
        logger.log("CONTROLLERS", f"Getting recommended activities for user {user.id}")

        if len(user.friend_ids) == 0:
            return []

        user_activities = self.activities_gateway.get_all_activities_by_user_id(
            user.id
        )[:5]

        if len(user_activities) == 0:
            user_activities = [SAMPLE_SEARCH_ACTIVITY]

        query = ", ".join([activity.title for activity in user_activities])
        top_activity_objs = self.activities_gateway.activities_db_gateway.vector_search(
            "title",
            query,
            include_key="user_id",
            include_values=user.friend_ids,
            limit=limit,
        )
        logger.log(
            "CONTROLLERS", f"Got {len(top_activity_objs)} activities for query: {query}"
        )

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
        user_defined_activities: Optional[List[Activity]] = None,
    ) -> List[Dict]:
        logger.log("CONTROLLERS", f"Generating plans for goal: {goal}")
        current_date = datetime.now().strftime("%Y-%m-%d, %A")
        if not finishing_date:
            finishing_date = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")

        number_of_weeks = self._count_number_of_weeks_till(finishing_date)
        system_prompt = f"""
        You will act as a personal coach for the goal of {goal}, given the finishing date of {finishing_date} and that today is {current_date}.
        No date should be before today ({current_date}).
        For that, you will develop a progressive plan over the course of {number_of_weeks} weeks.
        Keep the activties to a minimum.
        The plan should be progressive (intensities or recurrence of activities should increase over time).
        The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.
        It is absolutely mandatory that all present sessions activity names are contained in the list of activities.
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

        def generate_plan_for_intensity(intensity: str, user_defined_activities: List[Activity]) -> Dict:
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

            # Process activities with matching against existing ones
            new_activities = []
            for activity in response.plan.activities:
                # Check if activity already exists (matching title and measure)
                existing_activity = next(
                    (a for a in user_defined_activities 
                     if a.title.lower() == activity.title.lower() 
                     and a.measure.lower() == activity.measure.lower()),
                    None
                )
                
                if existing_activity:
                    # Use existing activity's data and ID
                    new_activities.append({
                        **activity.dict(),
                        "id": existing_activity.id
                    })
                else:
                    # Create new activity with new ID
                    new_activities.append({
                        **activity.dict(),
                        "id": str(ObjectId())
                    })

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

        intensities = ["medium"]

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            future_to_intensity = {
                executor.submit(generate_plan_for_intensity, intensity, user_defined_activities): intensity
                for intensity in intensities
            }
            simplified_plans = []

            for future in concurrent.futures.as_completed(future_to_intensity):
                intensity = future_to_intensity[future]
                try:
                    plan = future.result()
                    simplified_plans.append(plan)
                except Exception as exc:
                    logger.error(
                        f"{intensity} intensity plan generation generated an exception: {exc}"
                    )
                    logger.error(traceback.format_exc())

        return simplified_plans

    def _count_number_of_weeks_till(self, finishing_date: Optional[str] = None) -> int:
        if finishing_date:
            current_date = datetime.now(UTC)
            try:
                finishing_date = datetime.strptime(finishing_date, "%Y-%m-%d").replace(tzinfo=UTC)
            except ValueError:
                finishing_date = datetime.fromisoformat(finishing_date)
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

    def delete_plan(self, plan_id: str) -> None:
        logger.log("CONTROLLERS", f"Deleting plan: {plan_id}")
        plan = self.get_plan(plan_id)
        if plan:
            plan.deleted_at = datetime.now(UTC).isoformat()
            self.update_plan(plan)

    def permanently_delete_plan(self, plan_id: str) -> None:
        logger.log("CONTROLLERS", f"Permanently deleting plan: {plan_id}")
        self.db_gateway.delete_all("id", plan_id)

    def update_plan_sessions_with_activity_ids(self, plan: Plan) -> Plan:
        logger.log(
            "CONTROLLERS",
            f"Updating plan sessions with activity IDs for plan: {plan.id}",
        )
        user_activities = self.activities_gateway.get_all_activities_by_user_id(
            plan.user_id
        )

        activity_dict = {
            activity.title.lower(): activity.id for activity in user_activities
        }

        updated_sessions = []
        for session in plan.sessions:
            if not session.activity_id:
                matching_activity_id = activity_dict.get(
                    session.descriptive_guide.lower()
                )
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

    def accept_plan_invitation(
        self, invitation: PlanInvitation, activity_associations: Dict[str, str]
    ) -> Plan:
        logger.log("CONTROLLERS", f"Accepting plan invitation: {invitation.id}")

        recipient = self.users_gateway.get_user_by_id(invitation.recipient_id)


       # skip if user already has a plan with the same group
        all_plans = self.get_all_user_active_plans(recipient)
        inviters_plan = self.get_plan(invitation.plan_id)
        for plan in all_plans:
            if plan.plan_group_id == inviters_plan.plan_group_id and plan.id != inviters_plan.id:
                logger.info(f"User already has a plan with the same group: {plan.id}")
                raise ValueError("User already has a plan with the same group")
            
        # Update sessions with associated activities
        new_sessions = []
        for session in inviters_plan.sessions:
            if session.activity_id in activity_associations:
                new_session = deepcopy(session)
                new_session.activity_id = activity_associations[session.activity_id]
                new_sessions.append(new_session)
            else:
                new_sessions.append(session)

        # duplicate plan to recipient
        recipients_plan = Plan(
            id=str(ObjectId()),
            user_id=recipient.id,
            plan_group_id=inviters_plan.plan_group_id,
            goal=inviters_plan.goal,
            emoji=inviters_plan.emoji,
            finishing_date=inviters_plan.finishing_date,
            sessions=new_sessions,
            created_at=datetime.now(UTC).isoformat(),
        )

        recipients_plan = self.create_plan(recipients_plan)

        # add plan to user
        self.users_gateway.add_plan_to_user(recipient.id, recipients_plan.id)

        # Update invitation status
        invitation.status = "accepted"
        invitation.updated_at = datetime.now(UTC).isoformat()
        self.plan_invitation_gateway.upsert_plan_invitation(invitation)

        # update plan group members and plan ids
        plan_group = self.plan_groups_gateway.get(inviters_plan.plan_group_id)
        self.plan_groups_gateway.add_member(
            plan_group,
            PlanGroupMember(
                user_id=recipient.id,
                name=recipient.name,
                username=recipient.username,
                picture=recipient.picture,
            ),
        )
        plan_group.plan_ids.append(recipients_plan.id)
        self.plan_groups_gateway.upsert_plan_group(plan_group)

        # add user as a friend if he was not already
        if invitation.sender_id not in recipient.friend_ids:
            self.users_gateway.add_friend(recipient.id, invitation.sender_id)

        # Create new activities if needed
        for (
            original_activity_id,
            associated_activity_id,
        ) in activity_associations.items():
            if associated_activity_id == "new":
                original_activity = self.activities_gateway.get_activity_by_id(
                    original_activity_id
                )
                new_activity = Activity.new(
                    user_id=recipient.id,
                    title=original_activity.title,
                    measure=original_activity.measure,
                    emoji=original_activity.emoji,
                )
                created_activity = self.activities_gateway.create_activity(new_activity)

                # Update the plan with the new activity ID
                for i, session in enumerate(inviters_plan.sessions):
                    if session.activity_id == original_activity_id:
                        recipients_plan.sessions[i].activity_id = created_activity.id

                self.update_plan(recipients_plan)
            else:
                activity = self.activities_gateway.get_activity_by_id(
                    associated_activity_id
                )
                activity.invitee_ids.append(recipient.id)
                self.activities_gateway.update_activity(activity)

        return recipients_plan

    def reject_plan_invitation(self, invitation: PlanInvitation) -> None:
        logger.log("CONTROLLERS", f"Rejecting plan invitation: {invitation.id}")

        if invitation.status != "pending":
            raise ValueError("Invitation is not pending")

        # Update invitation status
        invitation.status = "rejected"
        invitation.updated_at = datetime.now(UTC).isoformat()
        self.plan_invitation_gateway.upsert_plan_invitation(invitation)

    def is_week_finisher_of_plan(self, activity_entry_id: str, plan: Plan) -> bool:
        # Get the activity entry
        activity_entry = self.activities_gateway.get_activity_entry_by_id(activity_entry_id)
        if not activity_entry:
            return False

        # Get the current week's start and end dates
        activity_entry_date = datetime.fromisoformat(activity_entry.date).replace(tzinfo=UTC)
        week_start = activity_entry_date - timedelta(days=activity_entry_date.weekday())
        week_end = week_start + timedelta(days=6)

        # Filter sessions for current week and matching activity
        week_sessions = [
            session for session in plan.sessions 
            if (week_start <= datetime.fromisoformat(session.date).replace(tzinfo=UTC) <= week_end)
        ]
        
        if not week_sessions:
            return False

        # Count required sessions for this week
        required_sessions = len(week_sessions)

        # Get all activity entries for this week
        week_entries = self.activities_gateway.activity_entries_db_gateway.query_by_criteria({
            'activity_id': activity_entry.activity_id,
            'date': {
                '$gte': week_start.isoformat(),
                '$lte': week_end.isoformat()
            }
        })
        
        # Sort entries by creation time to check if current entry is the last one
        sorted_entries = sorted(week_entries, key=lambda x: x['created_at'])
        
        # Check if this entry is the last one and completes all required sessions
        return (len(sorted_entries) == required_sessions and 
                sorted_entries[-1]['id'] == activity_entry_id)

    def is_week_finisher_of_any_plan(self, activity_entry_id: str) -> Tuple[bool, Optional[str]]:
        # Get the activity entry
        activity_entry = self.activities_gateway.get_activity_entry_by_id(activity_entry_id)
        if not activity_entry:
            return False, None

        # Get all plans that contain this activity
        plans = [Plan(**plan) for plan in self.db_gateway.query_by_criteria({'sessions.activity_id': activity_entry.activity_id})]
        
        for plan in plans:
            if self.is_week_finisher_of_plan(activity_entry_id, plan):
                return True, plan.goal

        return False, None

    def update_plan_from_generated(
        self,
        plan_id: str,
        user_id: str,
        generated_plan_update: GeneratedPlanUpdate
    ) -> Plan:
        logger.log("CONTROLLERS", f"Updating plan {plan_id} from generated plan")
        
        # Get the existing plan
        existing_plan = self.get_plan(plan_id)
        if not existing_plan:
            raise ValueError("Plan not found")
        
        if existing_plan.user_id != user_id:
            raise ValueError("Not authorized to update this plan")
        
        # Process activities and sessions using shared methods
        self._process_generated_plan_activities(user_id, generated_plan_update)
        new_sessions = self._create_plan_sessions(generated_plan_update)
        
        # Update the existing plan with new data while preserving important fields
        existing_plan.sessions = new_sessions
        existing_plan.emoji = generated_plan_update.emoji or existing_plan.emoji
        existing_plan.duration_type = generated_plan_update.duration_type or existing_plan.duration_type
        existing_plan.notes = generated_plan_update.notes or existing_plan.notes
        existing_plan.finishing_date = generated_plan_update.finishing_date or existing_plan.finishing_date
        existing_plan.outline_type = generated_plan_update.outline_type or existing_plan.outline_type
        existing_plan.times_per_week = generated_plan_update.times_per_week or existing_plan.times_per_week
        
        # Save the updated plan
        self.update_plan(existing_plan)
        
        return existing_plan

    def get_readable_plans_and_sessions(self, user_id: str, past_day_limit: int = None, future_day_limit: int = None) -> str:
        """
        Get readable plans and their sessions for a user within the specified time period.
        
        Args:
            user_id: The ID of the user
            past_day_limit: Number of past days to include sessions from (inclusive)
            future_day_limit: Number of future days to include sessions from (inclusive)
        """
        user = self.users_gateway.get_user_by_id(user_id)
        if not user:
            return "No user found"

        plans = self.get_all_user_active_plans(user)
        if not plans:
            return "No active plans found"

        readable_plans: List[str] = []
        current_date = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)  # Start of today

        for index, plan in enumerate(plans):
            # Filter sessions based on both past and future limits
            filtered_sessions = plan.sessions
            if past_day_limit is not None or future_day_limit is not None:
                filtered_sessions = [
                    session for session in plan.sessions
                    if (
                        (past_day_limit is None or 
                         (current_date - datetime.fromisoformat(session.date).replace(
                             tzinfo=UTC, hour=0, minute=0, second=0, microsecond=0)).days <= past_day_limit)
                        and
                        (future_day_limit is None or 
                         (datetime.fromisoformat(session.date).replace(
                             tzinfo=UTC, hour=0, minute=0, second=0, microsecond=0) - current_date).days <= future_day_limit)
                    )
                ]

            if not filtered_sessions:
                continue

            # Get activities for this plan's sessions
            activity_ids = {session.activity_id for session in filtered_sessions}
            activities = {
                aid: self.activities_gateway.get_activity_by_id(aid)
                for aid in activity_ids
            }

            # Separate past and future sessions
            past_sessions: List[str] = []
            future_sessions: List[str] = []
            
            for session in filtered_sessions:
                activity = activities.get(session.activity_id)
                if not activity:
                    continue

                session_date = datetime.fromisoformat(session.date).replace(tzinfo=UTC)
                formatted_date = session_date.strftime("%A, %b %d")
                session_str = f"  - {formatted_date} - {activity.title} (ID: {activity.id}) ({session.quantity} {activity.measure})"
                
                if session_date <= current_date:
                    past_sessions.append(session_str)
                else:
                    future_sessions.append(session_str)

            if past_sessions or future_sessions:
                plan_text = [f"Plan {index + 1} (with ID '{plan.id}'): Name: '{plan.goal}' (ends {datetime.fromisoformat(plan.finishing_date).strftime('%A, %b %d') if plan.finishing_date else 'no end date'})"]
                
                if past_sessions:
                    plan_text.append(f"Sessions that were scheduled for the last {past_day_limit} days (not this are not done sessions):")
                    plan_text.extend(past_sessions)
                
                if future_sessions:
                    if past_sessions:  # Add a blank line if we had past sessions
                        plan_text.append("")
                    plan_text.append(f"Upcoming sessions in the next {future_day_limit} days:")
                    plan_text.extend(future_sessions)
                
                readable_plans.append("\n".join(plan_text))

        if not readable_plans:
            if past_day_limit and future_day_limit:
                return "No recent or upcoming sessions found in active plans"
            elif past_day_limit:
                return "No recent sessions found in active plans"
            else:
                return "No upcoming sessions found in active plans"
            
        return "\n\n".join(readable_plans)

if __name__ == "__main__":
    from shared.logger import create_logger

    create_logger(level="INFO")
    plan_controller = PlanController()
    print(plan_controller.get_readable_plans("670fb420158ba86def604e67"))
