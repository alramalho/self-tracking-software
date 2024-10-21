from pymongo import MongoClient
from constants import MONGO_DB_CONNECTION_STRING, MONGO_DB_NAME, ENVIRONMENT
from loguru import logger
from bson import ObjectId
from typing import List, Optional
from do_mongo_query import get_embedding

def rerun_activity_embeddings(user_id: Optional[str] = None):
    client = MongoClient(MONGO_DB_CONNECTION_STRING)
    db_name = f"{MONGO_DB_NAME.lower()}_{ENVIRONMENT.lower()}"
    db = client[db_name]
    activities_collection = db["activities"]

    # Prepare the query
    query = {}
    if user_id:
        query["user_id"] = user_id

    # Get all activities (or activities for a specific user)
    activities = activities_collection.find(query)

    updated_count = 0
    for activity in activities:
        title = activity.get("title", "")
        if title:
            new_embedding = get_embedding(title)
            
            # Update the activity with the new embedding
            result = activities_collection.update_one(
                {"_id": activity["_id"]},
                {"$set": {"title_embedding": new_embedding}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                logger.info(f"Updated embedding for activity: {title}")
            else:
                logger.warning(f"Failed to update embedding for activity: {title}")
        else:
            logger.warning(f"Activity with id {activity['_id']} has no title, skipping")

    logger.info(f"Updated embeddings for {updated_count} activities")
    client.close()

if __name__ == "__main__":
    from shared.logger import create_logger
    create_logger(level="INFO")

    import argparse
    parser = argparse.ArgumentParser(description="Rerun embeddings for activities")
    parser.add_argument("--user_id", type=str, help="User ID to rerun embeddings for (optional)")
    args = parser.parse_args()

    if args.user_id:
        logger.info(f"Rerunning embeddings for activities of user: {args.user_id}")
        rerun_activity_embeddings(args.user_id)
    else:
        logger.info("Rerunning embeddings for all activities")
        rerun_activity_embeddings()
