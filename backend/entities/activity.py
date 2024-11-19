from pydantic import BaseModel, Field
from datetime import datetime, UTC
from pydantic import field_validator
from typing import Optional, List
from bson import ObjectId
from datetime import timedelta


class Activity(BaseModel):
    id: str
    user_id: str
    invitee_ids: List[str] = []
    title: str
    title_embedding: Optional[List[float]] = None
    measure: str = Field(
        description="The unit of measure for this activity. (e.g. 'minutes', 'kilometers', 'times')"
    )
    emoji: str
    created_at: str
    deleted_at: Optional[str] = None

    @field_validator("title")
    def title_must_be_lowercase(cls, v):
        return v.lower()

    @field_validator("measure")
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
        emoji: str,
        id: Optional[str] = None,
    ) -> "Activity":
        return cls(
            id=id or str(ObjectId()),
            user_id=user_id,
            title=title,
            measure=measure,
            emoji=emoji,
            created_at=datetime.now(UTC).isoformat(),
        )


class ImageInfo(BaseModel):
    s3_path: Optional[str] = None
    url: Optional[str] = None
    expires_at: Optional[str] = None
    created_at: Optional[str] = None
    is_public: bool = False

    @classmethod
    def new(cls, url: str, is_public: bool = False) -> "ImageInfo":
        return cls(
            url=url,
            is_public=is_public,
            created_at=datetime.now(UTC).isoformat(),
            expires_at=(datetime.now(UTC) + timedelta(days=7)).isoformat(),
        )


class ActivityEntry(BaseModel):
    id: str
    activity_id: str
    user_id: Optional[str] = None
    quantity: int = Field(description="Way to quantify it, must be > 0.")
    date: str = Field(description="The YYYY-MM-DD date of the activity.")
    created_at: str
    image: Optional[ImageInfo] = None
    reactions: dict[str, List[str]] = Field(default_factory=dict, description="Mapping of emoji to list of user")

    @classmethod
    def new(
        cls,
        activity_id: str,
        user_id: str,
        quantity: str,
        date: str,
        id: Optional[str] = None,
        image: Optional[ImageInfo] = None,
        reactions: Optional[dict[str, List[str]]] = None,
    ) -> "ActivityEntry":
        return cls(
            id=id or str(ObjectId()),
            user_id=user_id,
            activity_id=activity_id,
            quantity=quantity,
            date=date,
            created_at=datetime.now(UTC).isoformat(),
            image=image,
            reactions=reactions or {},
        )


SAMPLE_SEARCH_ACTIVITY = Activity.new(
    user_id="666666666666666666666666",
    title="Running",
    measure="kilometers",
    emoji="🏃",
)
