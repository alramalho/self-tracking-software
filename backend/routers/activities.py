from fastapi import APIRouter, Depends, Body, HTTPException, UploadFile, File, Form
from typing import List, Dict, Optional
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from entities.user import User
from gateways.activities import (
    ActivitiesGateway,
    ActivityEntryAlreadyExistsException,
    ActivityDoesNotExistException,
)
from entities.activity import Activity, ActivityEntry, ImageInfo
from gateways.aws.s3 import S3Gateway
import uuid
import os
from services.notification_manager import NotificationManager
from gateways.users import UsersGateway
from datetime import datetime, timedelta, UTC
from loguru import logger
import traceback
from entities.notification import Notification
from fastapi import Request
from controllers.plan_controller import PlanController
from analytics.posthog import posthog
import threading

router = APIRouter()

activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()
users_gateway = UsersGateway()
plan_controller = PlanController()


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
    activity_id: str = Form(...),
    iso_date_string: str = Form(...),
    quantity: int = Form(...),
    photo: UploadFile = None,
    isPublic: bool = Form(False),
    description: str = Form(None),
    timezone: str = Form(...),
    user: User = Depends(is_clerk_user),
):
    try:
        activity_entry = ActivityEntry.new(
            user_id=user.id,
            activity_id=activity_id,
            quantity=quantity,
            date=iso_date_string,
            description=description,
            timezone=timezone,
        )

        entry = None
        try:
            entry = activities_gateway.create_activity_entry(activity_entry)
        except ActivityEntryAlreadyExistsException:
            entry = activities_gateway.get_activity_entry_by_activity_and_date(
                activity_id, iso_date_string
            )
            if entry:
                entry = activities_gateway.update_activity_entry(
                    entry.id,
                    {
                        "quantity": quantity + entry.quantity,
                        "description": description,
                    },
                )
        except ActivityDoesNotExistException:
            raise HTTPException(status_code=404, detail="Activity does not exist")

        # Handle photo upload if provided
        if photo:
            s3_gateway = S3Gateway()
            photo_id = str(uuid.uuid4())
            _, file_extension = os.path.splitext(photo.filename)
            s3_path = f"/users/{user.id}/activity_entries/{entry.id}/photos/{photo_id}{file_extension}"

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

            entry = activities_gateway.update_activity_entry(
                entry.id, {"image": image_info.dict()}
            )

            # Create notifications for friends about the photo
            for friend_id in user.friend_ids:
                logger.info(f"Creating notification for friend '{friend_id}'")
                activity = activities_gateway.get_activity_by_id(activity_id)
                message = f"{user.username} logged {quantity} {activity.measure} of {activity.emoji} {activity.title} with a photo 📸!"
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

        # process coach update
        if user.plan_type != "free" and len(user.plan_ids) > 0:
            plan = plan_controller.get_plan(user.plan_ids[0])
            if activity_id in plan.activity_ids:
                # Run state transition processing in a separate thread to avoid blocking
                logger.info(f"Processing plan state transition for plan {plan.id}")
                thread = threading.Thread(
                    target=plan_controller.process_plan_state_recalculation,
                    args=(user, plan, False),
                    daemon=False,
                )
                thread.start()


        users_gateway.update_fields(
            user.id, {"last_active_at": datetime.now(UTC).isoformat()}
        )

        posthog.capture(
            distinct_id=user.id,
            event="activity_entry_created",
            properties={
                "activity_entry_id": entry.id,
                "user_id": user.id,
            },
        )
        return entry

    except Exception as e:
        logger.error(f"Error logging activity: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to log activity")


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
    activity_id = activity.get("id", None)
    existent_activity = activities_gateway.get_activity_by_id(activity_id)

    if existent_activity:
        if existent_activity.user_id != user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to update this activity"
            )
        try:
            updated_activity = activities_gateway.update_activity(Activity(**activity))
            return updated_activity
        except ActivityDoesNotExistException:
            pass

    new_activity = Activity.new(
        id=activity_id,
        user_id=user.id,
        title=activity["title"],
        measure=activity["measure"],
        emoji=activity["emoji"],
        privacy_settings=activity["privacy_settings"],
    )
    created_activity = activities_gateway.create_activity(new_activity)

    return created_activity


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
                "description": update_data.get(
                    "description", existing_entry.description
                ),
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
    emoji: str = Body(None),
    emojis: List[str] = Body(None),
    operation: str = Body(...),
    user: User = Depends(is_clerk_user),
):
    try:
        if operation == "add":
            # Handle both single emoji and multiple emojis
            emoji_list = emojis if emojis else [emoji] if emoji else []
            if not emoji_list:
                raise HTTPException(status_code=400, detail="No emojis provided")

            updated_entry = None
            for e in emoji_list:
                updated_entry = activities_gateway.add_reaction(
                    activity_entry_id=activity_entry_id, emoji=e, user=user
                )

            # Only send notification once with all emojis
            activity_entry = activities_gateway.get_activity_entry_by_id(
                activity_entry_id
            )

            # Create a message with all the emojis
            if len(emoji_list) <= 3:
                emoji_text = " ".join(emoji_list)
            else:
                emoji_text = (
                    " ".join(emoji_list[:3]) + f" and {len(emoji_list) - 3} more"
                )

            await notification_manager.create_and_process_notification(
                Notification.new(
                    user_id=activity_entry.user_id,
                    message=f"@{user.username} reacted to your activity with {emoji_text}",
                    type="info",
                    related_data={
                        "picture": user.picture,
                        "name": user.name,
                        "username": user.username,
                    },
                )
            )
            return {"message": "Reactions added successfully", "entry": updated_entry}
        elif operation == "remove":
            # Handle both single emoji and multiple emojis
            emoji_list = emojis if emojis else [emoji] if emoji else []
            if not emoji_list:
                raise HTTPException(status_code=400, detail="No emojis provided")

            updated_entry = None
            for e in emoji_list:
                updated_entry = activities_gateway.remove_reaction(
                    activity_entry_id=activity_entry_id, emoji=e, user=user
                )
            return {"message": "Reactions removed successfully", "entry": updated_entry}
        else:
            raise HTTPException(status_code=400, detail="Invalid operation")
    except Exception as e:
        logger.error(f"Error managing reactions: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to manage reactions")


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
        if plan_controller.is_activity_in_any_active_plan(activity_id):
            raise HTTPException(
                status_code=400,
                detail="Please remove this activity from all active plans before deleting it.",
            )

        # Delete the activity
        activities_gateway.delete_activity(activity_id)
        return {"message": "Activity deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting activity: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to delete activity")


@router.delete("/activity-entries/{activity_entry_id}")
async def delete_activity_entry(
    activity_entry_id: str,
    user: User = Depends(is_clerk_user),
):
    try:
        # Get the activity to verify ownership
        activity_entry = activities_gateway.get_activity_entry_by_id(activity_entry_id)
        if not activity_entry:
            raise HTTPException(status_code=404, detail="Activity not found")

        if activity_entry.user_id != user.id:
            raise HTTPException(
                status_code=403, detail="Not authorized to delete this activity"
            )

        # Delete the activity
        activities_gateway.delete_activity_entry(activity_entry_id)
        return {"message": "Activity deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting activity: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to delete activity")


# Add new response model for comments
@router.post("/activity-entries/{activity_entry_id}/comments")
async def add_activity_comment(
    activity_entry_id: str,
    request: Request,
    user: User = Depends(is_clerk_user),
):
    try:
        body = await request.json()
        text = body["text"]
        updated_entry = activities_gateway.add_comment(
            activity_entry_id=activity_entry_id, text=text, user=user
        )

        # Get the activity entry owner
        activity_entry = activities_gateway.get_activity_entry_by_id(activity_entry_id)

        # Don't notify if commenting on own activity
        if activity_entry.user_id != user.id:
            # Create notification for the activity owner
            await notification_manager.create_and_process_notification(
                Notification.new(
                    user_id=activity_entry.user_id,
                    message=f"@{user.username} commented on your activity: \"{text[:30]}{'...' if len(text) > 30 else ''}\"",
                    type="info",
                    related_data={
                        "picture": user.picture,
                        "name": user.name,
                        "username": user.username,
                    },
                )
            )

        # Return the latest comment
        latest_comment = updated_entry.comments[-1]
        return {
            "id": latest_comment.id,
            "user_id": latest_comment.user_id,
            "username": latest_comment.username,
            "text": latest_comment.text,
            "created_at": latest_comment.created_at,
            "picture": latest_comment.picture,
        }
    except Exception as e:
        logger.error(f"Error adding comment: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to add comment")


@router.delete("/activity-entries/{activity_entry_id}/comments/{comment_id}")
async def remove_activity_comment(
    activity_entry_id: str,
    comment_id: str,
    user: User = Depends(is_clerk_user),
):
    try:
        updated_entry = activities_gateway.remove_comment(
            activity_entry_id=activity_entry_id, comment_id=comment_id, user=user
        )
        return {"message": "Comment removed successfully"}
    except Exception as e:
        logger.error(f"Error removing comment: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to remove comment")
