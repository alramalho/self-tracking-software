from pydantic import BaseModel, Field
from datetime import datetime, UTC
from uuid import uuid4
from pydantic import field_validator
from bson import ObjectId

class MoodReport(BaseModel):
    id: str
    user_id: str
    date: str = Field(description="The YYYY-MM-DD date of the report.")
    score: str = Field(description="0 to 10 measure of how happy the user is feeling.")
    created_at: str

    @classmethod
    def new(
        cls,
        user_id: str,
        date: str,
        score: str,
    ) -> "MoodReport":
        return cls(
            id=str(ObjectId()),
            user_id=user_id,
            score=score,
            date=date,
            created_at=datetime.now(UTC).isoformat(),
        )