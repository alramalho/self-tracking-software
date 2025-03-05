from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from typing import Optional
class Metric(BaseModel):
    id: str
    user_id: str
    title: str
    emoji: str
    created_at: str
    updated_at: str

    @classmethod
    def new(cls, user_id: str, title: str, emoji: str):
        now = datetime.now().isoformat()
        return cls(
            id=str(ObjectId()),
            user_id=user_id,
            title=title,
            emoji=emoji,
            created_at=now,
            updated_at=now,
        )
    
    def __str__(self):
        return f"{self.title} {self.emoji} (id '{self.id}')"


class MetricEntry(BaseModel):
    id: str
    user_id: str
    metric_id: str
    rating: int
    date: str
    created_at: str
    updated_at: str
    description: Optional[str] = None

    @classmethod
    def new(cls, user_id: str, metric_id: str, rating: int, date: str = None, description: Optional[str] = None, id: Optional[str] = None):
        now = datetime.now().isoformat()
        return cls(
            id=id or str(ObjectId()),
            user_id=user_id,
            metric_id=metric_id,
            rating=rating,
            date=date or now,
            created_at=now,
            updated_at=now,
            description=description,
        )