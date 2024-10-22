from shared.logger import create_logger
create_logger(level="INFO")
import datetime
from datetime import timedelta

from entities.user import User
from entities.activity import Activity, ActivityEntry
from entities.plan import Plan, PlanSession, PlanInvitee
from entities.plan_invitation import PlanInvitation
from entities.friend_request import FriendRequest
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway
from controllers.plan_controller import PlanController
from bson import ObjectId

def generate_dummy_data():
    users_gateway = UsersGateway()
    activities_gateway = ActivitiesGateway()
    plans_controller = PlanController()

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
        PlanInvitation.new(plan_id=plans[0].id, sender_id=users[1].id, recipient_id=users[0].id),  # Alice invites Alex
        PlanInvitation.new(plan_id=plans[1].id, sender_id=users[2].id, recipient_id=users[0].id),  # Bob invites Alex
        PlanInvitation.new(plan_id=plans[2].id, sender_id=users[3].id, recipient_id=users[0].id),  # Charlie invites Alex
    ]

    # Create friend requests
    friend_requests = [
        FriendRequest.new(sender_id=users[1].id, recipient_id=users[0].id),  # Alice sends friend request to Alex
        FriendRequest.new(sender_id=users[2].id, recipient_id=users[0].id),  # Bob sends friend request to Alex
    ]

    for user in users:
        try:
            users_gateway.permanently_delete_user(user.id)
            users_gateway.create_user(user)
        except Exception as e:
            print(f"Error creating user {user.name}: {str(e)}")
            return
        
    for activity in activities:
        try:
            activities_gateway.permanently_delete_activity(activity.id)
            activities_gateway.create_activity(activity)
        except Exception as e:
            print(f"Error creating activity {activity.title}: {str(e)}")
            return

    for activity_entry in activity_entries:
        try:
            activities_gateway.permanently_delete_activity_entry(activity_entry.id)
            activities_gateway.create_activity_entry(activity_entry)
        except Exception as e:
            print(f"Error creating entry for {activity_entry.activity_id}: {str(e)}")
            return

    for plan in plans:
        try:
            plans_controller.permanently_delete_plan(plan.id)
            plans_controller.create_plan(plan)
            users_gateway.add_plan_to_user(plan.user_id, plan.id)
            user = next((u for u in users if u.id == plan.user_id), None)
            user.plan_ids.append(plan.id)
        except Exception as e:
            print(f"Error creating plan {plan.goal}: {str(e)}")
            return

    for invitation in plan_invitations:
        try:
            plans_controller.plan_invitation_gateway.write(invitation.dict())
            recipient = next((u for u in users if u.id == invitation.recipient_id), None)
            recipient.pending_plan_invitations.append(invitation.id)
            users_gateway.update_user(recipient)
        except Exception as e:
            print(f"Error creating plan invitation: {str(e)}")
            return

    for friend_request in friend_requests:
        try:
            users_gateway.friend_request_gateway.write(friend_request.dict())
            recipient = next((u for u in users if u.id == friend_request.recipient_id), None)
            recipient.pending_friend_requests.append(friend_request.id)
            users_gateway.update_user(recipient)
        except Exception as e:
            print(f"Error creating friend request: {str(e)}")
            return

    # Print out the final state
    print("\nFinal state:")
    for user in users:
        user_data = users_gateway.get_user_by_id(user.id)
        print(f"\nUser: {user_data.name} (username: {user_data.username})")
        print(f"Friends: {', '.join([users_gateway.get_user_by_id(friend_id).name for friend_id in user_data.friend_ids])}")
        print(f"Pending Plan Invitations: {len(user_data.pending_plan_invitations)}")
        print(f"Pending Friend Requests: {len(user_data.pending_friend_requests)}")
        
        user_activities = activities_gateway.get_all_activities_by_user_id(user.id)
        print("Activities:")
        for activity in user_activities:
            print(f"- {activity.title}")
            entries = activities_gateway.get_all_activity_entries_by_activity_id(activity.id)
            for entry in entries:
                print(f"  * {entry.date}: {entry.quantity} {activity.measure}")
        
        user_plans = plans_controller.get_plans(user.plan_ids)
        print("Plans:")
        for plan in user_plans:
            print(f"- {plan.goal} (Finishing date: {plan.finishing_date})")
            print(f"  Invitees: {', '.join([invitee.name for invitee in plan.invitees])}")
            print(f"  Sessions: {len(plan.sessions)}")

    print("Done! 🎉")

if __name__ == "__main__":
    generate_dummy_data()
