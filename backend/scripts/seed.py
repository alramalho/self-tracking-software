from shared.logger import create_logger
create_logger(level="INFO")
import datetime
from datetime import timedelta

from entities.user import User
from entities.activity import Activity, ActivityEntry, ImageInfo
from entities.plan import Plan, PlanSession
from entities.plan_invitation import PlanInvitation
from entities.friend_request import FriendRequest
from entities.notification import Notification
from entities.plan_group import PlanGroup, PlanGroupMember
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway
from gateways.moodreports import MoodsGateway
from gateways.metrics import MetricsGateway
from controllers.plan_controller import PlanController
from gateways.plan_groups import PlanGroupsGateway
from services.notification_manager import NotificationManager
import traceback
from pymongo import MongoClient
from constants import MONGO_DB_CONNECTION_STRING, MONGO_DB_NAME, ENVIRONMENT
from bson import ObjectId
from loguru import logger
import random
from entities.metric import Metric, MetricEntry

def delete_all_data():
    if ENVIRONMENT != "dev":
        logger.error("This script is only available in the dev environment.")
        return
    
    client = MongoClient(MONGO_DB_CONNECTION_STRING)
    db_name = f"{MONGO_DB_NAME.lower()}_{ENVIRONMENT.lower()}"
    db = client[db_name]
    collections = ["users", "activities", "mood_reports", "plans", "plan_groups", "friend_requests", "notifications", "metrics", "metric_entries"]   
    logger.info(f"Cleaning all data from {db_name}...")
    for collection in collections:
        logger.info(f"Cleaning {collection}...")
        result = db[collection].delete_many({})
        logger.info(f"Cleaned {result.deleted_count} documents from {collection}")


def generate_dummy_data():
    users_gateway = UsersGateway()
    activities_gateway = ActivitiesGateway()
    moods_gateway = MoodsGateway()
    metrics_gateway = MetricsGateway()
    plan_controller = PlanController()
    plan_groups_gateway = PlanGroupsGateway()
    notification_manager = NotificationManager()

    # Create 5 users
    users = [
        User.new(id=str(ObjectId("666666666666666666666665")), name="Alex", email="alexandre.ramalho.1998@gmail.com", clerk_id="user_2kUW1zytLj9ERvDqVDDFCvIp5Un", picture="https://lh3.googleusercontent.com/a/ACg8ocLI9cioxfK2XKVtsArYggis7j9dB7-B7JiwkzMWFsKPeVBQdXlG=s1000-c", username="alex", friend_ids=["666666666666666666666667"], referred_user_ids=["666666666666666666666666"]),
        User.new(id=str(ObjectId("666666666666666666666666")), name="Alice", email="alice@example.com", username="alice"),
        User.new(id=str(ObjectId("666666666666666666666667")), name="E2E", email="alexandre.ramalho.1998+e2etracking@gmail.com", username="bamboozle", clerk_id="user_2pacar3EWIkXixT3na4OkFAxwb8", friend_ids=["666666666666666666666665"]),
        User.new(id=str(ObjectId("666666666666666666666668")), name="Charlie", email="charlie@example.com", username="charlie"),
        User.new(id=str(ObjectId("666666666666666666666669")), name="Tomas", email="tomas@example.com", username="tomas", picture="https://example.com/tomas.jpg")
    ]
    # Create metrics - only happiness for testing
    metrics = [
        Metric.new(user_id=users[0].id, title="Happiness", emoji="😊"),
    ]

    # Create activities for Alex (user[0]) - just running and meditation
    alex_activities = [
        Activity.new(id=str(ObjectId("666666666666666666666669")), user_id=users[0].id, title="Running", measure="kilometers", emoji="🏃"),
        Activity.new(id=str(ObjectId("66666666666666666666666d")), user_id=users[0].id, title="Meditation", measure="minutes", emoji="🧘"),
        Activity.new(id=str(ObjectId("66666666666666666666666e")), user_id=users[2].id, title="push-ups", measure="times", emoji="💪"),
    ]

    # Replace the activities list
    activities = alex_activities

    # Generate 20 entries over a 60-day period (roughly 3 days apart)
    metric_entries = []
    activity_entries = []
    
    base_date = datetime.datetime.now() - timedelta(days=60)
    
    for i in range(20):
        # Space out entries roughly 3 days apart
        current_date = (base_date + timedelta(days=i*3)).replace(
            hour=random.randint(8, 20),  # Random hour between 8 AM and 8 PM
            minute=random.randint(0, 59)
        ).isoformat()
        
        # Simulate running on even-numbered entries (strong positive correlation)
        if i % 2 == 0:
            # Morning run
            run_time = (datetime.datetime.fromisoformat(current_date)
                       .replace(hour=8, minute=random.randint(0, 59))
                       .isoformat())
            activity_entries.append(
                ActivityEntry.new(
                    user_id=users[0].id,
                    activity_id=alex_activities[0].id,  # Running
                    quantity=5,
                    date=run_time
                )
            )
        
        # Simulate meditation on odd-numbered entries (no correlation)
        if i % 2 == 1:
            # Evening meditation
            meditation_time = (datetime.datetime.fromisoformat(current_date)
                            .replace(hour=20, minute=random.randint(0, 59))
                            .isoformat())
            activity_entries.append(
                ActivityEntry.new(
                    user_id=users[0].id,
                    activity_id=alex_activities[1].id,  # Meditation
                    quantity=15,
                    date=meditation_time
                )
            )

        # Log happiness rating in the evening
        rating_time = (datetime.datetime.fromisoformat(current_date)
                      .replace(hour=22, minute=random.randint(0, 59))
                      .isoformat())
        
        # Happiness rating - high (4-5) on running days, random (1-5) on non-running days
        did_run = any(e.activity_id == alex_activities[0].id and 
                     datetime.datetime.fromisoformat(e.date).date() == 
                     datetime.datetime.fromisoformat(current_date).date() 
                     for e in activity_entries)
        happiness_rating = random.randint(4, 5) if did_run else random.randint(1, 5)
        
        metric_entries.append(
            MetricEntry.new(
                user_id=users[0].id,
                metric_id=metrics[0].id,
                rating=happiness_rating,
                date=rating_time
            )
        )

    # Skip other users' activities
    
    # Create a simple plan for running and meditation
    plans = [
        Plan.new(
            id=str(ObjectId("666666666666666666666681")),
            user_id=users[0].id,
            goal="Run a marathon",
            emoji="🏃",
            finishing_date=(datetime.datetime.now() + timedelta(days=90)).isoformat(),
            activity_ids=[activities[0].id],  # Running
            sessions=[
                PlanSession(
                    date=(datetime.datetime.now() + timedelta(days=i)).isoformat(),
                    descriptive_guide=f"Run {5 + i} km",
                    activity_id=activities[0].id,
                    quantity=5 + i
                ) for i in range(0, 90, 3)
            ],
        ),
        Plan.new(
            id=str(ObjectId("666666666666666666666682")),
            user_id=users[1].id,
            goal="Meditate daily",
            emoji="🧘",
            finishing_date=(datetime.datetime.now() + timedelta(days=30)).isoformat(),
            activity_ids=[activities[1].id],  # Meditation
            sessions=[
                PlanSession(
                    date=(datetime.datetime.now() + timedelta(days=i)).isoformat(),
                    descriptive_guide="Meditate for 15 minutes",
                    activity_id=activities[1].id,
                    quantity=15
                ) for i in range(30)
            ]
        )
    ]

    # Create plan groups with only our two plans
    plan_groups = [
        PlanGroup.new(
            id=str(ObjectId("666666666666666666666685")),
            plan_ids=[plans[1].id],  # Meditation plan
            members=[
                PlanGroupMember(user_id=users[1].id, username=users[1].username, name=users[1].name, picture=users[1].picture),
            ],
        ),
        PlanGroup.new(
            id=str(ObjectId("666666666666666666666686")),
            plan_ids=[plans[0].id],  # Running plan
            members=[
                PlanGroupMember(user_id=users[0].id, username=users[0].username, name=users[0].name, picture=users[0].picture),
            ],
        ),
    ]

    # Create plan invitations for only our two plans
    plan_invitations = [
        PlanInvitation.new(id=str(ObjectId("666666666666666666666687")), plan_id=plans[0].id, sender_id=users[0].id, recipient_id=users[1].id),
        PlanInvitation.new(id=str(ObjectId("666666666666666666666688")), plan_id=plans[1].id, sender_id=users[1].id, recipient_id=users[2].id),
    ]

    # Create friend requests
    friend_requests = [
        FriendRequest.new(id=str(ObjectId("66666666666666666666668a")), sender_id=users[1].id, recipient_id=users[0].id),
        # FriendRequest.new(id=str(ObjectId("66666666666666666666668b")), sender_id=users[2].id, recipient_id=users[0].id),
        FriendRequest.new(id=str(ObjectId("66666666666666666666668c")), sender_id=users[4].id, recipient_id=users[0].id),
    ]

    # Create notifications
    notifications = []

    # Friend request notifications
    for i, friend_request in enumerate(friend_requests):
        users_gateway.friend_request_gateway.create_friend_request(friend_request)

        sender = next((u for u in users if u.id == friend_request.sender_id), None)
        notifications.append(
            notification_manager.create_or_get_notification(
                Notification.new(
                    id=str(ObjectId(f"66666666666666666666668{i}")),
                    user_id=friend_request.recipient_id,
                    message=f"{sender.name} sent you a friend request",
                    type="friend_request",
                    related_id=friend_request.id,
                    related_data={
                        "id": friend_request.sender_id,
                         "name": sender.name,
                        "username": sender.username,
                        "picture": sender.picture
                    }
                )
            )
        )

    # Plan invitation notifications
    for i, plan_invitation in enumerate(plan_invitations):
        plan_controller.plan_invitation_gateway.upsert_plan_invitation(plan_invitation)

        sender = next((u for u in users if u.id == plan_invitation.sender_id), None)
        plan = next((p for p in plans if p.id == plan_invitation.plan_id), None)
        notifications.append(
            notification_manager.create_or_get_notification(
                Notification.new(
                    id=str(ObjectId(f"66666666666666666666669{i}")),
                    user_id=plan_invitation.recipient_id,
                    message=f"{sender.name} invited you to join the plan: {plan.goal}",
                    type="plan_invitation",
                    related_id=plan_invitation.id,
                    related_data={
                        "id": sender.id,
                        "name": sender.name,
                        "username": sender.username,
                        "picture": sender.picture
                    }
                )
            )
        )

    # Engagement notifications
    notifications.extend([
        notification_manager.create_or_get_notification(
            Notification.new(
                id=str(ObjectId("66666666666666666666668c")),
                user_id=users[0].id,
                message="How's your training going? Let's check in on your progress!",
                type="engagement",
                recurrence="daily",
                time_deviation_in_hours=2,
            )
        ),
        notification_manager.create_or_get_notification(
            Notification.new(
                id=str(ObjectId("66666666666666666666668d")),
                user_id=users[0].id,
                message="Time for your weekly reflection! Let's take a moment to look back at your journey. What goals have you accomplished this week? What challenges did you overcome? What have you learned about yourself through tracking your activities and working towards your goals?",
                type="engagement",
                recurrence="weekly",
                time_deviation_in_hours=4,
            )
        )
    ])

    for user in users:
        users_gateway.create_user(user)
        
    for activity in activities:
        activities_gateway.create_activity(activity)

    for activity_entry in activity_entries:
        activities_gateway.create_activity_entry(activity_entry)

    for metric in metrics:
        metrics_gateway.create_metric(metric)

    for metric_entry in metric_entries:
        metrics_gateway.create_metric_entry(metric_entry)

    for plan in plans:
        try:
            plan_controller.create_plan(plan)
            users_gateway.add_plan_to_user(plan.user_id, plan.id)
            user = next((u for u in users if u.id == plan.user_id), None)
            user.plan_ids.append(plan.id)
        except Exception as e:
            print(f"Error creating plan {plan.goal}: {str(e)}")
            return

    for plan_group in plan_groups:
        plan_groups_gateway.create_plan_group(plan_group)
        for plan in plans:
            if plan.id in plan_group.plan_ids:
                plan.plan_group_id = plan_group.id
                plan_controller.update_plan(plan)

    print("\nFinal state:")
    for user in users:
        pending_plan_invitations = [invitation.id for invitation in plan_invitations if invitation.recipient_id == user.id and invitation.status == "pending"]
        pending_friend_requests = [friend_request.id for friend_request in friend_requests if friend_request.recipient_id == user.id and friend_request.status == "pending"]
        user_data = users_gateway.get_user_by_id(user.id)
        print(f"\nUser: {user_data.name} (username: {user_data.username})")
        print(f"Friends: {', '.join([users_gateway.get_user_by_id(friend_id).name for friend_id in user_data.friend_ids])}")
        print(f"Pending Plan Invitations: {len(pending_plan_invitations)}")
        print(f"Pending Friend Requests: {len(pending_friend_requests)}")
        
        user_activities = activities_gateway.get_all_activities_by_user_id(user.id)
        print("Activities:")
        for activity in user_activities:
            print(f"- {activity.title}")
            entries = activities_gateway.get_all_activity_entries_by_activity_id(activity.id)
            for entry in entries:
                print(f"  * {entry.date}: {entry.quantity} {activity.measure}")
        
        user_plans = plan_controller.get_plans(user.plan_ids)
        print("Plans:")
        for plan in user_plans:
            print(f"- {plan.goal} (Finishing date: {plan.finishing_date})")
            plan_group = plan_groups_gateway.get_plan_group_by_plan_id(plan.id)
            if plan_group:
                print(f"  Members: {', '.join([member.name for member in plan_group.members])}")
            print(f"  Sessions: {len(plan.sessions)}")

        user_notifications = notification_manager.get_all_non_concluded_for_user(user.id)
        print("Notifications:")
        for notification in user_notifications:
            print(f"- Type: {notification.type}")
            print(f"  Message: {notification.message}")
            print(f"  Status: {notification.status}")

    print("Done! 🎉")

if __name__ == "__main__":
    from constants import ENVIRONMENT

    if ENVIRONMENT == "dev":
        try:
            delete_all_data()
            generate_dummy_data()
        except Exception as e:
            print(f"Error generating dummy data: {str(e)}")
            print(traceback.format_exc())
    else:
        print("This script is only available in the dev environment.")
