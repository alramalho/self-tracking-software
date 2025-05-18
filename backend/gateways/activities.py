from datetime import datetime, UTC, timedelta

from entities.activity import Activity, ActivityEntry, Comment
from gateways.database.mongodb import MongoDBGateway
from gateways.database.dynamodb import DynamoDBGateway
from loguru import logger
from shared.utils import days_ago
from typing import List, Optional
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
        self.activities_db_gateway = DynamoDBGateway("activities")
        self.activity_entries_db_gateway = DynamoDBGateway("activity_entries")

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
    
    def get_readable_activity_entry(self, activity_entry: ActivityEntry, activity: Optional[Activity] = None) -> str:
        if activity is None:
            activity = self.get_activity_by_id(activity_entry.activity_id)
            
        formatted_date = datetime.fromisoformat(activity_entry.date).strftime("%A, %b %d %Y")
        quantity = activity_entry.quantity
        activity_title = activity.title
        activity_measure = activity.measure
        
        return f"{formatted_date} ({days_ago(activity_entry.date)}) - {activity_title} ({quantity} {activity_measure})"

    def get_recent_activity_entries(self, user_id: str, past_day_limit: int = 7) -> tuple[dict[str, Activity], list[ActivityEntry]]:
        all_activities_dict = {activity.id: activity for activity in self.get_all_activities_by_user_id(user_id)}

        if len(all_activities_dict) == 0:
            return all_activities_dict, []

        all_activity_entries: List[ActivityEntry] = []
        for activity_id in all_activities_dict.keys():
            all_activity_entries.extend(self.get_all_activity_entries_by_activity_id(activity_id))

        ordered_activity_entries = sorted(all_activity_entries, key=lambda x: x.date, reverse=True)
        
        # Filter entries within the past_day_limit using timedelta for accurate comparison
        current_date = datetime.now(UTC)
        filtered_entries = []
        for entry in ordered_activity_entries:
            entry_date = datetime.fromisoformat(entry.date)
            if entry_date.tzinfo is None:
                entry_date = entry_date.replace(tzinfo=UTC)
            if (current_date - entry_date) <= timedelta(days=past_day_limit):
                filtered_entries.append(entry)
                
        return all_activities_dict, filtered_entries

    def get_readable_recent_activity_entries(self, user_id: str, limit: int = 5, past_day_limit: int = 7) -> str:
        all_activities_dict, ordered_activity_entries = self.get_recent_activity_entries(user_id, past_day_limit)

        if len(all_activities_dict) == 0:
            return f"(User has not done any activities during the past {past_day_limit} days)"
        
        readable_activity_entries = [
            self.get_readable_activity_entry(activity_entry, all_activities_dict[activity_entry.activity_id])
            for activity_entry in ordered_activity_entries
        ]

        return "\n".join(readable_activity_entries)
    
    def get_most_recent_activity_entries(self, user_id: str, limit: int = 5) -> List[ActivityEntry]:
        all_activity_entries = self.get_all_activity_entries_by_user_id(user_id)
        ordered_activity_entries = sorted(all_activity_entries, key=lambda x: x.date, reverse=True)
        return ordered_activity_entries[:limit]
    
    def get_most_recent_activity_entries_for_users(self, user_ids: List[str], limit: int = 5) -> List[ActivityEntry]:
        all_activity_entries = self.activity_entries_db_gateway.query_by_criteria({
            "user_id": {"$in": user_ids},
            "$sort": {"created_at": -1}
        }, limit=limit)
        
        return [ActivityEntry(**data) for data in all_activity_entries]
    
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

    def add_comment(self, activity_entry_id: str, text: str, user: User) -> ActivityEntry:
        activity_entry = self.get_activity_entry_by_id(activity_entry_id)
        if activity_entry is None:
            raise ActivityEntryDoesNotExistException()
        
        # Create and add comment
        comment = Comment.new(
            user_id=user.id,
            username=user.username,
            text=text,
            picture=user.picture
        )
        
        if not hasattr(activity_entry, 'comments') or activity_entry.comments is None:
            activity_entry.comments = []
            
        activity_entry.comments.append(comment)
        self.activity_entries_db_gateway.write(activity_entry.dict())
        logger.info(f"Comment added to ActivityEntry {activity_entry_id} by user {user.username}")
        
        return activity_entry
        
    def remove_comment(self, activity_entry_id: str, comment_id: str, user: User) -> ActivityEntry:
        activity_entry = self.get_activity_entry_by_id(activity_entry_id)
        if activity_entry is None:
            raise ActivityEntryDoesNotExistException()
        
        if not hasattr(activity_entry, 'comments') or not activity_entry.comments:
            return activity_entry
            
        # Find the comment
        comment_index = None
        for i, comment in enumerate(activity_entry.comments):
            if comment.id == comment_id:
                # Only allow comment deletion by the owner or the activity entry owner
                if comment.user_id == user.id or activity_entry.user_id == user.id:
                    comment_index = i
                break
                
        if comment_index is not None:
            # Just mark as deleted or remove completely
            comment = activity_entry.comments[comment_index]
            comment.deleted_at = datetime.now(UTC).isoformat()
            self.activity_entries_db_gateway.write(activity_entry.dict())
            logger.info(f"Comment {comment_id} removed from ActivityEntry {activity_entry_id} by user {user.username}")
            
        return activity_entry
        

if __name__ == "__main__":
    from gateways.database.mongodb import MongoDBGateway
    from shared.logger import create_logger
    create_logger()

    gateway = ActivitiesGateway()

    print([activity.id for activity in gateway.get_all_activities_by_user_id("666666666666666666666665")])
