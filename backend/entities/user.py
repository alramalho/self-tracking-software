from pydantic import BaseModel, Field
from datetime import datetime, UTC
from uuid import uuid4

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str | None = None
    email: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())