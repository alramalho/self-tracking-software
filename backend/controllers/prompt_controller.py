from typing import Dict
from datetime import datetime
import pytz
import random
from pydantic import BaseModel, Field
from typing import List, Literal
from loguru import logger

from gateways.activities import ActivitiesGateway
from controllers.plan_controller import PlanController
from gateways.metrics import MetricsGateway
from ai.assistant.flowchart_framework import FlowchartLLMFramework
from ai.assistant.flowchart_nodes import Node, LoopStartNode, LoopContinueNode, NodeType

class MessageResponseCheck(BaseModel):
    last_message_timestamp: str = Field(..., description="The timestamp of the last message")
    days_since_response: int = Field(..., description="Days since last response")

class PlanCompletionAnalysis(BaseModel):
    plan_name: str = Field(..., description="The name of the plan being analyzed")
    completion_rate: float = Field(..., description="The rate of completion for this plan")
    missed_sessions: int = Field(..., description="Number of missed sessions")
    analysis: str = Field(..., description="Analysis of why the plan is/isn't being followed")

class MetricAnalysis(BaseModel):
    metric_name: str = Field(..., description="The name of the metric being analyzed")
    last_logged: str = Field(..., description="When was this metric last logged (YYYY-MM-DD)")
    analysis: str = Field(..., description="Analysis of the metric's usage pattern")

class AllPlanNamesSchema(BaseModel):
    plan_names: List[str] = Field(..., description="All plan names")

class AllMetricNamesSchema(BaseModel):
    metric_names: List[str] = Field(..., description="All metric names")


recurrent_checkin_flowchart = {
    "InitialCheck": Node(
        text="""Check if we have sent messages to the user in the last 24 hours that were ignored.
        Consider:
        1. Look at the notification history
        2. Check if there are messages without user response
        3. Calculate days since last response
        
        Choose:
        - "Ignored" if we sent messages in last 24h and user hasn't responded
        - "Active" if user has responded to recent messages
        - "NoRecentMessages" if we haven't sent any messages in last 24h""",
        output_schema=MessageResponseCheck,
        connections={
            "Ignored": "GenerateReengagementMessage",
            "Active": "ExtractPlanNames",
            "NoRecentMessages": "ExtractPlanNames"
        }
    ),
    
    "GenerateReengagementMessage": Node(
        text="""Generate a friendly re-engagement message. Consider:
        1. Reference their last logged activity or interaction
        2. Keep it light and casual
        3. Show interest in their well-being
        4. Avoid making them feel guilty about not responding""",
        temperature=1.0
    ),
    
    "ExtractPlanNames": Node(
        text="""Extract all plan names from the user's plan list that need checking.
        A plan needs checking if:
        1. It has upcoming sessions in the next 7 days
        2. It had sessions in the past 7 days
        3. It's a new plan that hasn't started yet
        4. It's been consistently missed or struggling""",
        output_schema=AllPlanNamesSchema,
        connections={"default": "StartPlanLoop"}
    ),
    
    "StartPlanLoop": LoopStartNode(
        text="",
        iterator="current_plan",
        collection="plan_names",
        connections={"default": "AnalyzePlanCompletion"},
        needs=["ExtractPlanNames"],
        end_node="PlanAnalysisComplete"
    ),
    
    "AnalyzePlanCompletion": Node(
        text="""Analyze if plan '${current_plan}' has been followed according to schedule. Consider:
        1. Calculate completion rate (completed sessions / total sessions)
        2. Count number of missed sessions
        3. Look for patterns in completion/missing (e.g., specific days, times)
        4. Check if the plan has started yet
        
        Choose:
        - "NotStarted" if the plan is new or hasn't begun
        - "StrugglingBadly" if completion rate < 30%
        - "Struggling" if completion rate is 30-70%
        - "DoingWell" if completion rate > 70%
        - "NeedsAdjustment" if there's a clear pattern of difficulty (e.g., always missing morning sessions)""",
        output_schema=PlanCompletionAnalysis,
        connections={
            "NotStarted": "HandleNotStartedPlan",
            "StrugglingBadly": "HandleStrugglingPlan",
            "Struggling": "HandleStrugglingPlan",
            "DoingWell": "HandleSuccessfulPlan",
            "NeedsAdjustment": "HandlePlanAdjustment"
        }
    ),
    
    "HandleNotStartedPlan": Node(
        text="""Generate a message for a plan that hasn't started yet. Consider:
        1. When the plan is scheduled to start
        2. Express excitement about them starting this new plan
        3. Offer any relevant tips or encouragement
        4. Ask if they need any help preparing""",
        connections={"default": "NextPlan"}
    ),
    
    "HandleStrugglingPlan": Node(
        text="""Generate a supportive message for a struggling plan. Consider:
        1. Acknowledge the difficulty without judgment
        2. Reference specific challenges if known
        3. Offer encouragement and support
        4. Suggest small steps or modifications if appropriate""",
        connections={"default": "NextPlan"}
    ),
    
    "HandleSuccessfulPlan": Node(
        text="""Generate a congratulatory message for a well-followed plan. Consider:
        1. Highlight specific achievements
        2. Acknowledge their consistency
        3. Encourage continued momentum
        4. Ask about their experience or benefits noticed""",
        connections={"default": "NextPlan"}
    ),
    
    "HandlePlanAdjustment": Node(
        text="""Generate a message suggesting adjustments to make the plan more achievable. Consider:
        1. Identify specific patterns of difficulty
        2. Propose concrete adjustments
        3. Explain why these changes might help
        4. Ask for their thoughts on the suggestions""",
        connections={"default": "NextPlan"}
    ),
    
    "NextPlan": LoopContinueNode(
        text="",
        connections={"HasMore": "StartPlanLoop", "Complete": "PlanAnalysisComplete"},
        needs=["StartPlanLoop"]
    ),
    
    "PlanAnalysisComplete": Node(
        text="""Check if user has any metrics configured and their status. Consider:
        1. Count total number of metrics
        2. Check when each metric was last logged
        3. Look for any metrics that have never been used
        
        Choose:
        - "HasMetrics" if user has any metrics configured
        - "NoMetrics" if user has no metrics set up""",
        connections={
            "HasMetrics": "StartMetricLoop",
            "NoMetrics": "GenerateMetricsMessage"
        }
    ),
    
    "StartMetricLoop": LoopStartNode(
        text="",
        iterator="current_metric",
        collection="metric_names",
        connections={"default": "AnalyzeMetric"},
        needs=["PlanAnalysisComplete"],
        end_node="MetricAnalysisComplete"
    ),
    
    "AnalyzeMetric": Node(
        text="""Analyze metric '${current_metric}' for recent logging activity and trends. Consider:
        1. When was it last logged
        2. Frequency of logging
        3. Any patterns in logging behavior
        4. Whether it's never been used
        
        Choose:
        - "NeverLogged" if metric exists but has no entries
        - "Inactive" if no logs in last 3 days
        - "Active" if regularly logged
        - "Inconsistent" if logging is sporadic""",
        output_schema=MetricAnalysis,
        connections={
            "NeverLogged": "HandleNeverLoggedMetric",
            "Inactive": "HandleInactiveMetric",
            "Active": "HandleActiveMetric",
            "Inconsistent": "HandleInconsistentMetric"
        }
    ),
    
    "HandleNeverLoggedMetric": Node(
        text="""Generate a message encouraging first-time metric logging. Consider:
        1. Explain the benefit of this specific metric
        2. Make it easy to start (suggest a simple first log)
        3. Connect it to their goals if possible
        4. Keep it light and encouraging""",
        connections={"default": "NextMetric"}
    ),
    
    "HandleInactiveMetric": Node(
        text="""Generate a reminder about inactive metric logging. Consider:
        1. Note the gap in logging without judgment
        2. Remind of the metric's purpose
        3. Ask if they're facing any obstacles
        4. Offer to help if needed""",
        connections={"default": "NextMetric"}
    ),
    
    "HandleActiveMetric": Node(
        text="""Generate a positive message about consistent metric logging. Consider:
        1. Praise their consistency
        2. Note any trends or patterns
        3. Ask about insights gained
        4. Encourage continued tracking""",
        connections={"default": "NextMetric"}
    ),
    
    "HandleInconsistentMetric": Node(
        text="""Generate a message encouraging more consistent metric logging. Consider:
        1. Acknowledge existing efforts
        2. Highlight benefits of regular tracking
        3. Suggest ways to make logging easier
        4. Ask about barriers to consistency""",
        connections={"default": "NextMetric"}
    ),
    
    "NextMetric": LoopContinueNode(
        text="",
        connections={"HasMore": "StartMetricLoop", "Complete": "MetricAnalysisComplete"},
        needs=["StartMetricLoop"]
    ),
    
    "MetricAnalysisComplete": Node(
        text="""Based on all previous analyses, choose the most appropriate message focus. Consider:
        1. Which area needs most attention (plans or metrics)
        2. Recent successes and struggles
        3. Overall engagement level
        4. Previous message history to avoid repetition
        
        Choose:
        - "FocusOnPlans" if plans need more attention
        - "FocusOnMetrics" if metrics need more attention
        - "Congratulate" if doing well overall
        - "EncourageOverall" if general encouragement needed""",
        connections={
            "FocusOnPlans": "GeneratePlanFocusedMessage",
            "FocusOnMetrics": "GenerateMetricsFocusedMessage",
            "Congratulate": "GenerateCongratulatory",
            "EncourageOverall": "GenerateEncouragementMessage"
        }
    ),
    
    "GenerateMetricsMessage": Node(
        text="""Create a message asking the user if he is interested in finding correlation his activities with metrics such as happiness / productivity""",
        temperature=1.0
    ),
    
    "GeneratePlanFocusedMessage": Node(
        text="""Create a message focusing on plan completion and improvements. Consider:
        1. Reference specific plans and progress
        2. Acknowledge efforts and challenges
        3. Offer specific, actionable suggestions
        4. Maintain an encouraging tone""",
        temperature=1.0
    ),
    
    "GenerateMetricsFocusedMessage": Node(
        text="""Create a message focusing on metric logging benefits. Consider:
        1. Reference their specific metrics
        2. Highlight potential insights
        3. Make logging feel achievable
        4. Connect to their goals""",
        temperature=1.0
    ),
    
    "GenerateCongratulatory": Node(
        text="""Create an enthusiastic message about their achievements. Consider:
        1. Highlight specific successes
        2. Show genuine appreciation
        3. Encourage continued momentum
        4. Ask about their experience""",
        temperature=1.0
    ),
    
    "GenerateEncouragementMessage": Node(
        text="""Create an encouraging message about progress. Consider:
        1. Acknowledge any small wins
        2. Make next steps feel achievable
        3. Offer specific support
        4. Maintain a positive, forward-looking tone""",
        temperature=1.0
    )
}

class RecurrentMessageGenerator:
    async def generate_message(self, user_id: str, message_type: str) -> str:
        if message_type == "user-recurrent-checkin":
            return await self._generate_recurrent_checkin_message(user_id)
        else:
            raise ValueError(f"Message type {message_type} not found")
        
    def _weekday_prefix(self, user_id: str, weekday: int) -> str:
        activities_gateway = ActivitiesGateway()
        recent_activities = activities_gateway.get_readable_recent_activity_entries(user_id)
        
        if weekday == 0:  # Monday
            options = [
                "Ready to kick off the week?",
                "What's on your agenda this week?"
            ]
        elif weekday == 2:  # Wednesday
            options = [
                f"Noticed you recently did: {recent_activities}. How's it going?",
                f"Midweek check: you've been busy with {recent_activities}. What's next?"
            ]
        elif weekday == 4:  # Friday
            options = [
                "how did your week go? I can log anything you've forgot :)",
                "Any highlights from this week you'd like to share?"
            ]
        elif weekday in [5, 6]:  # Saturday/Sunday
            options = [
                "How you doing :) got plans for next week?",
            ]
        else:  # Tuesday or Thursday
            options = [
                "Hope your week has been going good. What's on your mind?",
                "Quick check-in: how's your week going? anything you did you haven't logged?"
            ]
        return random.choice(options)

    async def _generate_recurrent_checkin_message(self, user_id: str) -> str:
        from services.notification_manager import NotificationManager
        from gateways.users import UsersGateway

        notification_manager = NotificationManager()
        activities_gateway = ActivitiesGateway()
        plan_controller = PlanController()
        metrics_gateway = MetricsGateway()
        users_gateway = UsersGateway()

        user = users_gateway.get_user_by_id(user_id)
        weekday = datetime.now(pytz.UTC).weekday()

        system_prompt = f"""You are Jarvis, a friendly assistant communicating in {user.language}. 
Your goal is to send a short, human, and engaging check-in message to help the user stay engaged with their activities and plans.
Your message should be direct, personal, and actionable."""

        framework = FlowchartLLMFramework(recurrent_checkin_flowchart, system_prompt)

        notification_history = "\n".join(
            [notification.message for notification in notification_manager.get_last_notifications_sent_to_user(user_id, limit=5)]
        )

        context = {
            "activities": [str(a) for a in activities_gateway.get_all_activities_by_user_id(user_id)],
            "recent_activities": activities_gateway.get_readable_recent_activity_entries(user_id),
            "plans": plan_controller.get_readable_plans(user_id),
            "metrics": metrics_gateway.get_readable_metrics_and_entries(user_id),
            "current_time": datetime.now(pytz.UTC).strftime("%A, %B %d, %Y at %I:%M %p %Z"),
            "notification_history": notification_history,
            "language": user.language
        }

        try:
            message, extracted = await framework.run(context)
            
            # The message should be in the last node's GeneratedMessage.message field
            if isinstance(message, str):
                return message.strip()
            elif hasattr(message, 'message'):
                return message.message.strip()
            else:
                logger.error(f"Unexpected message format: {message}")
                return self._weekday_prefix(user_id, weekday)  # Fallback to simple message
                
        except Exception as e:
            logger.error(f"Error generating message: {e}")
            return self._weekday_prefix(user_id, weekday)  # Fallback to simple message
