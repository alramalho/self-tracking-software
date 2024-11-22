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
from services.notification_manager import NotificationManager
from gateways.users import UsersGateway
from datetime import datetime, timedelta
from loguru import logger
import traceback
from entities.notification import Notification

router = APIRouter()

activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()
users_gateway = UsersGateway()


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
    has_photo: bool = Body(False),
    user: User = Depends(is_clerk_user),
):
    activity_entry = ActivityEntry.new(
        user_id=user.id,
        activity_id=activity_id,
        quantity=quantity,
        date=iso_date_string,
    )

    entry = None
    try:
        entry = activities_gateway.create_activity_entry(activity_entry)
    except ActivityEntryAlreadyExistsException:
        entry = activities_gateway.get_activity_entry(activity_id, iso_date_string)
        if entry:
            entry = activities_gateway.update_activity_entry(
                entry.id,
                {
                    "quantity": quantity + entry.quantity,
                },
            )

    for friend_id in user.friend_ids:
        logger.info(f"Creating notification for friend '{friend_id}'")
        activity = activities_gateway.get_activity_by_id(activity_id)
        message = f"Your friend {user.name} just logged {quantity} {activity.measure} of {activity.emoji} {activity.title} "
        if has_photo:
            message = message.replace(
                "just logged", "just uploaded a photo 📸 after logging"
            )

        await notification_manager.create_and_process_notification(
            Notification.new(
                user_id=friend_id,
                message=message,
                type="info",
                related_data={
                    "picture": user.picture,
                    "name": user.name,
                    "username": user.username,
                },
            )
        )

    return entry


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
    isPublic: bool = Form(...),
    user: User = Depends(is_clerk_user),
):
    logger.info(f"Storing activity photo for user '{user.id}'")
    try:
        s3_gateway = S3Gateway()

        photo_id = str(uuid.uuid4())
        _, file_extension = os.path.splitext(photo.filename)
        s3_path = f"/users/{user.id}/activity_entries/{activityEntryId}/photos/{photo_id}{file_extension}"

        s3_gateway.upload(await photo.read(), s3_path)

        expiration = 604799  # 7 days (max for s3 presigned url)
        presigned_url = s3_gateway.generate_presigned_url(s3_path, expiration)

        image_expires_at = datetime.now() + timedelta(seconds=expiration)

        image_info = ImageInfo(
            s3_path=s3_path,
            url=presigned_url,
            expires_at=image_expires_at.isoformat(),
            created_at=datetime.now().isoformat(),
            is_public=isPublic,
        )

        updated_entry = activities_gateway.update_activity_entry(
            activityEntryId, {"image": image_info.dict()}
        )

        return {
            "message": "Photo uploaded successfully",
            "updated_entry": updated_entry,
            "presigned_url": presigned_url,
            }
    except Exception as e:
        logger.error(f"Error storing activity photo: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to store activity photo")



@router.put("/activity-entries/{activity_entry_id}")
async def update_activity_entry(
    activity_entry_id: str,
    update_data: dict = Body(...),
    user: User = Depends(is_clerk_user),
):
    try:
        # Get the existing entry to verify ownership
        existing_entry = activities_gateway.get_activity_entry_by_id(activity_entry_id)
        if not existing_entry:
            raise HTTPException(status_code=404, detail="Activity entry not found")

        if existing_entry.user_id != user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to update this entry"
            )

        # Update the entry
        updated_entry = activities_gateway.update_activity_entry(
            activity_entry_id,
            {
                "quantity": update_data.get("quantity", existing_entry.quantity),
                "date": update_data.get("date", existing_entry.date),
            },
        )

        return updated_entry
    except Exception as e:
        logger.error(
            f"Error updating activity entry: {str(e)}\n{traceback.format_exc()}"
        )
        raise HTTPException(status_code=500, detail="Failed to update activity entry")


@router.post("/activity-entries/{activity_entry_id}/reactions")
async def add_activity_reaction(
    activity_entry_id: str,
    emoji: str = Body(...),
    operation: str = Body(...),
    user: User = Depends(is_clerk_user),
):
    try:
        if operation == "add":
            updated_entry = activities_gateway.add_reaction(
                activity_entry_id=activity_entry_id, emoji=emoji, user=user
            )
            activity_entry = activities_gateway.get_activity_entry_by_id(
                activity_entry_id
            )
            await notification_manager.create_and_process_notification(
                Notification.new(
                    user_id=activity_entry.user_id,
                    message=f"Your friend @{user.username} just reacted to your activity",
                    type="info",
                    related_data={
                        "picture": user.picture,
                        "name": user.name,
                        "username": user.username,
                    },
                )   
            )
            return {"message": "Reaction added successfully", "entry": updated_entry}
        elif operation == "remove":
            updated_entry = activities_gateway.remove_reaction(
                activity_entry_id=activity_entry_id, emoji=emoji, user=user
            )
            return {"message": "Reaction removed successfully", "entry": updated_entry}
        else:
            raise HTTPException(status_code=400, detail="Invalid operation")
    except Exception as e:
        logger.error(f"Error adding reaction: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to add reaction")


@router.get("/activity-entries/{activity_entry_id}/reactions")
async def get_activity_reactions(
    activity_entry_id: str,
    user: User = Depends(is_clerk_user),
):
    try:
        entry = activities_gateway.get_activity_entry_by_id(activity_entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Activity entry not found")

        # Convert user_ids to usernames for the frontend
        reactions_with_usernames = {}
        for emoji, usernames in entry.reactions.items():
            reactions_with_usernames[emoji] = usernames

        return {"reactions": reactions_with_usernames}
    except Exception as e:
        logger.error(f"Error getting reactions: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to get reactions")


@router.delete("/activities/{activity_id}")
async def delete_activity(
    activity_id: str,
    user: User = Depends(is_clerk_user),
):
    try:
        # Get the activity to verify ownership
        activity = activities_gateway.get_activity_by_id(activity_id)
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        if activity.user_id != user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this activity"
            )
            
        # Check if activity is used in any active plans
        if activities_gateway.is_activity_in_any_active_plan(activity_id):
            raise HTTPException(
                status_code=400, 
                detail="Please remove this activity from all active plans before deleting it."
            )

        # Delete the activity
        activities_gateway.delete_activity(activity_id)
        return {"message": "Activity deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting activity: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to delete activity")
