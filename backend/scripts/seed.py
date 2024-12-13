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
from controllers.plan_controller import PlanController
from gateways.plan_groups import PlanGroupsGateway
from services.notification_manager import NotificationManager
import traceback
from pymongo import MongoClient
from constants import MONGO_DB_CONNECTION_STRING, MONGO_DB_NAME, ENVIRONMENT
from bson import ObjectId
from loguru import logger
import random

def delete_all_data():
    if ENVIRONMENT != "dev":
        logger.error("This script is only available in the dev environment.")
        return
    
    client = MongoClient(MONGO_DB_CONNECTION_STRING)
    db_name = f"{MONGO_DB_NAME.lower()}_{ENVIRONMENT.lower()}"
    db = client[db_name]
    collections = ["users", "activities", "mood_reports", "plans", "plan_groups", "friend_requests", "notifications"]   
    logger.info(f"Cleaning all data from {db_name}...")
    for collection in collections:
        logger.info(f"Cleaning {collection}...")
        result = db[collection].delete_many({})
        logger.info(f"Cleaned {result.deleted_count} documents from {collection}")


def generate_dummy_data():
    users_gateway = UsersGateway()
    activities_gateway = ActivitiesGateway()
    moods_gateway = MoodsGateway()
    plan_controller = PlanController()
    plan_groups_gateway = PlanGroupsGateway()
    notification_manager = NotificationManager()

    # Create 5 users
    users = [
        User.new(id=str(ObjectId("666666666666666666666665")), name="Alex", email="alexandre.ramalho.1998@gmail.com", clerk_id="user_2kUW1zytLj9ERvDqVDDFCvIp5Un", picture="https://lh3.googleusercontent.com/a/ACg8ocLI9cioxfK2XKVtsArYggis7j9dB7-B7JiwkzMWFsKPeVBQdXlG=s1000-c", username="alex", friend_ids=["666666666666666666666667"], referred_user_ids=["666666666666666666666666"]),
        User.new(id=str(ObjectId("666666666666666666666666")), name="Alice", email="alice@example.com", username="alice"),
        User.new(id=str(ObjectId("666666666666666666666667")), name="E2E", email="tyvmgldzsifhjcpuwn@hthlm.com", username="bamboozle", clerk_id="user_2oUKXciL3h0y3QFcNOqHM9GTwUp", friend_ids=["666666666666666666666665"]),
        User.new(id=str(ObjectId("666666666666666666666668")), name="Charlie", email="charlie@example.com", username="charlie"),
        User.new(id=str(ObjectId("666666666666666666666669")), name="Tomas", email="tomas@example.com", username="tomas", picture="https://example.com/tomas.jpg")
    ]
    # Create activities
    activities = [
        Activity.new(id=str(ObjectId("666666666666666666666669")), user_id=users[0].id, title="Running", measure="kilometers", emoji="🏃"),
        Activity.new(id=str(ObjectId("66666666666666666666666a")), user_id=users[1].id, title="Meditation", measure="minutes", emoji="🧘"),
        Activity.new(id=str(ObjectId("66666666666666666666666b")), user_id=users[2].id, title="Push-ups", measure="repetitions", emoji="💪"),
        Activity.new(id=str(ObjectId("66666666666666666666666c")), user_id=users[3].id, title="Cycling", measure="kilometers", emoji="🚴"),
        Activity.new(id=str(ObjectId("66666666666666666666666d")), user_id=users[0].id, title="Swimming", measure="laps", emoji="🏊"),
        Activity.new(id=str(ObjectId("66666666666666666666666e")), user_id=users[1].id, title="Yoga", measure="minutes", emoji="🧘‍♀️"),
        Activity.new(id=str(ObjectId("66666666666666666666666f")), user_id=users[2].id, title="Reading", measure="pages", emoji="📚"),
        Activity.new(id=str(ObjectId("666666666666666666666670")), user_id=users[3].id, title="Cooking", measure="dishes", emoji="👨‍🍳"),
        Activity.new(id=str(ObjectId("666666666666666666666671")), user_id=users[0].id, title="Gardening", measure="minutes", emoji="🌱"),
        Activity.new(id=str(ObjectId("666666666666666666666672")), user_id=users[4].id, title="Guitar", measure="minutes", emoji="🎸")
    ]

    # Generate dates within the last month
    def random_date_last_month():
        end = datetime.datetime.now()
        start = end - timedelta(days=30)
        return start + timedelta(
            seconds=int((end - start).total_seconds() * random.random())
        )

    activity_entries = [
        ActivityEntry.new(id=str(ObjectId("666666666666666666666672")), activity_id=activities[0].id, quantity=10, date=random_date_last_month().isoformat(), user_id=users[0].id, image=ImageInfo.new(url="https://media.istockphoto.com/id/578104104/vector/step-to-instruction-in-push-up.jpg?s=612x612&w=0&k=20&c=AYSyhYJB-98AZL2Euig4fygTjdxliyE8TWHGfXNO6go=")),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666673")), activity_id=activities[1].id, quantity=10, date=datetime.datetime.now().isoformat(), user_id=users[1].id),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666674")), activity_id=activities[2].id, quantity=10, date=random_date_last_month().isoformat(), user_id=users[2].id, image=ImageInfo.new(url="https://media.istockphoto.com/id/578104104/vector/step-to-instruction-in-push-up.jpg?s=612x612&w=0&k=20&c=AYSyhYJB-98AZL2Euig4fygTjdxliyE8TWHGfXNO6go=")),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666675")), activity_id=activities[3].id, quantity=10, date=datetime.datetime.now().isoformat(), user_id=users[3].id),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666676")), activity_id=activities[4].id, quantity=10, date=random_date_last_month().isoformat(), user_id=users[0].id),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666677")), activity_id=activities[5].id, quantity=10, date=datetime.datetime.now().isoformat(), user_id=users[1].id),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666678")), activity_id=activities[0].id, quantity=10, date=random_date_last_month().isoformat(), user_id=users[2].id),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666679")), activity_id=activities[1].id, quantity=10, date=datetime.datetime.now().isoformat(), user_id=users[3].id),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667a")), activity_id=activities[2].id, quantity=10, date=random_date_last_month().isoformat(), user_id=users[0].id),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667b")), activity_id=activities[3].id, quantity=10, date=datetime.datetime.now().isoformat(), user_id=users[2].id),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667c")), activity_id=activities[4].id, quantity=10, date=random_date_last_month().isoformat(), user_id=users[3].id),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667d")), activity_id=activities[5].id, quantity=10, date=datetime.datetime.now().isoformat(), user_id=users[1].id),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667e")), activity_id=activities[6].id, quantity=50, date=random_date_last_month().isoformat(), user_id=users[0].id),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667f")), activity_id=activities[7].id, quantity=2, date=datetime.datetime.now().isoformat(), user_id=users[2].id),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666680")), activity_id=activities[8].id, quantity=30, date=random_date_last_month().isoformat(), user_id=users[3].id),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666681")), activity_id=activities[9].id, quantity=45, date=random_date_last_month().isoformat(), user_id=users[4].id),
    ]

    # Create plans
    plans = [
        Plan.new(
            id=str(ObjectId("666666666666666666666681")),
            user_id=users[0].id,
            goal="Run a marathon",
            emoji="🏃",
            finishing_date=(datetime.datetime.now() + timedelta(days=90)).isoformat(),
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
            sessions=[
                PlanSession(
                    date=(datetime.datetime.now() + timedelta(days=i)).isoformat(),
                    descriptive_guide="Meditate for 15 minutes",
                    activity_id=activities[1].id,
                    quantity=15
                ) for i in range(30)
            ]
        ),
        Plan.new(
            id=str(ObjectId("666666666666666666666683")),
            user_id=users[2].id,
            goal="100 push-ups challenge",
            emoji="💪",
            finishing_date=(datetime.datetime.now() + timedelta(days=30)).isoformat(),
            sessions=[
                PlanSession(
                    date=(datetime.datetime.now() + timedelta(days=i)).isoformat(),
                    descriptive_guide=f"Do {20 + i*3} push-ups",
                    activity_id=activities[2].id,
                    quantity=20 + i*3
                ) for i in range(30)
            ],
        ),
        Plan.new(
            id=str(ObjectId("666666666666666666666684")),
            user_id=users[4].id,
            goal="Learn guitar",
            emoji="🎸",
            finishing_date=(datetime.datetime.now() + timedelta(days=60)).isoformat(),
            sessions=[
                PlanSession(
                    date=(datetime.datetime.now() + timedelta(days=i)).isoformat(),
                    descriptive_guide="Practice guitar for 30 minutes",
                    activity_id=activities[9].id,
                    quantity=30
                ) for i in range(60)
            ],
        )
    ]

    # Create plan groups
    plan_groups = [
        PlanGroup.new(
            id=str(ObjectId("666666666666666666666685")),
            plan_ids=[plans[1].id],
            members=[
                PlanGroupMember(user_id=users[1].id, username=users[1].username, name=users[1].name, picture=users[1].picture),
            ],
        ),
        PlanGroup.new(
            id=str(ObjectId("666666666666666666666686")),
            plan_ids=[plans[2].id, plans[0].id],
            members=[
                PlanGroupMember(user_id=users[2].id, username=users[2].username, name=users[2].name, picture=users[2].picture),
                PlanGroupMember(user_id=users[0].id, username=users[0].username, name=users[0].name, picture=users[0].picture),
            ],
        ),
    ]

    # Create plan invitations
    plan_invitations = [
        PlanInvitation.new(id=str(ObjectId("666666666666666666666687")), plan_id=plans[0].id, sender_id=users[0].id, recipient_id=users[1].id),
        PlanInvitation.new(id=str(ObjectId("666666666666666666666688")), plan_id=plans[1].id, sender_id=users[1].id, recipient_id=users[2].id),
        PlanInvitation.new(id=str(ObjectId("666666666666666666666689")), plan_id=plans[2].id, sender_id=users[2].id, recipient_id=users[3].id),
        PlanInvitation.new(id=str(ObjectId("66666666666666666666668a")), plan_id=plans[3].id, sender_id=users[4].id, recipient_id=users[0].id),
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
                prompt_tag="user-recurrent-checkin",
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
                prompt_tag="weekly-reflection",
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

        user_notifications = notification_manager.get_all_for_user(user.id)
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
