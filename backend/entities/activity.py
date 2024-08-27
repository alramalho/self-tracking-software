from pydantic import BaseModel, Field
from datetime import datetime, UTC
from uuid import uuid4
from pydantic import field_validator
from bson import ObjectId

class Activity(BaseModel):
    id: str
    user_id: str
    title: str
    measure: str = Field(description="The unit of measure for this activity. (e.g. 'minutes', 'kilometers', 'times')")
    created_at: str

    @field_validator('title')
    def title_must_be_lowercase(cls, v):
        return v.lower()

    @field_validator('measure')
    def measure_must_be_lowercase(cls, v):
        return v.lower()

    def __str__(self):
        return f"{self.title} (measured in {self.measure})"

    @classmethod
    def new(
        cls,
        user_id: str,
        title: str,
        measure: str,
    ) -> "Activity":
        return cls(
            id=str(ObjectId()),
            user_id=user_id,
            title=title,
            measure=measure,
            created_at=datetime.now(UTC).isoformat(),
        )

class ActivityEntry(BaseModel):
    id: str
    activity_id: str
    quantity: int = Field(description="Way to quantify it, must be > 0.")
    date: str = Field(description="The YYYY-MM-DD date of the activity.")
    created_at: str

    @classmethod
    def new(
        cls,
        activity_id: str,
        quantity: str,
        date: str
    ) -> "ActivityEntry":
        return cls(
            id=str(ObjectId()),
            activity_id=activity_id,
            quantity=quantity,
            date=date,
            created_at=datetime.now(UTC).isoformat(),
        )