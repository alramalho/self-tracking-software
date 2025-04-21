from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class SearchResult(BaseModel):
    id: str
    score: float
    fields: dict # based off pinecone api

class BaseVectorDb(ABC):

    @abstractmethod
    def upsert_record(self, text: str, metadata: dict) -> None:
        pass
    
    @abstractmethod
    def query(self, query: str, top_k: int = 10, filter: Optional[dict] = None) -> List[SearchResult]:
        pass
    
    
