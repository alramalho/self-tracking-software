from typing import Dict
from datetime import datetime, timedelta
import pytz
import random
from pydantic import BaseModel, Field
from typing import List, Literal
from loguru import logger

from gateways.activities import ActivitiesGateway
from controllers.plan_controller import PlanController
from controllers.milestones_controller import MilestonesController
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from gateways.messages import MessagesGateway
from ai.assistant.flowchart_nodes import Node, NodeType

class NotificationAnalysis(BaseModel):
    has_recent_milestone_notification: bool = Field(..., description="Whether there was a milestone notification in the last 3 days")

recurrent_checkin_flowchart = {
    "CheckRecentNotifications": Node(
        text="""Analyze the recent notifications sent to the user in the last 3 days.
        Look for any notifications that mention the milestones or lack thereof.
        
        Choose:
        - "HasRecentMilestone" if there was a milestone mentioning notification in the last 3 days
        - "NoRecentMilestone" if there were no milestone notifications""",
        output_schema=NotificationAnalysis,
        connections={
            "HasRecentMilestone": "AnalyzeWeeklyProgress",
            "NoRecentMilestone": "HandleMilestoneUpdate"
        }
    ),

    "HandleMilestoneUpdate": Node(
        text="""Generate a message about the next milestone progress.
        Use the milestone_update from the context to craft a personalized message about their progress towards the next milestone.""",
        temperature=1.0
    ),

    "AnalyzeWeeklyProgress": Node(
        text="""Analyze in your reasoning the current week on the first plan in the user's plan list. Consider:
        1. Calculate completion rate (completed sessions / total sessions for this week)
        2. Count number of missed sessions for this week
        3. Calculate days left until week ends
        
        Then, depending on that, you should generate a coach like message to be sent to the user.""",
    )
}

class RecurrentMessageGenerator:
    async def generate_message(self, user_id: str, message_type: str) -> str:
        if message_type == "user-recurrent-checkin":
            return await self._generate_recurrent_checkin_message(user_id)
        else:
            raise ValueError(f"Message type {message_type} not found")

    async def _generate_recurrent_checkin_message(self, user_id: str) -> str:
        from services.notification_manager import NotificationManager
        from gateways.users import UsersGateway

        plan_controller = PlanController()
        activities_gateway = ActivitiesGateway()
        users_gateway = UsersGateway()
        notification_manager = NotificationManager()
        milestones_controller = MilestonesController()
        user = users_gateway.get_user_by_id(user_id)

        system_prompt = f"""You are Jarvis, a friendly assistant communicating in {user.language}. 
Your goal is to send a short, direct message about either the user's milestone progress or their weekly plan progress.
Focus on being encouraging and actionable.
Keep messages concise and actionable
Keep attentive to your past sent messages, not to repeat the same tone.
Example: \"You're missing just one session of running 5km this week, there's still 3 days until the new week clock starts. You can do it 💪"\""""

        framework = FlowchartLLMFramework(recurrent_checkin_flowchart, system_prompt)
        user = users_gateway.get_user_by_id(user_id)
        plans = plan_controller.get_all_user_active_plans(user)
        first_plan = plans[0] if plans else None
        first_readable_plan = plan_controller.get_readable_plan(first_plan) if first_plan else None
        milestone_update = milestones_controller.get_readable_next_milestone(first_plan) if first_plan else None

        # Get all activities and filter for plan if exists
        all_activity_entries = activities_gateway.get_all_activity_entries_by_user_id(user_id)
        filtered_activity_entries = [a for a in all_activity_entries if a.activity_id in first_plan.activity_ids]

        readable_activities = [activities_gateway.get_readable_activity_entry(activity_entry) for activity_entry in filtered_activity_entries]

        context = {
            "plans": first_readable_plan if first_readable_plan else "User has no plans.",
            "activity_history": readable_activities,
            "current_time": datetime.now(pytz.UTC).strftime("%b %d, %Y, %A"),
            "sent_messages": [n.message for n in notification_manager.get_last_notifications_sent_to_user(user_id, limit=5)],
            "language": user.language,
            "milestone_update": milestone_update
        }

        try:
            message, extracted = await framework.run(context)
            
            if isinstance(message, str):
                return message.strip()
            elif hasattr(message, 'message'):
                return message.message.strip()
            else:
                logger.error(f"Unexpected message format: {message}")
                
        except Exception as e:
            logger.error(f"Error generating message: {e}")
