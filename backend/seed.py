from shared.logger import create_logger
create_logger(level="DEBUG")
import datetime
from datetime import timedelta

from entities.user import User
from entities.activity import Activity, ActivityEntry
from entities.plan import Plan, PlanSession, PlanInvitee
from entities.plan_invitation import PlanInvitation
from entities.friend_request import FriendRequest
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway
from gateways.moodreports import MoodsGateway
from controllers.plan_controller import PlanController
from services.notification_manager import NotificationManager
import traceback
from bson import ObjectId

def generate_dummy_data():
    users_gateway = UsersGateway()
    activities_gateway = ActivitiesGateway()
    moods_gateway = MoodsGateway()
    plan_controller = PlanController()
    notification_manager = NotificationManager()

    # Create 4 users
    users = [
        User.new(id=str(ObjectId("666666666666666666666665")), name="Alex", email="alexandre.ramalho.1998@gmail.com", clerk_id="user_2kUW1zytLj9ERvDqVDDFCvIp5Un", picture="https://lh3.googleusercontent.com/a/ACg8ocLI9cioxfK2XKVtsArYggis7j9dB7-B7JiwkzMWFsKPeVBQdXlG=s1000-c", username="alex"),
        User.new(id=str(ObjectId("666666666666666666666666")), name="Alice", email="alice@example.com", username="alice"),
        User.new(id=str(ObjectId("666666666666666666666667")), name="Bob", email="bob@example.com", username="bob"),
        User.new(id=str(ObjectId("666666666666666666666668")), name="Charlie", email="charlie@example.com", username="charlie")
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
        Activity.new(id=str(ObjectId("666666666666666666666671")), user_id=users[0].id, title="Gardening", measure="minutes", emoji="🌱")
    ]

    activity_entries = [
        ActivityEntry.new(id=str(ObjectId("666666666666666666666672")), activity_id=activities[0].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666673")), activity_id=activities[1].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666674")), activity_id=activities[2].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666675")), activity_id=activities[3].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666676")), activity_id=activities[4].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666677")), activity_id=activities[5].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666678")), activity_id=activities[0].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666679")), activity_id=activities[1].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667a")), activity_id=activities[2].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667b")), activity_id=activities[3].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667c")), activity_id=activities[4].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667d")), activity_id=activities[5].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667e")), activity_id=activities[6].id, quantity=50, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667f")), activity_id=activities[7].id, quantity=2, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666680")), activity_id=activities[8].id, quantity=30, date=datetime.datetime.now().isoformat()),
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
            invitees=[PlanInvitee(user_id=users[1].id, username=users[1].username, name=users[1].name, picture=users[1].picture)]
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
            invitees=[
                PlanInvitee(user_id=users[0].id, username=users[0].username, name=users[0].name, picture=users[0].picture),
                PlanInvitee(user_id=users[3].id, username=users[3].username, name=users[3].name, picture=users[3].picture)
            ]
        )
    ]

    # Create plan invitations
    plan_invitations = [
        PlanInvitation.new(id=str(ObjectId("666666666666666666666684")), plan_id=plans[0].id, sender_id=users[1].id, recipient_id=users[0].id),  # Alice invites Alex
        PlanInvitation.new(id=str(ObjectId("666666666666666666666685")), plan_id=plans[1].id, sender_id=users[2].id, recipient_id=users[0].id),  # Bob invites Alex
        PlanInvitation.new(id=str(ObjectId("666666666666666666666686")), plan_id=plans[2].id, sender_id=users[3].id, recipient_id=users[0].id),  # Charlie invites Alex
    ]

    # Create friend requests
    friend_requests = [
        FriendRequest.new(id=str(ObjectId("666666666666666666666687")), sender_id=users[1].id, recipient_id=users[0].id),  # Alice sends friend request to Alex
        FriendRequest.new(id=str(ObjectId("666666666666666666666688")), sender_id=users[2].id, recipient_id=users[0].id),  # Bob sends friend request to Alex
    ]

    # Create notifications
    notifications = []

    # Friend request notifications
    for friend_request in friend_requests:
        sender = next((u for u in users if u.id == friend_request.sender_id), None)
        notifications.append(
            notification_manager.create_notification(
                user_id=friend_request.recipient_id,
                message=f"{sender.name} sent you a friend request",
                notification_type="friend_request",
                related_id=friend_request.id
            )
        )

    # Plan invitation notifications
    for plan_invitation in plan_invitations:
        sender = next((u for u in users if u.id == plan_invitation.sender_id), None)
        plan = next((p for p in plans if p.id == plan_invitation.plan_id), None)
        notifications.append(
            notification_manager.create_notification(
                user_id=plan_invitation.recipient_id,
                message=f"{sender.name} invited you to join the plan: {plan.goal}",
                notification_type="plan_invitation",
                related_id=plan_invitation.id
            )
        )

    # Engagement notifications (these are not based on existing data, so we'll keep them as is)
    notifications.extend([
        notification_manager.create_notification(
            user_id=users[0].id,
            message="How's your training going? Let's check in on your progress!",
            notification_type="engagement",
            prompt_tag="user-recurrent-checkin",
            recurrence="daily",
            time_deviation_in_hours=2,
        ),
        notification_manager.create_notification(
            user_id=users[0].id,
            message="Time for your weekly reflection. What have you achieved this week?",
            notification_type="engagement",
            prompt_tag="weekly-reflection",
            recurrence="weekly",
            time_deviation_in_hours=4
        )
    ])

    for user in users:
        users_gateway.permanently_delete_user(user.id)
        users_gateway.create_user(user)
        
    for activity in activities:
        activities_gateway.permanently_delete_activity(activity.id)
        activities_gateway.create_activity(activity)

    for activity_entry in activity_entries:
        activities_gateway.permanently_delete_activity_entry(activity_entry.id)
        activities_gateway.create_activity_entry(activity_entry)

    for plan in plans:
        try:
            plan_controller.permanently_delete_plan(plan.id)
            plan_controller.create_plan(plan)
            users_gateway.add_plan_to_user(plan.user_id, plan.id)
            user = next((u for u in users if u.id == plan.user_id), None)
            user.plan_ids.append(plan.id)
        except Exception as e:
            print(f"Error creating plan {plan.goal}: {str(e)}")
            return

    for invitation in plan_invitations:
        plan_controller.plan_invitation_gateway.create_plan_invitation(invitation)

    for friend_request in friend_requests:
        users_gateway.friend_request_gateway.create_friend_request(friend_request)

    # Add notifications to the database
    for notification in notifications:
        notification_manager.db_gateway.write(notification.dict())
    # Print out the final state

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
            print(f"  Invitees: {', '.join([invitee.name for invitee in plan.invitees])}")
            print(f"  Sessions: {len(plan.sessions)}")

        user_notifications = notification_manager.get_all_for_user(user.id)
        print("Notifications:")
        for notification in user_notifications:
            print(f"- Type: {notification.type}")
            print(f"  Message: {notification.message}")
            print(f"  Status: {notification.status}")

    print("Done! 🎉")

if __name__ == "__main__":
    try:
        generate_dummy_data()
    except Exception as e:
        print(f"Error generating dummy data: {str(e)}")
        print(traceback.format_exc())