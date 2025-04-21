from pydantic import BaseModel
from typing import Literal, Any, Dict
from decimal import Decimal
from uuid import uuid4
from datetime import datetime
from bson import ObjectId


class Recommendation(BaseModel):
    id: str
    user_id: str
    recommendation_object_type: Literal["user"] = "user"
    recommendation_object_id: str
    score: float
    metadata: Dict[str, Any]
    created_at: str
    updated_at: str

    @classmethod
    def new(
        cls,
        user_id: str,
        recommendation_object_type: Literal["user"],
        recommendation_object_id: str,
        score: Decimal,
        metadata: Dict[str, Any] = {},
    ) -> "Recommendation":
        return cls(
            id=str(ObjectId()),
            user_id=user_id,
            recommendation_object_type=recommendation_object_type,
            recommendation_object_id=recommendation_object_id,
            score=score,
            metadata=metadata,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
        )
