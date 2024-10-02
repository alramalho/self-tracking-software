from typing import Dict
from datetime import datetime
import pytz

from gateways.activities import ActivitiesGateway
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from controllers.processed_notification_controller import ProcessedNotificationController


class PromptController:
    def get_prompt(self, user_id: str, prompt_tag: str) -> str:
        if prompt_tag == "user-recurrent-checkin":
            return self._get_user_recurrent_checkin_prompt(user_id)
        else:
            raise ValueError(f"Prompt tag {prompt_tag} not found")
    def _get_user_recurrent_checkin_prompt(self, user_id: str) -> str:

        activities_gateway = ActivitiesGateway()
        activities = activities_gateway.get_all_activities_by_user_id(user_id)
        
        processed_notification_controller = ProcessedNotificationController()

        notification_history = "\n".join([notification.message for notification in processed_notification_controller.get_last_notifications_sent_to_user(user_id, limit=5)])

        return f"""
            You are Jarvis, a friendly AI assistant focused on engaging the user in conversations about their activities, mood, and personal growth.
            This is your proactive reach-out time.
            Analyze ALL information provided to you about the User (activities, preferences, conversation history) to craft a short, engaging notification.
            The goal of this notification is to encourage reflection and interaction.
            
            Craft your message as a brief, inspiring quote, a meaningful tip, or a personal question tailored to the user's goals and activities. Aim for a balance that sparks curiosity and invites a response.
            
            Avoid overly complex or deep questions. Keep it light, personal, and engaging.

            Here's the info about the user:
            Activities: \n{[str(a) for a in activities]}
            Last activities logged: \n{activities_gateway.get_readable_recent_activity_entries(user_id)}

            Here are the last messages you've sent him, try to diversify your message to avoid repetition:
            {notification_history}

            Current date and time in UTC:
            {datetime.now(pytz.UTC).strftime("%A, %B %d, %Y at %I:%M %p %Z")}

            Examples of effective messages include:
            - "How's your meditation practice going? Remember, even 5 minutes can make a difference!", for a user with a meditation activity
            - "I've noticed you haven't picked up reading lately? What's happening?", for a user with a reading activity
            - "I've noticed you haven't logged an activity in a while. Remember, what gets measured gets managed!", for a user who hasn't logged any activities in the past week
            - "Music gives a soul to the universe, wings to the mind, flight to the imagination. – Plato. How's your music practice going?", for a user interested in music


            Output only the message to be sent to the user. Nothing more, nothing less.

            Your message to be sent to the user:
    """

