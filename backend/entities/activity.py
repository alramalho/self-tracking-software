from pydantic import BaseModel, Field
from datetime import datetime, UTC
from uuid import uuid4
from pydantic import field_validator

class Activity(BaseModel):
    id: str
    user_id: str
    title: str
    quantity_description: str 
    created_at: str

    @field_validator('title')
    def title_must_be_lowercase(cls, v):
        return v.lower()

    @field_validator('quantity_description')
    def quantity_description_must_be_lowercase(cls, v):
        return v.lower()

    def __str__(self):
        return f"{self.title} (measured in {self.quantity_description})"

    @classmethod
    def new(
        cls,
        user_id: str,
        title: str,
        quantity_description: str,
    ) -> "Activity":
        return cls(
            id=str(uuid4()),
            user_id=user_id,
            title=title,
            quantity_description=quantity_description,
            created_at=datetime.now(UTC).isoformat(),
        )

class ActivityEntry(BaseModel):
    id: str
    activity_id: str
    quantity: int
    created_at: str

    @classmethod
    def new(
        cls,
        activity_id: str,
        quantity: str,
    ) -> "ActivityEntry":
        return cls(
            id=str(uuid4()),
            activity_id=activity_id,
            quantity=quantity,
            created_at=datetime.now(UTC).isoformat(),
        )