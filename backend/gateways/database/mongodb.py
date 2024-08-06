from typing import List, Dict
from pymongo import MongoClient
from pymongo.collection import Collection
from bson import ObjectId
from constants import MONGO_DB_CONNECTION_STRING, MONGO_DB_NAME, ENVIRONMENT
from gateways.database.base import DBGateway
from loguru import logger

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
        logger.info(f'MongoDB: Deleting from MongoDB ... Key:"{key}" Value:"{value}"')
        result = self.collection.delete_many({key: value})
        logger.info(f"MongoDB: Deleted {result.deleted_count} documents")

    def write(self, data: dict):
        if 'id' in data:
            # Check if document with this id exists
            existing = self.collection.find_one({'_id': data['id']})
            if existing:
                # Document exists, use the provided id
                data['_id'] = data['id']
            else:
                # Document doesn't exist, create new ObjectId
                data['_id'] = ObjectId()
            del data['id']
        
        logger.info(f"MongoDB: Writing to MongoDB ... {data}")
        result = self.collection.replace_one({'_id': data['_id']}, data, upsert=True)
        logger.info(f"MongoDB: Upserted document with id: {data['_id']}")

    def scan(self) -> List[Dict]:
        logger.info("MongoDB: Scanning from MongoDB ...")
        return [self._convert_from_mongo(doc) for doc in self.collection.find()]

    def query(self, key: str, value: str) -> List[Dict]:
        if key == 'id':
            key = '_id'
            if type(value) == str:
                value = ObjectId(value)
        logger.info(f'MongoDB: Querying from MongoDB ... Key:"{key}" Value:"{value}"')
        return [self._convert_from_mongo(doc) for doc in self.collection.find({key: value})]

    def count(self, key: str, value: str) -> int:
        if key == 'id':
            key = '_id'
            if type(value) == str:
                value = ObjectId(value)
        logger.info(f'MongoDB: Counting in MongoDB ... Key:"{key}" Value:"{value}"')
        return self.collection.count_documents({key: value})

    def __del__(self):
        self.client.close()