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
        self.db_gateway = MongoDBGateway("activities")

    def get_all_activities_by_user_id(self, user_id:str) -> list[Activity]:
        return [Activity(**data) for data in self.db_gateway.query("user_id", user_id)]
    
    def get_all_activity_entries_by_activity_id(self, activity_id: str) -> list[ActivityEntry]:
        return [Activity(**data) for data in self.db_gateway.query("activity_id", activity_id)]

    def create_activity(self, activity: Activity) -> Activity:
        if len(self.db_gateway.query("id", activity.id)) != 0:
            logger.info(f"Activity {activity.id} ({activity.name}) already exists")
            raise ActivityAlreadyExistsException()
        self.db_gateway.write(activity.dict())
        logger.info(f"Activity {activity.id} ({activity.name}) created")
        return activity

    def delete_activity(self, activity_id: str):
        activity = self.get_activity_by_id(activity_id)
        activity.deleted = True
        activity.deleted_at = datetime.datetime.now(datetime.UTC).isoformat()
        self.db_gateway.write(activity.dict())
        logger.info(f"Activity {activity.id} ({activity.name}) marked as deleted")
    

if __name__ == "__main__":
    from gateways.database.mongodb import MongoDBGateway

    gateway = ActivitiesGateway(MongoDBGateway("activities"))

    activity = Activity(name="Alex", email="alexandre.ramalho.1998@gmail.com")
    gateway.create_activity(activity)