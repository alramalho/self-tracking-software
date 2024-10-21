from typing import List, Dict
from pymongo import MongoClient
from bson import ObjectId
from constants import MONGO_DB_CONNECTION_STRING, MONGO_DB_NAME, ENVIRONMENT
from entities.activity import Activity, SAMPLE_SEARCH_ACTIVITY
from loguru import logger
import requests
import json
from constants import JINA_API_KEY

SAMPLE_SEARCH_ACTIVITY = Activity.new(
    user_id="666666666666666666666666",
    title="Running",
    measure="kilometers",
    emoji="🏃",
)

def get_embedding(text: str) -> List[float]:
    url = "https://api.jina.ai/v1/embeddings"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {JINA_API_KEY}"
    }
    data = {
        "model": "jina-embeddings-v3",
        "task": "text-matching",
        "dimensions": 1024,
        "late_chunking": False,
        "embedding_type": "float",
        "input": [text]
    }

    response = requests.post(url, headers=headers, data=json.dumps(data))
    response_json = response.json()

    if response.status_code == 200 and 'data' in response_json:
        return response_json['data'][0]['embedding']
    else:
        logger.error(f"Error getting embedding: {response.status_code}, {response_json}")
        return [0.0] * 1024  # Return a default embedding in case of error

def vector_search(query: str, exclude_key: str = None, exclude_value: str = None, limit: int = 5) -> List[Dict]:
    client = MongoClient(MONGO_DB_CONNECTION_STRING)
    db_name = f"{MONGO_DB_NAME.lower()}_{ENVIRONMENT.lower()}"
    db = client[db_name]
    collection = db["activities"]

    embedding_key = "title_embedding"
    index_name = f"{embedding_key}_vector_index"
    query_embedding = get_embedding(query)

    logger.info(f"MongoDB: Performing vector search in activities for query: {query} (index: {index_name})")
    pipeline = [
        {
            "$vectorSearch": {
                "index": index_name,
                "filter": {exclude_key: {"$ne": exclude_value}} if exclude_key and exclude_value else {},
                "path": embedding_key,
                "queryVector": query_embedding,
                "numCandidates": 100,
                "limit": limit
            }
        },
        {
            "$project": {
                "_id": 0,
                "id": {"$toString": "$_id"},
                "title": 1,
                "measure": 1,
                "emoji": 1,
                "user_id": 1,
                "score": {"$meta": "vectorSearchScore"}
            }
        }
    ]
    
    results = list(collection.aggregate(pipeline))
    logger.info(f"MongoDB: Vector search returned {len(results)} results for query: {query}")
    client.close()
    return results

def get_recommended_activities(query: str, user_id: str, limit: int = 5) -> List[Activity]:
    logger.info(f"Getting recommended activities for query: {query}")
    top_activity_objs = vector_search(
        query,
        exclude_key="user_id",
        exclude_value=user_id,
        limit=limit,
    )
    logger.info(f"Got {len(top_activity_objs)} activities for query: {query}")

    top_activities = [
        Activity(
            id=a["id"],
            user_id=a["user_id"],
            title=a["title"],
            measure=a["measure"],
            emoji=a["emoji"],
            created_at=""  # We don't have this in the search results, so leaving it empty
        )
        for a in top_activity_objs
    ]

    return top_activities

def get_user_name(user_id: str) -> str:
    client = MongoClient(MONGO_DB_CONNECTION_STRING)
    db_name = f"{MONGO_DB_NAME.lower()}_{ENVIRONMENT.lower()}"
    db = client[db_name]
    users_collection = db["users"]

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    client.close()

    if user and "name" in user:
        return user["name"]
    return "Unknown User"

if __name__ == "__main__":
    from shared.logger import create_logger
    create_logger(level="INFO")

    # Example usage
    query = "running, swimming"
    user_id = "666666666666666666666665"
    recommended_activities = get_recommended_activities(query, user_id)

    print("Recommended Activities:")
    for activity in recommended_activities:
        user_name = get_user_name(activity.user_id)
        print(f"- {activity.emoji} {activity.title} (measured in {activity.measure}), from user {user_name} ({activity.user_id})")
