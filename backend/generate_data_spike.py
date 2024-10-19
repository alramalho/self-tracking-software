from shared.logger import create_logger
create_logger(level="INFO")
import datetime

from entities.user import User
from entities.activity import Activity, ActivityEntry
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway
from bson.objectid import ObjectId

def generate_dummy_data():
    users_gateway = UsersGateway()
    activities_gateway = ActivitiesGateway()

    # Create 3 users
    users = [
        User.new(id=str(ObjectId("666666666666666666666666")), name="Alice", email="alice@example.com"),
        User.new(id=str(ObjectId("666666666666666666666667")), name="Bob", email="bob@example.com"),
        User.new(id=str(ObjectId("666666666666666666666668")), name="Charlie", email="charlie@example.com")
    ]
    # Create 6 activities
    activities = [
        Activity.new(id=str(ObjectId("666666666666666666666669")), user_id=users[0].id, title="Running", measure="kilometers", emoji="🏃"),
        Activity.new(id=str(ObjectId("66666666666666666666666a")), user_id=users[1].id, title="Meditation", measure="minutes", emoji="🧘"),
        Activity.new(id=str(ObjectId("66666666666666666666666b")), user_id=users[2].id, title="Push-ups", measure="repetitions", emoji="💪"),
        Activity.new(id=str(ObjectId("66666666666666666666666c")), user_id=users[0].id, title="Cycling", measure="kilometers", emoji="🚴"),
        Activity.new(id=str(ObjectId("66666666666666666666666d")), user_id=users[1].id, title="Swimming", measure="laps", emoji="🏊"),
        Activity.new(id=str(ObjectId("66666666666666666666666e")), user_id=users[2].id, title="Yoga", measure="minutes", emoji="🧘‍♀️")
    ]

    activity_entries = [
        ActivityEntry.new(id=str(ObjectId("66666666666666666666666f")), activity_id=activities[0].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666670")), activity_id=activities[1].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666671")), activity_id=activities[2].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666672")), activity_id=activities[3].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666673")), activity_id=activities[4].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666674")), activity_id=activities[5].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666675")), activity_id=activities[0].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666676")), activity_id=activities[1].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666677")), activity_id=activities[2].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666678")), activity_id=activities[3].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("666666666666666666666679")), activity_id=activities[4].id, quantity=10, date=datetime.datetime.now().isoformat()),
        ActivityEntry.new(id=str(ObjectId("66666666666666666666667a")), activity_id=activities[5].id, quantity=10, date=datetime.datetime.now().isoformat()),
    ]

    for user in users:
        try:
            users_gateway.permanently_delete_user(user.id)
            print(f"Permanently deleted user: {user.name}")
            users_gateway.create_user(user)
            print(f"Created user: {user.name}")
        except Exception as e:
            print(f"Error creating user {user.name}: {str(e)}")
            return
        
    for activity in activities:
        try:
            activities_gateway.permanently_delete_activity(activity.id)
            print(f"Permanently deleted activity: {activity.title} for user {activity.user_id}")
            activities_gateway.create_activity(activity)
            print(f"Created activity: {activity.title} for user {activity.user_id}")
        except Exception as e:
            print(f"Error creating activity {activity.title}: {str(e)}")
            return


    for activity_entry in activity_entries:
        try:
            activities_gateway.permanently_delete_activity_entry(activity_entry.id)
            print(f"Permanently deleted entry for {activity_entry.activity_id} on {activity_entry.date} for activity {activity_entry.activity_id}")
            activities_gateway.create_activity_entry(activity_entry)
            print(f"Created entry for {activity_entry.activity_id} on {activity_entry.date} for activity {activity_entry.activity_id}")
        except Exception as e:
            print(f"Error creating entry for {activity_entry.activity_id}: {str(e)}")
            return


    # Print out the final state
    print("\nFinal state:")
    for user in users:
        user_data = users_gateway.get_user_by_id(user.id)
        print(f"\nUser: {user_data.name}")
        print(f"Friends: {', '.join([users_gateway.get_user_by_id(friend_id).name for friend_id in user_data.friend_ids])}")
        user_activities = activities_gateway.get_all_activities_by_user_id(user.id)
        print("Activities:")
        for activity in user_activities:
            print(f"- {activity.title}")
            entries = activities_gateway.get_all_activity_entries_by_activity_id(activity.id)
            for entry in entries:
                print(f"  * {entry.date}: {entry.quantity} {activity.measure}")


    print("Done! 🎉")

if __name__ == "__main__":
    generate_dummy_data()