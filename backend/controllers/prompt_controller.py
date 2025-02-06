from typing import Dict
from datetime import datetime
import pytz
import random

from gateways.activities import ActivitiesGateway
from controllers.plan_controller import PlanController
from gateways.metrics import MetricsGateway
class PromptController:
    def get_prompt(self, user_id: str, prompt_tag: str) -> str:
        if prompt_tag == "user-recurrent-checkin":
            return self._get_user_recurrent_checkin_prompt(user_id)
        else:
            raise ValueError(f"Prompt tag {prompt_tag} not found")
        
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

    def _get_user_recurrent_checkin_prompt(self, user_id: str) -> str:
        from services.notification_manager import NotificationManager
        from gateways.users import UsersGateway

        notification_manager = NotificationManager()
        activities_gateway = ActivitiesGateway()
        plan_controller = PlanController()
        metrics_gateway = MetricsGateway()

        notification_history = "\n".join(
            [notification.message for notification in notification_manager.get_last_notifications_sent_to_user(user_id, limit=5)]
        )

        user = UsersGateway().get_user_by_id(user_id)
        weekday = datetime.now(pytz.UTC).weekday()
        day_based_prefix = self._weekday_prefix(user_id, weekday)

        prompt = f"""
You are Jarvis, a friendly assistant communicating in {user.language}. Your goal is to send a short, human, and engaging check-in message to the user.
You are able to log past activities for the user, on which your notifications should be based.

Use the following day-specific inspiration as context for your tone and content:
"{day_based_prefix}"

Here’s some quick info about the user:
- Activities: {[str(a) for a in activities_gateway.get_all_activities_by_user_id(user_id)]}
- Recent Activities: {activities_gateway.get_readable_recent_activity_entries(user_id)}
- Plans: {plan_controller.get_readable_plans(user_id)}
- Metrics: {metrics_gateway.get_readable_metrics_and_entries(user_id)}

Current UTC time: {datetime.now(pytz.UTC).strftime("%A, %B %d, %Y at %I:%M %p %Z")}

Keep it simple and direct—like a friendly nudge. Mention at most one activity or plan, and avoid repetition (recent messages: {notification_history}).

Your message:
"""
        return prompt
