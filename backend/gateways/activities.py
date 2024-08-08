import datetime

from entities.activity import Activity
from entities.activity import Activity, ActivityEntry
from gateways.database.mongodb import MongoDBGateway
from loguru import logger

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
        return self.activities_db_gateway.query("id", activity_id)
    
    def get_activity_entry_by_id(self, activity_entry_id:str) -> Activity:
        return self.activitiy_entries_db_gateway.query("id", activity_entry_id)
        
    def get_all_activities_by_user_id(self, user_id:str) -> list[Activity]:
        return [Activity(**data) for data in self.activities_db_gateway.query("user_id", user_id)]
    
    def get_all_activity_entries_by_activity_id(self, activity_id: str) -> list[ActivityEntry]:
        return [Activity(**data) for data in self.activitiy_entries_db_gateway.query("activity_id", activity_id)]

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