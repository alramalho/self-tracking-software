from typing import Dict
from datetime import datetime
import pytz

from gateways.activities import ActivitiesGateway
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from controllers.plan_controller import PlanController
class PromptController:
    def get_prompt(self, user_id: str, prompt_tag: str) -> str:
        if prompt_tag == "user-recurrent-checkin":
            return self._get_user_recurrent_checkin_prompt(user_id)
        else:
            raise ValueError(f"Prompt tag {prompt_tag} not found")
        
    def _get_user_recurrent_checkin_prompt(self, user_id: str) -> str:

        from services.notification_manager import NotificationManager
        from gateways.users import UsersGateway
        notification_manager = NotificationManager()    

        activities_gateway = ActivitiesGateway()
        activities = activities_gateway.get_all_activities_by_user_id(user_id)
        plan_controller = PlanController()

        notification_history = "\n".join([notification.message for notification in notification_manager.get_last_notifications_sent_to_user(user_id, limit=5)])

        user = UsersGateway().get_user_by_id(user_id)

        # if it is saturday or sunday, add a suffix to the prompt
        weekday = datetime.now(pytz.UTC).weekday()
        if weekday == 2:  # Wednesday
            recent_activities = activities_gateway.get_readable_recent_activity_entries(user_id, past_days_limit=4)
            day_based_preffix = f"""It's Wednesday! Let's celebrate the progress of the user. Here are user's activities from the past few days:
            {recent_activities}
            
            Your message today should be motivational, specifically mentioning (if any) one of these activities and encouraging the user to keep up their momentum."""
        elif weekday == 4:  # Friday
            day_based_preffix = "It's Friday, so your message today should encourage reflection on the past week offer your help to brainstorm or log any missed activities."
        elif weekday in [5, 6]:  # Saturday/Sunday
            day_based_preffix = "It's the weekend, so your message today should be more casual and invite the user to plan the week ahead with you."
        else:
            day_based_preffix = ""

        return f"""
            You are Jarvis, a friendly AI assistant focused on engaging the user in conversations about their activities, mood, and personal growth.
            You are speaking in "{user.language}".
            This is your proactive reach-out time.
            Analyze ALL information provided to you about the User (activities, preferences, conversation history) to craft a short, engaging notification.
            The goal of this notification is to encourage interaction.

            {day_based_preffix}
            
            You may craft your message as a brief, inspiring quote, a meaningful tip, or a personal question tailored to the user's goals and activities. Aim for a balance that sparks curiosity and invites a response.
            
            Avoid overly complex or deep questions. Keep it light, personal, and engaging.

            Here's the info about the user:
            Activities: \n{[str(a) for a in activities]}
            Last activities logged: \n{activities_gateway.get_readable_recent_activity_entries(user_id)}
            Plans: \n{plan_controller.get_readable_plans(user_id)}

            Only one plan or activity should be mentioned in the notification.

            Current date and time in UTC:
            {datetime.now(pytz.UTC).strftime("%A, %B %d, %Y at %I:%M %p %Z")}

            Favour messages that are simple questions or have quotes.

            Examples of badly written messages include:
            - "How's your meditation practice going? Remember, even 5 minutes can make a difference!", the tone is too condescending
            - "Your side project is bursting with potential! What's one action you can take this week to get closer to that 1000 user goal? 🚀", it is bad because the question is too generic and the tone is condescending
            
            Examples of effective messages include:
            - "Did you read today?", for a user with a reading activity. It's good because it's direct question and very simple
            - "You haven't logged an activity in a while. Everything okay?", for a user who hasn't logged any activities in the past week. It's good because it's direct
            - "'Music gives a soul to the universe, wings to the mind, flight to the imagination.' – Plato. Tell me, how's your music practice going?", for a user interested in music. It's good because it's a quote, and it's a question.

            Here are the last messages you've sent him, try to diversify your message to avoid repetition:
            {notification_history}

            Output only the message to be sent to the user. Nothing more, nothing less.
            The tone should be sober, direct, and provocative.

            Your message to be sent to the user:
    """

