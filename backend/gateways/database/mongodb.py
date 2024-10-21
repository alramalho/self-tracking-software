from typing import List, Dict
from pymongo import MongoClient, ASCENDING
from pymongo.collection import Collection
from pymongo.errors import DuplicateKeyError
from pymongo.operations import SearchIndexModel
from bson import ObjectId
from constants import MONGO_DB_CONNECTION_STRING, MONGO_DB_NAME, ENVIRONMENT, JINA_API_KEY
from gateways.database.base import DBGateway
from loguru import logger
import requests
import json

class MongoDBGateway(DBGateway):
    def __init__(self, collection_name: str):
        self.client = MongoClient(MONGO_DB_CONNECTION_STRING)
        db_name = f"{MONGO_DB_NAME.lower()}_{ENVIRONMENT.lower()}"
        self.db = self.client[db_name]
        self.collection: Collection = self.db[collection_name]

    def _convert_from_mongo(self, data: Dict) -> Dict:
        if '_id' in data:
            data['id'] = str(data['_id'])
            del data['_id']
        return data

    def delete_all(self, key: str, value: str) -> None:
        if key == 'id':
            key = '_id'
            if type(value) == str:
                value = ObjectId(value)
        logger.log("DB", f'MongoDB: Deleting from MongoDB ... Key:"{key}" Value:"{value}"')
        result = self.collection.delete_many({key: value})
        logger.log("DB", f"MongoDB: Deleted {result.deleted_count} documents")

    def write(self, data: dict):
        if 'id' in data:
            # Check if document with this id exists
            existing_entries = self.query('id', data['id'])
            if len(existing_entries) > 0:
                # Document exists, use the provided id
                existing_id = existing_entries[0]['id']
                if type(existing_id) == str:
                    data['_id'] = ObjectId(existing_id)
                else:
                    data['_id'] = existing_id
            else:
                # Document doesn't exist, create new ObjectId
                try:
                    data['_id'] = ObjectId(data['id'])
                except Exception as e:
                    logger.error(f"Error creating ObjectId from {data['id']}: {e}. Creating new ObjectId.")
                    data['_id'] = ObjectId()
            del data['id']
        
        # Update embeddings for fields that require it
        for key, value in data.items():
            if key.endswith('_embedding'):
                self._ensure_vector_search_index(key)
                continue  # Skip embedding fields
            embedding_key = f"{key}_embedding"
            if embedding_key in data:
                data[embedding_key] = self._get_embedding(value)

        logger.log("DB", f"MongoDB: Writing to MongoDB ... {data}")
        try:
            result = self.collection.replace_one({'_id': data['_id']}, data, upsert=True)
            logger.log("DB", f"MongoDB: Upserted document with id: {data['_id']}")
        except DuplicateKeyError:
            logger.error(f"Duplicate key error for data: {data}")
            raise

    def _get_embedding(self, text: str) -> List[float]:

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

    def _ensure_vector_search_index(self, key: str):
        index_name = f"{key}_vector_index"
        if index_name not in self.collection.index_information():
            search_index_model = SearchIndexModel(
                definition={
                    "fields": [
                        {
                            "type": "vector",
                            "path": key,
                            "similarity": "euclidean",
                            "numDimensions": 1024
                        }
                    ]
                },
                name=index_name,
                type="vectorSearch",
            )
            try:
                self.collection.create_search_index(model=search_index_model)
                logger.log("DB", f"Created vector search index: {index_name}")
            except Exception as e:
                if "Duplicate Index" in str(e):
                    logger.error(f"Error creating {key} vector search index: Duplicate Index. Continuing...")
                else:
                    raise

    def scan(self) -> List[Dict]:
        logger.log("DB", "MongoDB: Scanning from MongoDB ...")
        return [self._convert_from_mongo(doc) for doc in self.collection.find()]

    def query(self, key: str, value: str) -> List[Dict]:
        if key == 'id':
            key = '_id'
            if type(value) == str:
                value = ObjectId(value)

        logger.log("DB", f'MongoDB: Querying from MongoDB "{self.collection.name}" ... Key:"{key}" Value:"{value}"')
        result = [self._convert_from_mongo(doc) for doc in self.collection.find({key: value})]
        logger.log("DB", "Result: " + str(result))
        return result

    def count(self, key: str, value: str) -> int:
        if key == 'id':
            key = '_id'
            if type(value) == str:
                value = ObjectId(value)
        logger.log("DB", f'MongoDB: Counting in MongoDB ... Key:"{key}" Value:"{value}"')
        return self.collection.count_documents({key: value})

    def close(self):
        if hasattr(self, 'client'):
            self.client.close()

    def __del__(self):
        self.close()

    def vector_search(self, key: str, query: str, exclude_ids: List[str] = [], limit: int = 5) -> List[Dict]:
        if key.endswith("_embedding"):
            embedding_key = key
        else:
            embedding_key = f"{key}_embedding"

        exclude_ids = [ObjectId(id) for id in exclude_ids if type(id) == str]

        index_name = f"{embedding_key}_vector_index"
        query_embedding = self._get_embedding(query)

        logger.log("DB", f"MongoDB: Performing vector search in {self.collection.name}")
        pipeline = [
            {
                "$vectorSearch": {
                    "index": index_name,
                    "queryVector": query_embedding,
                    "path": embedding_key,
                    "numCandidates": 100,
                    "limit": limit
                }
            },
            {
                "$match": {
                    "_id": {"$nin": exclude_ids}
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "id": {"$toString": "$_id"},
                    key: 1,
                    "score": {"$meta": "vectorSearchScore"}
                }
            }
        ]
        
        logger.log("DB", f"MongoDB: Doing vector search for index: {index_name}")
        results = list(self.collection.aggregate(pipeline))
        logger.log("DB", f"MongoDB: Vector search returned {len(results)} results")
        return results # co
