from typing import Dict
from datetime import datetime, timedelta
import pytz
import random
from pydantic import BaseModel, Field
from typing import List, Literal
from loguru import logger

from gateways.activities import ActivitiesGateway
from gateways.metrics import MetricsGateway
from controllers.plan_controller import PlanController
from controllers.milestones_controller import MilestonesController
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from gateways.messages import MessagesGateway
from ai.assistant.flowchart_nodes import Node, NodeType
from services.notification_manager import NotificationManager
from gateways.users import UsersGateway

class NotificationAnalysis(BaseModel):
    has_recent_milestone_notification: bool = Field(..., description="Whether there was a milestone notification in the last 3 days")

class MetricsAnalysis(BaseModel):
    has_recent_metrics: bool = Field(..., description="Whether there were any metrics logged in the last 2 days")
    last_metric_has_description: bool = Field(..., description="Whether the most recent metric has a description")

class MetricsMessageAnalysis(BaseModel):
    has_recent_metrics_message: bool = Field(..., description="Whether there was a metrics-related message in the last 3 days")

recurrent_checkin_flowchart = {
    "CheckRecentNotifications": Node(
        text="""Analyze the recent notifications sent to the user in the last 3 days.
        Look for any notifications that contain the word 'milestones,' regardless of context.
                
        Choose:
        - "MessagesMentionMilestone" if any notification in the last 3 days contains the word 'milestones' in any form.
        - "MessagesDoNotMentionMilestone" only if no notification in the last 3 days contains the word 'milestones' at all.""",
        output_schema=NotificationAnalysis,
        connections={
            "MessagesMentionMilestone": "CheckRecentMetrics",
            "MessagesDoNotMentionMilestone": "HandleMilestoneUpdate"
        }
    ),

    "HandleMilestoneUpdate": Node(
        text="""Generate a message about the next milestone progress.
        Use the milestone_update from the context to craft a personalized message about their progress towards the next milestone.""",
    ),

    "CheckRecentMetrics": Node(
        text="""Analyze the metrics data from the context.
        Check if there are any metrics **entries** logged in the last 2 days and if the most recent one has a description.
        
        Output both whether there are recent metrics and whether the last one has a description.""",
        output_schema=MetricsAnalysis,
        connections={
            "NoRecentMetricEntries": "AskForMetricsEntries",
            "RecentMetricEntriesWithNoDescription": "CheckRecentMetricsMessages",
            "RecentMetricEntriesWithDescription": "AnalyzeWeeklyProgress"
        }
    ),

    "CheckRecentMetricsMessages": Node(
        text="""Analyze the recent notifications sent to the user in the last 3 days.
        Look for any notifications that contain words related to 'metrics', 'rating', or 'description'.
        
        Choose:
        - "MessagesMentionMetrics" if any notification in the last 3 days contains metrics-related words.
        - "MessagesDoNotMentionMetrics" if no notification mentions metrics.""",
        output_schema=MetricsMessageAnalysis,
        connections={
            "MessagesMentionMetrics": "AnalyzeWeeklyProgress",
            "MessagesDoNotMentionMetrics": "AskForMetricEntryDescription"
        }
    ),

    "AskForMetricsEntries": Node(
        text="""Generate a message telling the user that you've noticed he hasn't logged any metrics lately.
        Explain that metrics are important to understand what's working for them in a data-driven way. Some possible (does not mean the user has them) metrics are happiness, energy, or productivity.
        Keep the message encouraging and highlight the benefits of tracking metrics.""",
        temperature=1.0
    ),

    "AskForMetricEntryDescription": Node(
        text="""Generate a message asking the user to provide more context about their recent metric ratings.
        Ask them to explain why they rated the way they did, as this helps understand their progress better.""",
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

    def __init__(self):
        self.framework = None
        self.plan_controller = PlanController()
        self.activities_gateway = ActivitiesGateway()
        self.users_gateway = UsersGateway()
        self.notification_manager = NotificationManager()
        self.milestones_controller = MilestonesController()
        self.metrics_gateway = MetricsGateway()


    async def generate_message(self, user_id: str, message_type: str) -> str:
        if message_type == "user-recurrent-checkin":
            return await self._generate_recurrent_checkin_message(user_id)
        else:
            raise ValueError(f"Message type {message_type} not found")

    async def _generate_recurrent_checkin_message(self, user_id: str) -> str:
        user = self.users_gateway.get_user_by_id(user_id)
        system_prompt = f"""You are Jarvis, a friendly assistant communicating in {user.language}. 
Your goal is to send a short, direct message about either the user's milestone progress or their weekly plan progress.
Focus on being encouraging and actionable.
Keep messages concise and actionable.
Keep attentive to your past sent messages, not to repeat the same tone.
Example: \"You're missing just one session of running 5km this week, there's still 3 days until the new week clock starts. You can do it 💪"\""""

        self.framework = FlowchartLLMFramework(recurrent_checkin_flowchart, system_prompt)
        user = self.users_gateway.get_user_by_id(user_id)
        plans = self.plan_controller.get_all_user_active_plans(user)
        first_plan = plans[0] if plans else None
        first_readable_plan = self.plan_controller.get_readable_plan(first_plan) if first_plan else None
        milestone_update = self.milestones_controller.get_readable_next_milestone(first_plan) if first_plan else None

        # Get all activities and filter for plan if exists
        all_activity_entries = self.activities_gateway.get_all_activity_entries_by_user_id(user_id)
        filtered_activity_entries = [a for a in all_activity_entries if a.activity_id in first_plan.activity_ids]

        readable_activities = [self.activities_gateway.get_readable_activity_entry(activity_entry) for activity_entry in filtered_activity_entries]

        # Get metrics data for the last 2 days
        metrics_data = self.metrics_gateway.get_readable_metrics_and_entries(user_id, lookback_days=2)

        context = {
            "plans": first_readable_plan if first_readable_plan else "User has no plans.",
            "activity_history": readable_activities,
            "current_time": datetime.now(pytz.UTC).strftime("%b %d, %Y, %A"),
            "sent_notification_messages_to_user": [n.message for n in self.notification_manager.get_last_notifications_sent_to_user(user_id, limit=5)],
            "language": user.language,
            "milestone_update": milestone_update,
            "metrics_data": metrics_data
        }

        try:
            message, extracted = await self.framework.run(context)
            
            if isinstance(message, str):
                return message.strip()
            elif hasattr(message, 'message'):
                return message.message.strip()
            else:
                logger.error(f"Unexpected message format: {message}")
                
        except Exception as e:
            logger.error(f"Error generating message: {e}")
