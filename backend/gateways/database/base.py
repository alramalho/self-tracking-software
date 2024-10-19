from abc import ABC, abstractmethod
from typing import List, Dict


class DBGateway(ABC):
    @abstractmethod
    def delete_all(self, key: str, value: str) -> None:
        pass

    @abstractmethod
    def write(self, data: dict):
        pass

    @abstractmethod
    def scan(self) -> List:
        pass

    @abstractmethod
    def query(self, key: str, value: str) -> List:
        pass

    @abstractmethod
    def count(self, key: str, value: str) -> int:
        pass

    @abstractmethod
    def vector_search(self, key: str, query: str, limit: int = 5) -> List[Dict]:
        pass
