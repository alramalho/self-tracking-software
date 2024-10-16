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
        
        logger.log("DB", f"MongoDB: Writing to MongoDB ... {data}")
        result = self.collection.replace_one({'_id': data['_id']}, data, upsert=True)
        logger.log("DB", f"MongoDB: Upserted document with id: {data['_id']}")

    def scan(self) -> List[Dict]:
        logger.log("DB", "MongoDB: Scanning from MongoDB ...")
        return [self._convert_from_mongo(doc) for doc in self.collection.find()]

    def query(self, key: str, value: str) -> List[Dict]:
        if key == 'id':
            key = '_id'
            logger.log("DB", "Value type: " + str(type(value)))
            if type(value) == str:
                logger.log("DB", "Value is a string")
                value = ObjectId(value)
        logger.log("DB", f'MongoDB: Querying from MongoDB "{self.collection.name}" ... Key:"{key}" Value:"{value}"')
        logger.log("DB", "New Value type: " + str(type(value)))
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