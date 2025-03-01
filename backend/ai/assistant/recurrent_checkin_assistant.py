from typing import Dict
import traceback
from datetime import datetime, timedelta
import pytz
from pydantic import BaseModel, Field
from entities.message import Message
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
from gateways.database.mongodb import MongoDBGateway
from entities.user import User
from ai.assistant.memory import DatabaseMemory

weekday_checkin_flowchart = {
    "CheckUserResponsiveness": Node(
        text="""Analyze the conversation history from the context.
        Check if there are any user replies in the last 3 days.
        
        Output whether the user is ignoring (no replies in >3 days) or not.""",
        connections={
            "UserIsIgnoring": "SendIgnoringMessage",
            "UserIsResponding": "AskAboutWeek"
        }
    ),

    "SendIgnoringMessage": Node(
        text="""Generate a message about the user ignoring the AI. 
        Examples:
        - "did you put me on silent mode? lol"
        - "Are you ghosting me? lol"
        - "I'm an AI and me too get ghosted, jeez"
        - "well i feel ignored"

        Keep it short, and humorous, no emojis.""",
        temperature=1.0
    ),

    "AskAboutWeek": Node(
        text="""Generate a friendly message asking how their week is going.
        Be creative and use different variations to keep the conversation fresh.
        Examples:
        - "How's the week going?"
        - "How are you doing this week?"
        - "How's your plan <plan_example> going this week?"
        Keep it casual and friendly""",
        temperature=1.0
    )
}

class NotificationAnalysis(BaseModel):
    has_recent_milestone_notification: bool = Field(..., description="Whether there was a milestone notification in the last 3 days")

class MetricsAnalysis(BaseModel):
    has_recent_metrics: bool = Field(..., description="Whether there were any metrics logged in the last 2 days")
    last_metric_has_description: bool = Field(..., description="Whether the most recent metric has a description")

class MetricsMessageAnalysis(BaseModel):
    has_recent_metrics_message: bool = Field(..., description="Whether there was a metrics-related message in the last 3 days")

class UserResponseAnalysis(BaseModel):
    user_is_ignoring: bool = Field(..., description="Whether the user hasn't replied to messages in more than 3 days")

weekend_checkin_flowchart = {
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

class RecurrentCheckinAssistant:
    def __init__(self, user: User):
        self.user = user
        self.memory = DatabaseMemory(MongoDBGateway("messages"), user.id)
        self.plan_controller = PlanController()
        self.activities_gateway = ActivitiesGateway()
        self.users_gateway = UsersGateway()
        self.notification_manager = NotificationManager()
        self.milestones_controller = MilestonesController()
        self.metrics_gateway = MetricsGateway()


    async def generate_message(self) -> str:

        user_tz = pytz.timezone(self.user.timezone) if self.user.timezone else pytz.UTC
        user_local_time = datetime.now(pytz.UTC).astimezone(user_tz)

        plans = self.plan_controller.get_all_user_active_plans(self.user)
        first_plan = plans[0] if plans else None

        system_prompt = f"""You are Jarvis, the user activity coach {first_plan.goal if f"helping in his plan to '{first_plan.goal}'" else ""}. 
        Your goal is to send a very concise message to the user to re-engage him.
        Keep attentive to your past sent messages so you DO NOT to repeat youself.
        Today is {datetime.now(pytz.UTC).strftime("%A, %b %d, %Y")}.
        """

        if user_local_time.weekday() < 5:
            framework = FlowchartLLMFramework(weekday_checkin_flowchart, system_prompt)
        else:
            framework = FlowchartLLMFramework(weekend_checkin_flowchart, system_prompt)


        first_readable_plan = self.plan_controller.get_readable_plan(first_plan) if first_plan else None
        milestone_update = self.milestones_controller.get_readable_next_milestone(first_plan) if first_plan else None

        # Get all activities and filter for plan if exists
        all_activity_entries = self.activities_gateway.get_all_activity_entries_by_user_id(self.user.id)
        filtered_activity_entries = [a for a in all_activity_entries if a.activity_id in first_plan.activity_ids] if first_plan else []

        readable_activities = [self.activities_gateway.get_readable_activity_entry(activity_entry) for activity_entry in filtered_activity_entries]

        # Get metrics data for the last 2 days
        metrics_data = self.metrics_gateway.get_readable_metrics_and_entries(self.user.id, lookback_days=2)

        context = {
            "plans": first_readable_plan if first_readable_plan else "User has no plans.",
            "conversation_history": self.memory.read_all_as_str(max_age_in_minutes=60*24*5),
            "activity_history": readable_activities,
            "current_time": datetime.now(pytz.UTC).strftime("%b %d, %Y, %A"),
            "language": self.user.language,
            "milestone_update": milestone_update,
            "metrics_data": metrics_data
        }

        try:
            message, extracted = await framework.run(context)

            self.memory.write(
                Message.new(
                    text=message,
                    sender_name="Jarvis",
                    sender_id="0",
                    recipient_name=self.user.name,
                    recipient_id=self.user.id,
                )
            )
            
            if isinstance(message, str):
                return message.strip()
            elif hasattr(message, 'message'):
                return message.message.strip()
            else:
                logger.error(f"Unexpected message format: {message}")
                return None
                
        except Exception as e:
            logger.error(traceback.format_exc())
            logger.error(f"Error generating message: {e}")
            return None 