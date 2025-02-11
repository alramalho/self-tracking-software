from typing import Dict
from datetime import datetime
import pytz
import random
from pydantic import BaseModel, Field
from typing import List, Literal
from loguru import logger

from gateways.activities import ActivitiesGateway
from controllers.plan_controller import PlanController
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from gateways.messages import MessagesGateway
from ai.assistant.flowchart_nodes import Node, NodeType

class PlanCompletionAnalysis(BaseModel):
    plan_name: str = Field(..., description="The name of the plan being analyzed")
    analysis: str = Field(..., description="Analysis of why the plan is/isn't being followed. You must mention the activity count this week, the target activity count, and count of days left until Saturday (included)")

recurrent_checkin_flowchart = {
    "AnalyzePrimaryPlan": Node(
        text="""Analyze the current week on the first plan in the user's plan list. Consider:
        1. Calculate completion rate (completed sessions / total sessions for this week)
        2. Count number of missed sessions for this week
        3. Calculate days left until week ends
        
        Choose:
        - "AllCompleted" if all sessions are done for the week
        - "OnTrack" if most sessions are done and there's time for the rest
        - "NeedsPush" if there are missing sessions but still time to complete
        - "Struggling" if many sessions are missed""",
        output_schema=PlanCompletionAnalysis,
        connections={
            "AllCompleted": "HandleCompletedPlan",
            "OnTrack": "HandleOnTrackPlan",
            "NeedsPush": "HandleNeedsPushPlan",
            "Struggling": "HandleStrugglingPlan"
        }
    ),
    
    "HandleCompletedPlan": Node(
        text="""Generate a congratulatory message for completing all sessions""",
        temperature=1.0
    ),
    
    "HandleOnTrackPlan": Node(
        text="""Generate an encouraging message for being on track. Mention the number of sessions left and the days left still though""",
        temperature=1.0
    ),
    
    "HandleNeedsPushPlan": Node(
        text="""Generate a motivational message about completing remaining sessions.""",
        temperature=1.0
    ),
    
    "HandleStrugglingPlan": Node(
        text="""Generate a supportive message for struggling progress.""",
        temperature=1.0
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
        user = users_gateway.get_user_by_id(user_id)

        system_prompt = f"""You are Jarvis, a friendly assistant communicating in {user.language}. 
Your goal is to send a short, direct message about the user's primary plan progress this week.
Focus on remaining sessions and time left to complete them.
Keep messages concise and actionable.
Keep attentive to your past sent messages, not to repeat the same tone.
Example: \"You're missing just one session of running 5km this week, there's still 3 days until the new week clock starts. You can do it 💪"\""""

        framework = FlowchartLLMFramework(recurrent_checkin_flowchart, system_prompt)

        plans = plan_controller.get_readable_plans(user_id)

        context = {
            "plans": plan_controller.get_readable_plans(user_id)[0] if plans else "User has no plans.",
            "activity_history": activities_gateway.get_readable_recent_activity_entries(user_id),
            "current_time": datetime.now(pytz.UTC).strftime("%b %d, %Y, %A"),
            "sent_messages": [n.message for n in notification_manager.get_last_notifications_sent_to_user(user_id, limit=5)],
            "language": user.language
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
