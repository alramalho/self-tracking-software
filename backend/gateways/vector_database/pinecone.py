from gateways.vector_database.base import BaseVectorDb
from pinecone import Pinecone
import uuid
from typing import List, Dict, Any, Optional
from shared.logger import logger
from constants import PINECONE_API_KEY, PINECONE_INDEX_HOST
from gateways.vector_database.base import SearchResult

class PineconeVectorDB(BaseVectorDb):
    def __init__(self, namespace: str):
        self.pc = Pinecone(api_key=PINECONE_API_KEY)
        self.namespace = namespace
        self.index = self.pc.Index(host=PINECONE_INDEX_HOST)

    def upsert_record(
        self,
        text: str,
        identifier: str,
        metadata: Optional[dict] = {},
    ) -> None:
        self.index.upsert_records(
            namespace=self.namespace,
            records=[{"id": identifier, "text": text, **metadata}],
        )
        logger.info(f"Upserted record {identifier} to {self.namespace}")

    def query(
        self, query: str, top_k: int = 10, filter: Optional[dict] = None
    ) -> List[SearchResult]:
        query_obj = {"inputs": {"text": query}, "top_k": top_k}
        if filter:
            query_obj["filter"] = filter

        result = self.index.search(
            namespace=self.namespace,
            query=query_obj,
        )

        if len(result["result"]["hits"]) == 0:
            logger.info(f"No results found for query {query} in namespace {self.namespace}")
            return []

        return [SearchResult(
            id=hit["_id"],
            score=hit["_score"],
            fields=hit["fields"]
        ) for hit in result["result"]["hits"]]


if __name__ == "__main__":
    db = PineconeVectorDB(namespace="test")
    db.upsert_record(text="Disease prevention", identifier="123", metadata={"user_id": "123"})
    print(db.query(query="Disease prevention"))
