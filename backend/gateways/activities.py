import datetime

from entities.activity import Activity
from entities.activity import Activity, ActivityEntry
from gateways.database.mongodb import MongoDBGateway
from loguru import logger
from shared.utils import time_ago
from typing import List
class ActivityDoesNotExistException(Exception):
    pass


class ActivityAlreadyExistsException(Exception):
    pass


# todo: this activities gateway now has permissions and CRUD responsiblities... we should split?
class ActivitiesGateway:
    def __init__(self,):
        self.activities_db_gateway = MongoDBGateway("activities")
        self.activitiy_entries_db_gateway = MongoDBGateway("activity_entries")

    def get_activity_by_id(self, activity_id:str) -> Activity:
        data = self.activities_db_gateway.query("id", activity_id)
        if len(data) > 0:
            return Activity(**data[0])
        else:
            return None
    
    def get_activity_entry_by_id(self, activity_entry_id:str) -> Activity:
        data = self.activitiy_entries_db_gateway.query("id", activity_entry_id)
        if len(data) > 0:
            return ActivityEntry(**data[0])
        else:
            return None
        
    def get_all_activities_by_user_id(self, user_id:str) -> list[Activity]:
        return [Activity(**data) for data in self.activities_db_gateway.query("user_id", user_id)]
    
    def get_all_activity_entries_by_activity_id(self, activity_id: str) -> list[ActivityEntry]:
        return [ActivityEntry(**data) for data in self.activitiy_entries_db_gateway.query("activity_id", activity_id)]
    
    def get_readable_recent_activity_entries(self, user_id: str, limit: int = 5) -> str:
        all_activities_dict = {activity.id: activity for activity in self.get_all_activities_by_user_id(user_id)}

        all_activity_entries: List[ActivityEntry] = []
        for activity_id in all_activities_dict.keys():
            all_activity_entries.extend(self.get_all_activity_entries_by_activity_id(activity_id))

        ordered_activity_entries = sorted(all_activity_entries, key=lambda x: x.created_at, reverse=True)
        
        # not return the time ago of the entry + the title of the respecitve activity
        readable_activity_entries: List[str] = []
        for activity_entry in ordered_activity_entries[:limit]:
            respective_activity = all_activities_dict[activity_entry.activity_id]

            readable_time_ago = time_ago(activity_entry.created_at)
            quantity = activity_entry.quantity
            activity_title = respective_activity.title
            activity_measure = respective_activity.measure
            
            readable_activity_entries.append(f"{readable_time_ago} - {activity_title} ({quantity} {activity_measure})")

        return "\n".join(readable_activity_entries)
    

    def create_activity(self, activity: Activity) -> Activity:
        if len(self.activities_db_gateway.query("id", activity.id)) != 0:
            logger.info(f"Activity {activity.id} ({activity.title}) already exists")
            raise ActivityAlreadyExistsException()
        self.activities_db_gateway.write(activity.dict())
        logger.info(f"Activity {activity.id} ({activity.title}) created")
        return activity
    
    def create_activity_entry(self, activity_entry: ActivityEntry) -> ActivityEntry:
        activity = self.get_activity_by_id(activity_entry.activity_id)
        if len(self.activitiy_entries_db_gateway.query("id", activity_entry.id)) != 0:
            logger.info(f"ActivityEntry ({activity.title} for date {activity_entry.date}) already exists")
            raise ActivityAlreadyExistsException()
        self.activitiy_entries_db_gateway.write(activity_entry.dict())
        logger.info(f"ActivityEntry ({activity.title} for date {activity_entry.date}) created")
        return activity_entry

    def update_activity(self, activity: Activity) -> Activity:
        existing_activity = self.get_activity_by_id(activity.id)
        if existing_activity is None:
            logger.info(f"Activity {activity.id} does not exist")
            raise ActivityDoesNotExistException()
        updated_activity = self.activities_db_gateway.write(activity.dict())
        logger.info(f"Activity {activity.id} updated")
        return Activity(**updated_activity)

    def delete_activity(self, activity_id: str):
        activity = self.get_activity_by_id(activity_id)
        activity.deleted = True
        activity.deleted_at = datetime.datetime.now(datetime.UTC).isoformat()
        self.activities_db_gateway.write(activity.dict())
        logger.info(f"Activity {activity.id} ({activity.title}) marked as deleted")
    

if __name__ == "__main__":
    from gateways.database.mongodb import MongoDBGateway

    gateway = ActivitiesGateway(MongoDBGateway("activities"))

    activity = Activity(name="Alex", email="alexandre.ramalho.1998@gmail.com")
    gateway.create_activity(activity)