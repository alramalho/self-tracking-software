from fastapi import (
    APIRouter,
    Depends,
    Body,
    HTTPException,
    Response,
    Query,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from entities.user import User
from gateways.activities import ActivitiesGateway, ActivityEntryAlreadyExistsException
from gateways.moodreports import MoodsGateway
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from gateways.users import UsersGateway
from constants import VAPID_PRIVATE_KEY, VAPID_CLAIMS
from pywebpush import webpush, WebPushException
from entities.message import Message
from services.conversation_service import initiate_recurrent_checkin
from entities.activity import Activity, ImageInfo
from datetime import datetime, timedelta
import random
import json
import traceback
from controllers.processed_notification_controller import (
    ProcessedNotificationController,
)
from controllers.scheduled_notification_controller import (
    ScheduledNotificationController,
)
from fastapi import Request
from controllers.plan_controller import PlanController
from entities.activity import ActivityEntry
from datetime import datetime
from gateways.aws.s3 import S3Gateway
import uuid
import os
import concurrent.futures
from pymongo.errors import DuplicateKeyError
from entities.friend_request import FriendRequest
from loguru import logger

router = APIRouter(prefix="/api")
processed_notification_controller = ProcessedNotificationController()
scheduled_notification_controller = ScheduledNotificationController()

activities_gateway = ActivitiesGateway()
moods_gateway = MoodsGateway()
users_gateway = UsersGateway()
plan_controller = PlanController()


class ActivityEntryResponse(BaseModel):
    id: str
    activity_id: str
    quantity: int
    date: str


class MoodReportResponse(BaseModel):
    id: str
    user_id: str
    date: str
    score: str


class PushNotificationPayload(BaseModel):
    title: str
    body: str
    icon: Optional[str] = None
    url: Optional[str] = None


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


@router.get("/mood-reports", response_model=List[MoodReportResponse])
async def get_mood_reports(user: User = Depends(is_clerk_user)):
    mood_reports = moods_gateway.get_all_mood_reports_by_user_id(user.id)
    return [
        MoodReportResponse(id=m.id, user_id=m.user_id, date=m.date, score=m.score)
        for m in mood_reports
    ]


@router.get("/user-health")
async def health():
    return {"status": "ok"}


class PwaStatusUpdate(BaseModel):
    is_pwa_installed: Optional[bool] = None
    is_pwa_notifications_enabled: Optional[bool] = None
    pwa_subscription_endpoint: Optional[str] = None
    pwa_subscription_key: Optional[str] = None
    pwa_subscription_auth_token: Optional[str] = None


@router.post("/update-pwa-status")
async def update_pwa_status(
    status_update: PwaStatusUpdate = Body(...), user: User = Depends(is_clerk_user)
):
    update_fields = {k: v for k, v in status_update.dict().items() if v is not None}
    updated_user = users_gateway.update_fields(user.id, update_fields)
    return {"message": "PWA status updated successfully", "user": updated_user}


async def send_push_notification(payload: PushNotificationPayload, user: User):
    subscription_info = users_gateway.get_subscription_info(user.id)
    if not subscription_info:
        logger.error(f"Subscription not found for {user.id}")
        raise Exception(f"Subscription not found for {user.id}")

    print(f"Sending push notification to: {subscription_info}")
    print(f"Payload: {payload}")

    try:
        response = webpush(
            subscription_info,
            data=json.dumps(
                {
                    "title": payload.title,
                    "body": payload.body,
                    "icon": payload.icon,
                    "url": payload.url,
                }
            ),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        print(f"WebPush response: {response.text}")
        return {"message": "Push notification sent successfully"}
    except WebPushException as ex:
        print(f"WebPush error: {ex}")
        traceback.print_exc()
        raise Exception(f"Failed to send push notification: {ex}")


@router.post("/trigger-push-notification")
async def trigger_push_notification(
    payload: PushNotificationPayload = Body(...), user: User = Depends(is_clerk_user)
):
    try:
        return await send_push_notification(payload, user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process-scheduled-notification")
async def process_scheduled_notification(request: Request):
    body = await request.json()
    notification_id = body.get("notification_id", None)

    if not notification_id:
        raise HTTPException(status_code=400, detail="Notification ID is required")

    processed_notification = scheduled_notification_controller.process_notification(
        notification_id
    )

    if processed_notification:
        user = users_gateway.get_user_by_id(processed_notification.user_id)

        # Send push notification
        try:
            await send_push_notification(
                PushNotificationPayload(
                    title=f"hey {user.name}",
                    body=processed_notification.message.lower(),
                    url=f"/log?notification_id={processed_notification.id}",
                ),
                user,
            )
            logger.info(f"Sent push notification to {user.id}")
        except Exception as e:
            logger.error(f"Failed to send push notification: {e}")
            raise Exception(f"Failed to send push notification: {e}")

        memory = DatabaseMemory(MongoDBGateway("messages"), user.id)
        memory.write(
            Message.new(
                text=processed_notification.message,
                sender_name="Jarvis",
                sender_id="0",
                recipient_name=user.name,
                recipient_id=user.id,
            )
        )

        # Recreate the scheduled notification for changing time of the day its processed
        scheduled_notification_controller.update_time(notification_id)

        return {
            "message": "Notification processed, sent successfully, and recreated for next occurrence"
        }
    else:
        return JSONResponse(
            status_code=204, content={"message": "No notification processed"}
        )


@router.post("/mark-notification-opened")
async def mark_notification_opened(
    notification_id: str = Query(...), user: User = Depends(is_clerk_user)
):
    processed_notification = processed_notification_controller.get(notification_id)

    if not processed_notification:
        raise HTTPException(status_code=404, detail="Processed notification not found")

    if processed_notification.user_id != user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to mark this notification as opened"
        )

    updated_notification = processed_notification_controller.mark_as_opened(
        notification_id
    )

    return {
        "message": "Notification marked as opened",
        "notification": updated_notification,
    }


@router.post("/initiate-recurrent-checkin")
async def route_initiate_recurrent_checkin(user: User = Depends(is_clerk_user)):
    initiate_recurrent_checkin(user.id)
    return {"message": "Recurrent check-in initiated successfully"}


@router.post("/generate-plans")
async def generate_plans(data: Dict = Body(...), user: User = Depends(is_clerk_user)):
    goal = data.get("goal")
    finishing_date = data.get("finishingDate")
    plan_description = data.get("planDescription")

    if not goal:
        raise HTTPException(
            status_code=400, detail="Goal not set in onboarding progress"
        )

    plans = plan_controller.generate_plans(goal, finishing_date, plan_description)
    return {"plans": plans}


@router.post("/create-plan")
async def create_plan(plan: Dict = Body(...), user: User = Depends(is_clerk_user)):
    created_plan = plan_controller.create_plan_from_generated_plan(user.id, plan)
    updated_user = users_gateway.add_plan_to_user(user.id, created_plan.id)
    return {
        "message": "Plan created and added to user",
        "user": updated_user,
        "plan": created_plan,
    }


@router.delete("/remove-plan/{plan_id}")
async def remove_plan(plan_id: str, user: User = Depends(is_clerk_user)):
    updated_user = users_gateway.remove_plan_from_user(user.id, plan_id)
    return {
        "message": "Plan removed from user",
        "user": updated_user,
    }


@router.get("/user-plans")
async def get_user_plans(user: User = Depends(is_clerk_user)):
    plans = []
    for plan_id in user.plan_ids:
        if plan_id is not None:
            plan = plan_controller.get_plan(plan_id)
            if plan is not None:
                plan_dict = plan.dict()
                plans.append(plan_dict)

    activity_map = {
        activity.id: {"id": activity.id, "title": activity.title, "measure": activity.measure, "emoji": activity.emoji}
        for activity in activities_gateway.get_all_activities_by_user_id(user.id)
    }
    activity_map_set = set(activity_map.keys())

    for plan in plans:
        plan["activities"] = [
            activity_map[session["activity_id"]]
            for session in plan["sessions"]
            if session["activity_id"] in activity_map_set
        ]

    return {"plans": plans}


@router.get("/user")
async def get_user(user: User = Depends(is_clerk_user)):
    return user


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str, user: User = Depends(is_clerk_user)):
    plan = plan_controller.get_plan(plan_id).dict()
    activity_map = {
        activity.id: {"id": activity.id, "title": activity.title, "measure": activity.measure, "emoji": activity.emoji}
        for activity in activities_gateway.get_all_activities_by_user_id(user.id)
    }
    plan_activity_ids = set(session["activity_id"] for session in plan["sessions"])
    plan["activities"] = [
        activity_map[activity_id] for activity_id in plan_activity_ids
    ]
    return plan


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
        # An entry for this activity and date already exists
        existing_entry = activities_gateway.get_activity_entry(
            activity_id, iso_date_string
        )
        if existing_entry:
            # Update the existing entry with the new quantity
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
        # Update existing activity
        updated_activity = activities_gateway.update_activity(Activity(**activity))
        return updated_activity
    else:
        # Create new activity
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
    activities_gateway = ActivitiesGateway()

    # Generate a unique photo ID
    photo_id = str(uuid.uuid4())

    # Get the file extension
    _, file_extension = os.path.splitext(photo.filename)

    # Create the S3 path with the file extension
    s3_path = f"/users/{user.id}/activity_entries/{activityEntryId}/photos/{photo_id}{file_extension}"

    # Upload the photo to S3
    s3_gateway.upload(await photo.read(), s3_path)

    # Generate presigned URL
    expiration = 604799 if keepInProfile else 86400  # 7 days or 24 hours
    presigned_url = s3_gateway.generate_presigned_url(s3_path, expiration)

    # Calculate expiration date
    image_expires_at = datetime.now() + timedelta(seconds=expiration)

    # Create ImageInfo object
    image_info = ImageInfo(
        s3_path=s3_path,
        url=presigned_url,
        expires_at=image_expires_at.isoformat(),
        created_at=datetime.now().isoformat(),
        keep_in_profile=keepInProfile,
    )

    # Update the activity entry with the image information
    updated_entry = activities_gateway.update_activity_entry(
        activityEntryId, {"image": image_info.dict()}
    )

    return {
        "message": "Photo uploaded successfully",
        "updated_entry": updated_entry,
        "presigned_url": presigned_url,
    }

def get_recommended_activity_entries(current_user: User):
    activities = plan_controller.get_recommended_activities(current_user, limit=10)
    activities_dicts = [exclude_embedding_fields(activity.dict()) for activity in activities]

    users = {}

    for activity in activities:
        user = users_gateway.get_user_by_id(activity.user_id)
        if user:
            users[user.id] = user.dict()

    users = list(users.values())
    
    recommended_activity_entries = []
    for activity in activities:
        for entry in activities_gateway.get_all_activity_entries_by_activity_id(activity.id):
            entry_dict = exclude_embedding_fields(entry.dict())
            recommended_activity_entries.append(entry_dict)

    # random.shuffle(recommended_activity_entries)    
    return {
        "recommended_activity_entries": recommended_activity_entries,
        "recommended_activities": activities_dicts,
        "recommended_users": users,
    }

@router.get("/load-all-user-data/{username}")
async def load_all_user_data(
    username: Optional[str] = None, include_timeline: bool = Query(False), current_user: User = Depends(is_clerk_user)
):
    try:
        # If username is not provided or is 'me', use the current user
        if not username or username == "me":
            user = current_user
        else:
            user = users_gateway.get_user_by_safely("username", username.lower())
            if not user:
                raise HTTPException(status_code=404, detail=f"User {username} not found")

        # Use concurrent.futures to run all database queries concurrently
        with concurrent.futures.ThreadPoolExecutor() as executor:
            activities_future = executor.submit(
                activities_gateway.get_all_activities_by_user_id, user.id
            )
            entries_future = executor.submit(
                activities_gateway.get_all_activity_entries_by_user_id, user.id
            )
            mood_reports_future = executor.submit(
                moods_gateway.get_all_mood_reports_by_user_id, user.id
            )
            plans_future = executor.submit(plan_controller.get_plans, user.plan_ids)
            friend_requests_future = executor.submit(
                users_gateway.friend_request_gateway.get_pending_requests, user.id
            )
            # Wait for all futures to complete and convert to dicts
            activities = [exclude_embedding_fields(activity.dict()) for activity in activities_future.result()]
            entries = [entry.dict() for entry in entries_future.result()]
            mood_reports = [report.dict() for report in mood_reports_future.result()]
            plans = [exclude_embedding_fields(plan.dict()) for plan in plans_future.result()]
            friend_requests = [
                request.dict() for request in friend_requests_future.result()
            ]
        # Process plans to include activities
        activity_map = {activity["id"]: activity for activity in activities}

        # get it from sessions
        for plan in plans:
            plan_activity_ids = set(session["activity_id"] for session in plan["sessions"])
            plan["activities"] = [activity_map[activity_id] for activity_id in plan_activity_ids if activity_id in activity_map]

        # hydrate friend requests with sender and recipient data
        for request in friend_requests:
            sender = users_gateway.get_user_by_id(request["sender_id"])
            recipient = users_gateway.get_user_by_id(request["recipient_id"])
            request["sender_name"] = sender.name
            request["sender_username"] = sender.username
            request["sender_picture"] = sender.picture
            request["recipient_name"] = recipient.name
            request["recipient_username"] = recipient.username
            request["recipient_picture"] = recipient.picture

        result ={
            "user": user,
            "activities": activities,
            "activity_entries": entries,
            "mood_reports": mood_reports,
            "plans": plans,
            "friend_requests": friend_requests,
        }
        if include_timeline:
            result.update(get_recommended_activity_entries(user))
        
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching user data: {str(e)}",
        )


@router.get("/check-username/{username}")
async def check_username(username: str):
    user = users_gateway.get_user_by_safely("username", username)
    return {"exists": user is not None or username == "me"}


@router.post("/update-user")
async def update_user(user_data: dict = Body(...), user: User = Depends(is_clerk_user)):
    updated_user = users_gateway.update_fields(user.id, user_data)
    return {"message": "User updated successfully", "user": updated_user}


@router.get("/search-users/{username}")
async def search_username(username: str, user: User = Depends(is_clerk_user)):
    if user.username == username:
        return None
    
    user = users_gateway.get_user_by_safely("username", username)
    if user:
        return {"user_id": user.id, "username": user.username, "name": user.name, "picture": user.picture}
    return None

# Add this new endpoint
@router.get("/user/friend-count")
async def get_friend_count(user: User = Depends(is_clerk_user)):
    friend_count = users_gateway.get_friend_count(user.id)
    return {"friendCount": friend_count}


@router.get("/user/{username}")
async def get_user_profile(username: str, current_user: User = Depends(is_clerk_user)):
    if username == "me":
        return current_user

    user = users_gateway.get_user_by_safely("username", username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Remove sensitive information
    user_dict = user.dict(
        exclude={"email", "clerk_id", "plan_ids", "pending_friend_requests"}
    )

    return user_dict


@router.post("/send-friend-request/{recipient_id}")
async def send_friend_request(
    recipient_id: str, current_user: User = Depends(is_clerk_user)
):
    try:
        friend_request = users_gateway.send_friend_request(
            current_user.id, recipient_id
        )
        recipient = users_gateway.get_user_by_id(recipient_id)
        try:
            await send_push_notification(
                PushNotificationPayload(
                    title="✋ New Friend Request",
                    body=f"{current_user.name} sent you a friend request",
                ),
                recipient,
            )
            logger.info(f"Sent push notification to {recipient.id}")
        except Exception as e:
            logger.error(f"Failed to send push notification: {e}")
        return {
            "message": "Friend request sent successfully",
            "request": friend_request,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/friend-requests/{request_id}/{action}")
async def friend_request_action(
    request_id: str, action: str, current_user: User = Depends(is_clerk_user)
):
    try:
        if action == "accept":
            sender, recipient = users_gateway.accept_friend_request(request_id)
            try:
                await send_push_notification(
                    PushNotificationPayload(
                        title="🤝 Friend Request Accepted",
                        body=f"{current_user.name} accepted your friend request. You can now see their activities!",
                    ),
                    sender,
                )
                logger.info(f"Sent push notification to {sender.id}")
            except Exception as e:
                logger.error(f"Failed to send push notification: {e}")
        elif action == "reject":
            recipient = users_gateway.reject_friend_request(request_id)
            try:
                await send_push_notification(
                    PushNotificationPayload(
                        title="😔 Friend Request Rejected",
                        body=f"{current_user.name} rejected your friend request.",
                    ),
                    recipient,
                )
                logger.info(f"Sent push notification to {recipient.id}")
            except Exception as e:
                logger.error(f"Failed to send push notification: {e}")
        else:
            raise HTTPException(status_code=400, detail="Invalid action")

        return {
            "message": "Friend request accepted",
            "recipient": recipient,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/pending-friend-requests")
async def get_pending_friend_requests(current_user: User = Depends(is_clerk_user)):
    pending_requests = users_gateway.get_pending_friend_requests(current_user.id)
    return {"pending_requests": pending_requests}


def exclude_embedding_fields(d: dict):
    return {key: value for key, value in d.items() if not key.endswith("_embedding")}