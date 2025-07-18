from gateways.plan_invitations import PlanInvitationsGateway
from entities.plan import (
    Plan,
    PlanSession,
)
from entities.plan_group import PlanGroupMember
from entities.activity import Activity, ActivityEntry
from entities.plan_invitation import PlanInvitation
from ai.llm import ask_schema, ask_schema_async
from gateways.database.dynamodb import DynamoDBGateway
from typing import List, Optional, Dict, Any, Tuple, Literal
from gateways.plan_groups import PlanGroupsGateway
from pydantic import BaseModel, Field
from shared.utils import count_weeks_between_dates
from gateways.activities import ActivitiesGateway, ActivityAlreadyExistsException
from gateways.users import UsersGateway
from datetime import datetime, timedelta, UTC
from entities.user import User
from gateways.vector_database.pinecone import PineconeVectorDB
from entities.plan import PlanState
from loguru import logger
from bson import ObjectId
from copy import deepcopy
import pytz
from entities.notification import Notification
from services.notification_manager import NotificationManager
from copy import copy
from ai.assistant.coach_notification_generator import (
    generate_notification_message,
    generate_times_per_week_based_week_end_coach_notes,
    generate_session_based_week_end_coach_notes,
)
import traceback
import threading


class PlanMilestoneProgress(BaseModel):
    """Response entity for milestone progress"""

    milestone_id: str
    description: str
    date: str
    progress: float
    is_completed: bool
    criteria_progress: List[Dict[str, Any]]


class NextMilestoneResponse(BaseModel):
    """Response entity for the next milestone endpoint"""

    plan_id: str
    next_milestone: Optional[PlanMilestoneProgress]


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
        self.db_gateway = DynamoDBGateway("plans")
        self.activities_gateway = ActivitiesGateway()
        self.users_gateway = UsersGateway()
        self.plan_invitation_gateway = PlanInvitationsGateway()
        self.plan_groups_gateway = PlanGroupsGateway()
        self.vector_database = PineconeVectorDB(namespace="plans")
        self.notification_manager = NotificationManager()

    def get_all_by_ids(self, ids: List[str]) -> List[Plan]:
        if not ids:
            return []
        data = self.db_gateway.query_by_criteria({"id": {"$in": ids}})
        return [Plan(**d) for d in data]

    def get_readable_plan(self, plan: Plan) -> str:
        # Get unique activities for this plan
        activities = [
            self.activities_gateway.get_activity_by_id(aid) for aid in plan.activity_ids
        ]
        activity_names = [a.title for a in activities if a]

        # Get current week's activity entries
        today = datetime.now(UTC)
        week_start = (today - timedelta(days=today.weekday() + 1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        week_end = week_start + timedelta(days=6)

        # Check if all activities were completed this week
        all_activity_entries_for_plan: List[ActivityEntry] = []
        for activity_id in plan.activity_ids:
            all_activity_entries_for_plan.extend(
                self.activities_gateway.get_all_activity_entries_by_activity_id(
                    activity_id
                )
            )

        number_of_weeks_old = count_weeks_between_dates(
            datetime.fromisoformat(plan.created_at), datetime.now(UTC)
        )

        # Group activity entries by date and count at most 1 per day
        daily_completions = set()
        for entry in all_activity_entries_for_plan:
            entry_date = datetime.fromisoformat(entry.date).replace(tzinfo=UTC)
            if week_start <= entry_date <= week_end:
                daily_completions.add(entry_date.date())

        # Get planned activities count based on outline_type
        if plan.outline_type == "times_per_week":
            planned_count = plan.times_per_week
        else:  # specific
            planned_count = len(
                [
                    session
                    for session in plan.sessions
                    if week_start
                    <= datetime.fromisoformat(session.date).replace(tzinfo=UTC)
                    <= week_end
                ]
            )

        activities_str = "', '".join(activity_names)
        completion_str = f"This week the user had planned {planned_count} activities and completed {len(daily_completions)}"

        return f"'{plan.goal}' is {number_of_weeks_old} weeks old - with activities '{activities_str}'. {completion_str}"

    def get_readable_plans(self, user_id: str) -> str:
        logger.log("CONTROLLERS", f"Getting readable plans for user {user_id}")

        user = self.users_gateway.get_user_by_id(user_id)
        if not user:
            return []

        plans = self.get_all_user_active_plans(user)
        if not plans:
            return []

        return "\n".join(
            [f"{i+1}. {self._get_readable_plan(plan)}" for i, plan in enumerate(plans)]
        )

    def create_plan(self, plan: Plan) -> Plan:
        logger.log("CONTROLLERS", f"Creating plan for user {plan.user_id}: {plan.goal}")
        self.db_gateway.write(plan.dict())
        self.vector_database.upsert_record(
            text=self.get_readable_plan(plan),
            identifier=plan.id,
            metadata={"user_id": plan.user_id},
        )
        return plan

    def _process_generated_plan_activities(
        self, user_id: str, generated_plan_data: GeneratedPlanUpdate
    ) -> List[Activity]:
        """Helper method to process and create activities from generated plan data"""
        new_plan_activities = []
        # Get existing user activities for matching
        user_activities = self.activities_gateway.get_all_activities_by_user_id(user_id)

        for activity in generated_plan_data.activities:
            # Check if activity already exists (matching title and measure)
            existing_activity = next(
                (
                    a
                    for a in user_activities
                    if a.title.lower() == activity.title.lower()
                    and a.measure.lower() == activity.measure.lower()
                ),
                None,
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
        self, generated_plan_data: GeneratedPlanUpdate
    ) -> List[PlanSession]:
        """Helper method to create plan sessions from generated plan data"""
        return [
            PlanSession(**session.dict())
            for session in generated_plan_data.sessions
            if session.activity_id
        ]

    def get_all_user_plans(self, user: User) -> List[Plan]:
        logger.log("CONTROLLERS", f"Getting all plans for user {user.id}")
        plans = []
        for plan_id in user.plan_ids:
            plan = self.get_plan(plan_id)
            if plan is not None:
                plans.append(plan)
        return plans

    def get_all_user_active_plans(self, user: User) -> List[Plan]:
        logger.log("CONTROLLERS", f"Getting all plans for user {user.id}")
        plans = []
        for plan_id in user.plan_ids:
            plan = self.get_plan(plan_id)
            current_date = datetime.now(UTC)
            if (
                plan
                and plan.finishing_date
                and current_date
                > datetime.fromisoformat(plan.finishing_date).replace(tzinfo=UTC)
            ):
                continue
            if plan is not None:
                plans.append(plan)
        return plans

    def get_plan(self, plan_id: str) -> Optional[Plan]:
        logger.log("CONTROLLERS", f"Getting plan: {plan_id}")
        data = self.db_gateway.query("id", plan_id)
        if len(data) > 0:
            return Plan(**data[0])
        else:
            logger.error(f"Plan not found: {plan_id}")
            return None

    def _count_number_of_weeks_till(self, finishing_date: Optional[str] = None) -> int:
        if finishing_date:
            current_date = datetime.now(UTC)
            try:
                finishing_date = datetime.strptime(finishing_date, "%Y-%m-%d").replace(
                    tzinfo=UTC
                )
            except ValueError:
                finishing_date = datetime.fromisoformat(finishing_date)
            return (finishing_date - current_date).days // 7 + 1
        return 0

    def update_plan(self, plan: Plan) -> Plan:
        logger.log("CONTROLLERS", f"Updating plan: {plan.id}")
        self.db_gateway.write(plan.dict())
        self.vector_database.upsert_record(
            text=self.get_readable_plan(plan),
            identifier=plan.id,
            metadata={"user_id": plan.user_id},
        )
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
            if (
                plan.plan_group_id == inviters_plan.plan_group_id
                and plan.id != inviters_plan.id
            ):
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
        activity_entry = self.activities_gateway.get_activity_entry_by_id(
            activity_entry_id
        )
        if not activity_entry:
            return False

        # Get the current week's start and end dates
        activity_entry_date = datetime.fromisoformat(activity_entry.date).replace(
            tzinfo=UTC
        )
        week_start = activity_entry_date - timedelta(days=activity_entry_date.weekday())
        week_end = week_start + timedelta(days=6)

        # Filter sessions for current week and matching activity
        week_sessions = [
            session
            for session in plan.sessions
            if (
                week_start
                <= datetime.fromisoformat(session.date).replace(tzinfo=UTC)
                <= week_end
            )
        ]

        if not week_sessions:
            return False

        # Count required sessions for this week
        required_sessions = len(week_sessions)

        # Get all activity entries for this week
        week_entries = self.activities_gateway.activity_entries_db_gateway.query(
            "activity_id", activity_entry.activity_id
        )
        week_entries = [
            ActivityEntry(**entry)
            for entry in week_entries
            if entry["date"] >= week_start.isoformat()
            and entry["date"] <= week_end.isoformat()
        ]

        # Sort entries by creation time to check if current entry is the last one
        sorted_entries = sorted(week_entries, key=lambda x: x["created_at"])

        # Check if this entry is the last one and completes all required sessions
        return (
            len(sorted_entries) == required_sessions
            and sorted_entries[-1]["id"] == activity_entry_id
        )

    def is_week_finisher_of_any_plan(
        self, activity_entry_id: str
    ) -> Tuple[bool, Optional[str]]:
        # Get the activity entry
        activity_entry = self.activities_gateway.get_activity_entry_by_id(
            activity_entry_id
        )
        if not activity_entry:
            return False, None

        # Get all plans that contain this activity
        user = self.users_gateway.get_user_by_id(activity_entry.user_id)
        plans = self.get_all_user_active_plans(user)
        filtered_plans = []
        for plan in plans:
            # Check if any session in this plan has the activity_entry's activity_id
            for session in plan.sessions:
                if session.activity_id == activity_entry.activity_id:
                    filtered_plans.append(plan)
                    break

        plans = filtered_plans

        for plan in plans:
            if self.is_week_finisher_of_plan(activity_entry_id, plan):
                return True, plan.goal

        return False, None

    def is_activity_in_any_active_plan(self, activity_id: str) -> bool:
        activity = self.activities_gateway.get_activity_by_id(activity_id)
        user = self.users_gateway.get_user_by_id(activity.user_id)
        active_plans = self.get_all_user_active_plans(user)
        filtered_plans = []
        for plan in active_plans:
            # Check if any session in this plan has the activity_entry's activity_id
            for session in plan.sessions:
                if session.activity_id == activity_id:
                    filtered_plans.append(plan)
                    break

        active_plans = filtered_plans

        return len(active_plans) > 0

    def get_readable_plans_and_sessions(
        self,
        user_id: str,
        past_day_limit: int = None,
        future_day_limit: int = None,
        plans: List[Plan] = None,
    ) -> str:
        """
        Get readable plans and their sessions for a user within the specified time period.
        Handles both specific schedule plans and times-per-week plans.

        Args:
            user_id: The ID of the user
            past_day_limit: Number of past days to include sessions from (inclusive)
            future_day_limit: Number of future days to include sessions from (inclusive)
        """
        user = self.users_gateway.get_user_by_id(user_id)
        if not user:
            return "No user found"

        if plans is None:
            plans = self.get_all_user_active_plans(user)

        if not plans:
            return "No active plans found"

        readable_plans: List[str] = []
        for index, plan in enumerate(plans):
            plan_header = f"Plan {index + 1} (with ID '{plan.id}'): Name: '{plan.goal}' (ends {datetime.fromisoformat(plan.finishing_date).strftime('%A, %b %d') if plan.finishing_date else 'no end date'})"

            if plan.outline_type == "specific":
                plan_text = self._get_readable_specific_plan(
                    plan, past_day_limit, future_day_limit
                )
            else:  # times_per_week type
                plan_text = self._get_readable_times_per_week_plan(
                    plan, past_day_limit, future_day_limit
                )

            readable_plans.append(f"{plan_header}\n{plan_text}")

        if not readable_plans:
            if past_day_limit and future_day_limit:
                return "No recent or upcoming sessions found in active plans"
            elif past_day_limit:
                return "No recent sessions found in active plans"
            else:
                return "No upcoming sessions found in active plans"

        return "\n\n".join(readable_plans)

    def _get_readable_specific_plan(
        self, plan: Plan, past_day_limit: Optional[int], future_day_limit: Optional[int]
    ) -> str:
        """Helper method to format specific schedule plans"""
        current_date = datetime.now(UTC).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # Filter sessions based on time limits
        filtered_sessions = [
            session
            for session in plan.sessions
            if (
                past_day_limit is None
                or (
                    current_date
                    - datetime.fromisoformat(session.date).replace(
                        tzinfo=UTC, hour=0, minute=0, second=0, microsecond=0
                    )
                ).days
                <= past_day_limit
            )
            and (
                future_day_limit is None
                or (
                    datetime.fromisoformat(session.date).replace(
                        tzinfo=UTC, hour=0, minute=0, second=0, microsecond=0
                    )
                    - current_date
                ).days
                <= future_day_limit
            )
        ]

        # Get activities for sessions
        activity_ids = {session.activity_id for session in filtered_sessions}
        activities = {
            aid: self.activities_gateway.get_activity_by_id(aid) for aid in activity_ids
        }

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

        plan_text = []
        if past_sessions:
            plan_text.append(
                f"Sessions that were scheduled for the last {past_day_limit} days (not this are not done sessions):"
            )
            if len(past_sessions) > 0:
                plan_text.extend(past_sessions)
            else:
                plan_text.append("No past sessions found")

        if future_sessions:
            if past_sessions:
                plan_text.append("")
            plan_text.append(f"Upcoming sessions in the next {future_day_limit} days:")

            if len(future_sessions) > 0:
                plan_text.extend(future_sessions)
            else:
                plan_text.append("No future sessions found")

        return "\n".join(plan_text)

    def _get_readable_times_per_week_plan(
        self, plan: Plan, past_day_limit: Optional[int], future_day_limit: Optional[int]
    ) -> str:
        """Helper method to format times-per-week plans"""
        current_date = datetime.now(UTC).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        # Get unique activities from sessions
        activity_ids = {session.activity_id for session in plan.sessions}
        activities = {
            aid: self.activities_gateway.get_activity_by_id(aid) for aid in activity_ids
        }

        # Format activities list
        activity_list = []
        for activity in activities.values():
            if activity:
                activity_list.append(f"  - {activity.title} (ID: {activity.id})")

        plan_text = []
        plan_text.append(
            f"This is a flexible plan targeting {plan.times_per_week} sessions per week."
        )
        plan_text.append("Available activities:")
        if len(activity_list) > 0:
            plan_text.extend(activity_list)
        else:
            plan_text.append("No activities found")

        # Add past week completion info if requested
        if past_day_limit:
            week_start = current_date - timedelta(days=current_date.weekday())
            completed_sessions = sum(
                1
                for session in plan.sessions
                if datetime.fromisoformat(session.date).replace(tzinfo=UTC)
                >= week_start
                and datetime.fromisoformat(session.date).replace(tzinfo=UTC)
                <= current_date
            )
            plan_text.append(
                f"\nThis week's progress: {completed_sessions}/{plan.times_per_week} sessions completed"
            )

        return "\n".join(plan_text)

    def to_sessions_str(
        self, session: PlanSession, plan_activities: Optional[List[Activity]]
    ) -> str:
        if not plan_activities:
            plan = self.get_plan(session.plan_id)
            plan_activities = self.activities_gateway.get_all_activites_by_ids(
                plan.activity_ids
            )

        activities = [a for a in plan_activities if a.id == session.activity_id]
        if len(activities) == 0:
            logger.error("Session belong to no plan activity! Skipping")
            return None

        activity = activities[0]
        readable_date = datetime.strptime(session.date, "%Y-%m-%d").strftime(
            "%b %d %Y, %A"
        )

        return f"–{activity.title} ({session.quantity} {activity.measure}) in {readable_date}"

    async def generate_sessions(
        self,
        goal: str,
        finishing_date: Optional[str] = None,
        activities: List[Activity] = None,
        edit_description: Optional[str] = None,
        existing_plan: Optional[Plan] = None,
    ) -> List[PlanSession]:
        logger.log("CONTROLLERS", f"Generating sessions for goal: {goal}")
        current_date = datetime.now().strftime("%Y-%m-%d, %A")
        if not finishing_date:
            finishing_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")

        number_of_weeks = self._count_number_of_weeks_till(finishing_date)

        if existing_plan and existing_plan:
            plan_activities = self.activities_gateway.get_all_activites_by_ids(
                existing_plan.activity_ids
            )
            sessions = []
            for s in existing_plan.sessions[:10]:  # first 10 not to overwhelm prompt
                session_str = self.to_sessions_str(s, plan_activities)
                if session_str:
                    sessions.append(session_str)

            introduction = (
                f"You are a plan coach assistant. You are coaching with the plan '{goal}'"
                f"Your task is to generate an adapted plan based on this edit description: \n-{edit_description}\n"
                f"Here are the CURRENT plan nex 10 sessions for reference. \n{"\n".join(sessions)}"
                f"You must use this information thoughtfully as the basis for your plan generation. In regards to that:"
                f"The plan has the finishing date of {finishing_date} and today is {current_date}."
                f"Additional requirements:"
            )
        else:
            introduction = (
                f"You will act as a personal coach for the goal of {goal}.\n"
                f"The plan has the finishing date of {finishing_date} and today is {current_date}."
            )

        system_prompt = f"""
        {introduction}
        No date should be before today ({current_date}).
        You must develop a progressive plan over the course of {number_of_weeks} weeks.
        Keep the activities to a minimum.
        The plan should be progressive (intensities or recurrence of activities should increase over time).
        The plan should take into account the finishing date and adjust the intensity and/or recurrence of the activities accordingly.
        It is an absolute requirement that all present sessions activity names are contained in the list of activities.

        Please only include these activities in plan:
        {"\n - ".join([str(a) for a in activities])}
        """

        user_prompt = f"Please generate me a plan to achieve the goal of {goal} by {finishing_date}."

        if edit_description:
            user_prompt += f"\nAdditional description: {edit_description}"

        class GeneratedSession(BaseModel):
            date: str
            activity_name: str = Field(
                description="The name of the activity to be performed. Should have no emoji to match exactly with the activity title."
            )
            quantity: int = Field(
                description="The quantity of the activity to be performed. Directly related to the activity and should be measured in the same way."
            )
            descriptive_guide: str

        class GeneratedSessionWeek(BaseModel):
            week_number: int
            reasoning: str = Field(
                ...,
                description="A step by step thinking outlining the week's outlook given current and leftover progess. Must be deep and reflective.",
            )
            sessions: List[GeneratedSession] = Field(
                ...,
                description="List of sessions for this week.",
            )

        class GenerateSessionsResponse(BaseModel):
            reasoning: str = Field(
                ...,
                description="A reflection on what is the goal and how does that affect the sessions progression.",
            )
            weeks: List[GeneratedSessionWeek] = Field(
                ...,
                description="List of weeks with their sessions.",
            )

        try:
            response = await ask_schema_async(
                text=user_prompt,
                system=system_prompt,
                pymodel=GenerateSessionsResponse,
            )
        except Exception as e:
            logger.error(f"Error generating sessions: {e}")
            logger.error(traceback.format_exc())
            raise e

        # Convert generated sessions to PlanSession objects
        sessions = []
        for week in response.weeks:
            logger.info(f"Week {week.week_number}. Has {len(week.sessions)} sessions.")
            for session in week.sessions:
                # Find matching activity
                activity = next(
                    (
                        a
                        for a in activities
                        if a.title.lower() == session.activity_name.lower()
                    ),
                    None,
                )

                if activity:
                    sessions.append(
                        PlanSession(
                            date=session.date,
                            activity_id=activity.id,
                            descriptive_guide=session.descriptive_guide,
                            quantity=session.quantity,
                        )
                    )

        return sessions

    def get_plan_week_stats(self, plan: Plan, user: User) -> Tuple[int, int, int]:

        current_date = datetime.now(pytz.timezone(user.timezone))

        # Get start of the week (Sunday)
        days_since_sunday = (current_date.weekday() + 1) % 7
        week_start = (current_date - timedelta(days=days_since_sunday)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        week_end = week_start + timedelta(
            days=6, hours=23, minutes=59, seconds=59
        )  # sunday 00 is already new week

        num_left_days_in_the_week = max(
            0, (week_end - current_date).days + 1
        )  # include today

        num_activities_this_week = 0
        for activity_id in plan.activity_ids:
            activity_entries = (
                self.activities_gateway.get_all_activity_entries_by_activity_id(
                    activity_id
                )
            )

            # Count entries from this week (only count max 1 per day to avoid double counting)
            daily_completions = set()
            for entry in activity_entries:
                entry_date = datetime.fromisoformat(entry.date).replace(tzinfo=UTC)
                if week_start <= entry_date <= week_end:
                    daily_completions.add(entry_date.date())

            num_activities_this_week += len(daily_completions)

        # Calculate planned activities for this week
        if plan.outline_type == "times_per_week":
            num_planned_activities_this_week = plan.times_per_week or 0
        else:  # specific schedule
            num_planned_activities_this_week = len(
                [
                    session
                    for session in plan.sessions
                    if week_start
                    <= datetime.fromisoformat(session.date).replace(tzinfo=UTC)
                    <= week_end
                ]
            )

        num_activities_left = max(
            0, num_planned_activities_this_week - num_activities_this_week
        )

        return (
            num_planned_activities_this_week,
            num_left_days_in_the_week,
            num_activities_left,
        )

    def process_state_transition(self, plan: Plan, user: User, new_state: PlanState):
        activities = self.activities_gateway.get_all_activites_by_ids(
            plan.activity_ids
        )
        if new_state == "FAILED":
            if plan.outline_type == "times_per_week":
                plan.coach_suggested_times_per_week = max(1, plan.times_per_week - 1)
                plan.suggested_by_coach_at = datetime.now(UTC).isoformat()

                plan.coach_notes = generate_times_per_week_based_week_end_coach_notes(
                    plan, new_state, activities
                )
                plan.suggested_by_coach_at = datetime.now(UTC).isoformat()

            if plan.outline_type == "specific":
                old_sessions = copy(plan.sessions)
                plan.suggested_sessions = self.generate_sessions(
                    goal=plan.goal,
                    finishing_date=plan.finishing_date,
                    activities=activities,
                    existing_plan=plan,
                    edit_description=(
                        f"The user has failed the current plan's week."
                        "Please adapt so it is downgraded 1 level of difficulty."
                        "The update should be minimal"
                    ),
                )
                plan.coach_notes = generate_session_based_week_end_coach_notes(
                    plan, new_state, activities, old_sessions, plan.suggested_sessions
                )
                plan.suggested_by_coach_at = datetime.now(UTC).isoformat()


        elif new_state == "COMPLETED":

            if plan.outline_type == "times_per_week":
                plan.coach_notes = generate_times_per_week_based_week_end_coach_notes(
                    plan, new_state, activities
                )
                plan.suggested_by_coach_at = datetime.now(UTC).isoformat()

            if plan.outline_type == "specific":

                old_sessions = copy(plan.sessions)
                new_sessions = self.generate_sessions(
                    goal=plan.goal,
                    finishing_date=plan.finishing_date,
                    activities=activities,
                    existing_plan=plan,
                    edit_description=(
                        f"The user has completed the the current plan's week."
                        "Consider if there are changes necessary to achieve the goal"
                        "You may leave the plan as is"
                    ),
                )

                # Keep old sessions up to and including today, use new sessions from tomorrow onwards
                today = datetime.now(UTC).date()
                past_sessions = [
                    s
                    for s in old_sessions
                    if datetime.fromisoformat(s.date).date() <= today
                ]
                future_sessions = [
                    s
                    for s in new_sessions
                    if datetime.fromisoformat(s.date).date() > today
                ]
                plan.sessions = past_sessions + future_sessions

                plan.coach_notes = generate_times_per_week_based_week_end_coach_notes(
                    plan, new_state, activities, old_sessions, plan.sessions
                )
                plan.suggested_by_coach_at = datetime.now(UTC).isoformat()

                self.update_plan(plan)
            
            
        self.update_plan(plan)
    def recalculate_current_week_state(self, plan: Plan, user: User) -> Plan:

        (
            num_planned_activities_this_week,
            num_left_days_in_the_week,
            num_activities_left,
        ) = self.get_plan_week_stats(plan, user)

        # Determine the state based on completion vs planned activities
        if num_activities_left <= 0:
            new_state = "COMPLETED"
        else:
            margin = num_left_days_in_the_week - num_activities_left
            max_margin = max(0, 7 - num_planned_activities_this_week)

            if margin <= max_margin and margin >= 0:
                if margin >= 2 or margin == max_margin:
                    new_state = "ON_TRACK"
                else:
                    new_state = "AT_RISK"
            elif margin < 0:
                new_state = "FAILED"
            else:
                error_msg = f"Unexpected margin calculation: {margin}"
                logger.error(error_msg)
                raise ValueError(error_msg)

        # Update the plan's current week state
        old_state = copy(plan.current_week.state)
        plan.current_week.state = new_state
        current_date = datetime.now(pytz.timezone(user.timezone))
        plan.current_week.state_last_calculated_at = current_date.isoformat()

        if old_state != new_state:
            # Run state transition processing in a separate thread to avoid blocking
            thread = threading.Thread(
                target=self.process_state_transition,
                args=(plan, user, new_state),
                daemon=False,
            )
            thread.start()

        # Save the updated plan
        self.update_plan(plan)

        logger.info(
            f"Updated plan {plan.id} current week state from {old_state} to {new_state}"
        )
        return plan

    async def process_plan_state_recalculation(
        self, user: User, user_coached_plan: Plan, push_notify: bool = False
    ) -> Optional[Notification]:

        if len(user.plan_ids) == 0:
            logger.info(f"User {user.username} has no plans - skipping recalculation")
            return None

        if user.plan_type == "free":
            logger.info(f"Skipping user {user.username} because they are on free plan")
            return None

        all_users_activity_entries = (
            self.activities_gateway.get_all_activity_entries_by_user_id(user.id)
        )
        activities_in_last_week = [
            activity
            for activity in all_users_activity_entries
            if datetime.fromisoformat(activity.date).replace(tzinfo=UTC)
            > (datetime.now(UTC) - timedelta(days=7))
        ]

        if len(activities_in_last_week) == 0:
            logger.info(
                f"No activities in last week for user {user.username} - skipping recalculation"
            )
            return None

        old_plan_state = copy(user_coached_plan.current_week.state)

        user_coached_plan = self.recalculate_current_week_state(user_coached_plan, user)

        if user_coached_plan.current_week.state == old_plan_state:
            logger.info(
                f"No state transition needed (stayed at {old_plan_state}) for plan '{user_coached_plan.goal}' of user '{user.username}' - skipping notification"
            )
            return None

        message = generate_notification_message(user, user_coached_plan)

        notification = await self.notification_manager.create_and_process_notification(
            Notification.new(
                user_id=user.id,
                message=message,
                type="coach",
                related_data={
                    "picture": "https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png",
                },  
            ),
            push_notify=push_notify,
        )

        logger.info(
            f"Plan state recalculation successful for plan '{user_coached_plan.goal}' of user '{user.username}'"
        )
        return notification

    async def process_plan_coaching(
            self, user: User, user_coached_plan: Plan, push_notify: bool = False
        ) -> Optional[Notification]:
        notification = await self.process_plan_state_recalculation(user, user_coached_plan, push_notify)

        if notification:
            return notification

        latest_coach_notification = self.notification_manager.get_latest_notification_sent_to_user(user.id, "coach")

        if latest_coach_notification and datetime.fromisoformat(latest_coach_notification.sent_at) < datetime.now(UTC) - timedelta(hours=40):
            notification = await self.process_plan_state_recalculation(user, user_coached_plan, push_notify)
            return notification

        message = generate_notification_message(user, user_coached_plan)
        notification = await self.notification_manager.create_and_process_notification(
            Notification.new(
                user_id=user.id,
                message=message,
                type="coach",
                related_data={
                    "picture": "https://alramalhosandbox.s3.eu-west-1.amazonaws.com/tracking_software/jarvis_logo_transparent.png",
                },
            ),
            push_notify=push_notify,
        )
        return notification

if __name__ == "__main__":
    from shared.logger import create_logger
    from gateways.users import UsersGateway

    create_logger(level="INFO")
    plan_controller = PlanController()
    user_gateway = UsersGateway()
    user = user_gateway.get_user_by_id("670fb420158ba86def604e67")
    plan = plan_controller.get_plan(user.plan_ids[0])
    num_planned_activities_this_week, num_left_days_in_the_week, num_activities_left = plan_controller.get_plan_week_stats(plan, user)
    print(f"Num planned activities this week: {num_planned_activities_this_week}")
    print(f"Num left days in the week: {num_left_days_in_the_week}")
    print(f"Num activities left: {num_activities_left}")
