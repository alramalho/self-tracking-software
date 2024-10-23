from fastapi import APIRouter, Depends, Body, HTTPException, UploadFile, File, Form
from typing import List
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from entities.user import User
from gateways.activities import ActivitiesGateway, ActivityEntryAlreadyExistsException
from entities.activity import Activity, ActivityEntry, ImageInfo
from gateways.aws.s3 import S3Gateway
import uuid
import os
from datetime import datetime, timedelta

router = APIRouter()

activities_gateway = ActivitiesGateway()

class ActivityEntryResponse(BaseModel):
    id: str
    activity_id: str
    quantity: int
    date: str

@router.get("/activities", response_model=List[Activity])
async def get_activities(user: User = Depends(is_clerk_user)):
    return activities_gateway.get_all_activities_by_user_id(user.id)

@router.get("/activity-entries", response_model=List[ActivityEntryResponse])
async def get_activity_entries(user: User = Depends(is_clerk_user)):
    entries = activities_gateway.get_all_activity_entries_by_user_id(user.id)
    return [
        ActivityEntryResponse(
            id=e.id, activity_id=e.activity_id, quantity=e.quantity, date=e.date
        )
        for e in entries
    ]

@router.post("/log-activity", response_model=ActivityEntryResponse)
async def log_activity(
    activity_id: str = Body(...),
    iso_date_string: str = Body(...),
    quantity: int = Body(...),
    user: User = Depends(is_clerk_user),
):
    activity_entry = ActivityEntry.new(
        activity_id=activity_id,
        quantity=quantity,
        date=iso_date_string,
    )

    try:
        logged_entry = activities_gateway.create_activity_entry(activity_entry)
        return ActivityEntryResponse(
            id=logged_entry.id,
            activity_id=logged_entry.activity_id,
            quantity=logged_entry.quantity,
            date=logged_entry.date,
        )
    except ActivityEntryAlreadyExistsException:
        existing_entry = activities_gateway.get_activity_entry(
            activity_id, iso_date_string
        )
        if existing_entry:
            updated_entry = activities_gateway.update_activity_entry(
                existing_entry.id, {"quantity": quantity + existing_entry.quantity}
            )
            return ActivityEntryResponse(
                id=updated_entry.id,
                activity_id=updated_entry.activity_id,
                quantity=updated_entry.quantity,
                date=updated_entry.date,
            )
        else:
            raise HTTPException(
                status_code=500, detail="Failed to update existing activity entry"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@router.get("/recent-activities")
async def get_recent_activities(user: User = Depends(is_clerk_user)):
    recent_activities = activities_gateway.get_readable_recent_activity_entries(
        user.id, limit=5
    )
    return {"recent_activities": recent_activities}

@router.post("/upsert-activity")
async def upsert_activity(
    activity: dict = Body(...), user: User = Depends(is_clerk_user)
):
    activity_id = activity.get("id")
    if activity_id:
        updated_activity = activities_gateway.update_activity(Activity(**activity))
        return updated_activity
    else:
        new_activity = Activity.new(
            user_id=user.id,
            title=activity["title"],
            measure=activity["measure"],
            emoji=activity["emoji"],
        )
        created_activity = activities_gateway.create_activity(new_activity)
        return created_activity

@router.post("/store-activity-photo")
async def store_activity_photo(
    photo: UploadFile = File(...),
    activityEntryId: str = Form(...),
    keepInProfile: bool = Form(...),
    user: User = Depends(is_clerk_user),
):
    s3_gateway = S3Gateway()

    photo_id = str(uuid.uuid4())
    _, file_extension = os.path.splitext(photo.filename)
    s3_path = f"/users/{user.id}/activity_entries/{activityEntryId}/photos/{photo_id}{file_extension}"

    s3_gateway.upload(await photo.read(), s3_path)

    expiration = 604799 if keepInProfile else 86400
    presigned_url = s3_gateway.generate_presigned_url(s3_path, expiration)

    image_expires_at = datetime.now() + timedelta(seconds=expiration)

    image_info = ImageInfo(
        s3_path=s3_path,
        url=presigned_url,
        expires_at=image_expires_at.isoformat(),
        created_at=datetime.now().isoformat(),
        keep_in_profile=keepInProfile,
    )

    updated_entry = activities_gateway.update_activity_entry(
        activityEntryId, {"image": image_info.dict()}
    )

    return {
        "message": "Photo uploaded successfully",
        "updated_entry": updated_entry,
        "presigned_url": presigned_url,
    }
