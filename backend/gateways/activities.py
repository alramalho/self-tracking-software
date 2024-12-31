from datetime import datetime, UTC

from entities.activity import Activity, ActivityEntry
from gateways.database.mongodb import MongoDBGateway
from loguru import logger
from shared.utils import days_ago
from typing import List
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from entities.user import User
class ActivityDoesNotExistException(Exception):
    pass


class ActivityAlreadyExistsException(Exception):
    pass


class ActivityEntryDoesNotExistException(Exception):
    pass


class ActivityEntryAlreadyExistsException(Exception):
    pass


# todo: this activities gateway now has permissions and CRUD responsiblities... we should split?
class ActivitiesGateway:
    def __init__(self,):
        self.activities_db_gateway = MongoDBGateway("activities")
        self.activity_entries_db_gateway = MongoDBGateway("activity_entries")

    def get_activity_by_id(self, activity_id:str) -> Activity:
        data = self.activities_db_gateway.query("id", activity_id)
        if len(data) > 0:
            return Activity(**data[0])
        else:
            return None
    
    def get_activity_entry_by_id(self, activity_entry_id:str) -> ActivityEntry:
        data = self.activity_entries_db_gateway.query("id", activity_entry_id)
        if len(data) > 0:
            return ActivityEntry(**data[0])
        else:
            return None
        
    def get_activity_entry_by_activity_and_date(self, activity_id: str, date: str) -> ActivityEntry:
        entries = self.activity_entries_db_gateway.query("activity_id", activity_id)
        for entry in entries:
            if entry["date"] == date:
                return ActivityEntry(**entry)
        return None

    def get_all_activity_entries_by_user_id(self, user_id: str) -> List[ActivityEntry]:
        return [ActivityEntry(**data) for data in self.activity_entries_db_gateway.query("user_id", user_id)]
        
    def get_all_activities(self) -> list[Activity]:
        return [Activity(**data) for data in self.activities_db_gateway.scan()]
    
    def get_all_activites_by_ids(self, activity_ids: list[str]) -> list[Activity]:
        return [Activity(**data) for data in self.activities_db_gateway.query("id", {"$in": [ObjectId(activity_id) for activity_id in activity_ids]})]
        
    def get_all_activities_by_user_id(self, user_id:str) -> list[Activity]:
        return [Activity(**data) for data in self.activities_db_gateway.query("user_id", user_id)]
    
    def get_all_activity_entries_by_activity_id(self, activity_id: str) -> list[ActivityEntry]:
        return [ActivityEntry(**data) for data in self.activity_entries_db_gateway.query("activity_id", activity_id)]
    
    def get_readable_recent_activity_entries(self, user_id: str, limit: int = 5, past_day_limit: int = 7) -> str:
        all_activities_dict = {activity.id: activity for activity in self.get_all_activities_by_user_id(user_id)}

        if len(all_activities_dict) == 0:
            return f"(User has not done any activities during the past {past_day_limit} days)"

        all_activity_entries: List[ActivityEntry] = []
        for activity_id in all_activities_dict.keys():
            all_activity_entries.extend(self.get_all_activity_entries_by_activity_id(activity_id))

        ordered_activity_entries = sorted(all_activity_entries, key=lambda x: x.created_at, reverse=True)
        
        if past_day_limit is not None:
            # Filter entries within the past_day_limit
            current_date = datetime.now(UTC)
            filtered_entries = [
                entry for entry in ordered_activity_entries 
                if (current_date - datetime.fromisoformat(entry.created_at)).days <= past_day_limit
            ]
            ordered_activity_entries = filtered_entries
        else:
            # Apply limit only if past_day_limit is not specified
            ordered_activity_entries = ordered_activity_entries[:limit]
        
        # return the date of the entry in the format 'Oct 27, 2024' + the title of the respective activity
        readable_activity_entries: List[str] = []
        for activity_entry in ordered_activity_entries:
            respective_activity = all_activities_dict[activity_entry.activity_id]

            formatted_date = datetime.fromisoformat(activity_entry.date).strftime("%A, %b %d %Y")
            quantity = activity_entry.quantity
            activity_title = respective_activity.title
            activity_measure = respective_activity.measure
            
            readable_activity_entries.append(f"{formatted_date} ({days_ago(activity_entry.date)}) - {activity_title} ({quantity} {activity_measure})")

        return "\n".join(readable_activity_entries)
    
    def get_most_recent_activity_entries(self, user_id: str, limit: int = 5) -> List[ActivityEntry]:
        all_activity_entries = self.get_all_activity_entries_by_user_id(user_id)
        ordered_activity_entries = sorted(all_activity_entries, key=lambda x: x.created_at, reverse=True)
        return ordered_activity_entries[:limit]

    def create_activity(self, activity: Activity) -> Activity:
        if len(self.activities_db_gateway.query("id", activity.id)) != 0:
            logger.info(f"Activity {activity.id} ({activity.title}) already exists")
            raise ActivityAlreadyExistsException()
        try:
            self.activities_db_gateway.write(activity.dict())
            logger.info(f"Activity {activity.id} ({activity.title}) created")
            return activity
        except DuplicateKeyError as e: # todo, this activities gateway should be mongo agnostic
            logger.error(f"Error creating activity: Activity {activity.id} ({activity.title}) already exists")
        except Exception as e:
            logger.error(f"Error creating activity: {e}")
            raise
        
    
    def create_activity_entry(self, activity_entry: ActivityEntry) -> ActivityEntry:
        activity = self.get_activity_by_id(activity_entry.activity_id)
        if activity is None:
            raise ActivityDoesNotExistException(f"Activity with id {activity_entry.activity_id} does not exist")

        existing_entry = self.get_activity_entry_by_activity_and_date(activity_entry.activity_id, activity_entry.date)
        if existing_entry:
            raise ActivityEntryAlreadyExistsException(
                f"ActivityEntry for activity {activity.title} on date {activity_entry.date} already exists"
            )

        try:
            self.activity_entries_db_gateway.write(activity_entry.dict())
            logger.info(f"ActivityEntry ({activity.title} for date {activity_entry.date}) created")
            return activity_entry
        except Exception as e:
            logger.error(f"Error creating activity entry: {e}")
            raise

    def update_activity(self, activity: Activity) -> Activity:
        existing_activity = self.get_activity_by_id(activity.id)
        if existing_activity is None:
            logger.info(f"Activity {activity.id} does not exist")
            raise ActivityDoesNotExistException()
        self.activities_db_gateway.write(activity.dict())
        logger.info(f"Activity {activity.id} updated")
        return activity

    def update_activity_entry(self, activity_entry_id: str, updates: dict) -> ActivityEntry:
        activity_entry = self.get_activity_entry_by_id(activity_entry_id)
        if activity_entry is None:
            logger.info(f"ActivityEntry {activity_entry_id} does not exist")
            raise ActivityEntryDoesNotExistException()
        for key, value in updates.items():
            setattr(activity_entry, key, value)
        self.activity_entries_db_gateway.write(activity_entry.dict())
        logger.info(f"ActivityEntry {activity_entry_id} updated")
        return activity_entry
    
    def delete_activity(self, activity_id: str):
        activity = self.get_activity_by_id(activity_id)
        activity.deleted_at = datetime.now(UTC).isoformat()
        self.activities_db_gateway.write(activity.dict())
        logger.info(f"Activity {activity.id} ({activity.title}) marked as deleted")

    def delete_activity_entry(self, activity_entry_id: str):
        activity_entry = self.get_activity_entry_by_id(activity_entry_id)
        activity_entry.deleted_at = datetime.now(UTC).isoformat()
        self.activity_entries_db_gateway.write(activity_entry.dict())
        logger.info(f"ActivityEntry {activity_entry_id} marked as deleted")

    def permanently_delete_activity(self, activity_id: str):
        self.activities_db_gateway.delete_all('id', activity_id)
        logger.info(f"Activity {activity_id} forever deleted")

    def permanently_delete_activity_entry(self, activity_entry_id: str):
        self.activity_entries_db_gateway.delete_all('id', activity_entry_id)
        logger.info(f"ActivityEntry {activity_entry_id} forever deleted")

    def add_reaction(self, activity_entry_id: str, emoji: str, user: User) -> ActivityEntry:
        activity_entry = self.get_activity_entry_by_id(activity_entry_id)
        if activity_entry is None:
            raise ActivityEntryDoesNotExistException()
        
        # Initialize reactions for this emoji if it doesn't exist
        if emoji not in activity_entry.reactions:
            activity_entry.reactions[emoji] = []
        
        # Add user_id if not already reacted
        if user.username not in activity_entry.reactions[emoji]:
            activity_entry.reactions[emoji].append(user.username)
            self.activity_entries_db_gateway.write(activity_entry.dict())
        
        return activity_entry

    def remove_reaction(self, activity_entry_id: str, emoji: str, user: User) -> ActivityEntry:
        activity_entry = self.get_activity_entry_by_id(activity_entry_id)
        if activity_entry is None:
            raise ActivityEntryDoesNotExistException()
        
        if emoji in activity_entry.reactions and user.username in activity_entry.reactions[emoji]:
            activity_entry.reactions[emoji].remove(user.username)
            # Remove the emoji key if no users are left
            if not activity_entry.reactions[emoji]:
                del activity_entry.reactions[emoji]
            self.activity_entries_db_gateway.write(activity_entry.dict())
        
        return activity_entry

    def is_activity_in_any_active_plan(self, activity_id: str) -> bool:
        plans_db_gateway = MongoDBGateway("plans")
        
        current_date = datetime.now(UTC).isoformat()
        active_plans = plans_db_gateway.query_by_criteria({'sessions.activity_id': activity_id, 'finishing_date': {'$gte': current_date}})
        
        return len(active_plans) > 0


if __name__ == "__main__":
    from gateways.database.mongodb import MongoDBGateway
    from shared.logger import create_logger
    create_logger()

    gateway = ActivitiesGateway()

    print([activity.id for activity in gateway.get_all_activities_by_user_id("666666666666666666666665")])
