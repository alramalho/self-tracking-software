from fastapi import APIRouter, Depends, Body, HTTPException, Response, Query, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from entities.user import User
from gateways.activities import ActivitiesGateway
from gateways.moodreports import MoodsGateway
from ai.assistant.memory import DatabaseMemory
from gateways.database.mongodb import MongoDBGateway
from gateways.users import UsersGateway
from constants import VAPID_PRIVATE_KEY, VAPID_CLAIMS
from pywebpush import webpush, WebPushException
from entities.message import Message
from services.conversation_service import initiate_recurrent_checkin
from entities.activity import Activity
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
        raise HTTPException(status_code=404, detail="Subscription not found")

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
        raise HTTPException(
            status_code=500, detail=f"Failed to send push notification: {ex}"
        )


@router.post("/trigger-push-notification")
async def trigger_push_notification(
    payload: PushNotificationPayload = Body(...), user: User = Depends(is_clerk_user)
):
    return await send_push_notification(payload, user)


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
        await send_push_notification(
            PushNotificationPayload(
                title=f"hey {user.name}",
                body=processed_notification.message.lower(),
                url=f"/log?notification_id={processed_notification.id}",
            ),
            user,
        )

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


@router.get("/onboarding/step")
async def get_onboarding_step(user: User = Depends(is_clerk_user)):
    return {"onboarding_progress": user.onboarding_progress}


@router.post("/onboarding/step")
async def onboarding_step(data: Dict = Body(...), user: User = Depends(is_clerk_user)):
    for key, value in data.items():
        updated_user = users_gateway.update_onboarding_progress(user.id, key, value)
    return {"message": "Onboarding step saved", "user": updated_user}


@router.post("/onboarding/generate-plans")
async def generate_plans(data: Dict = Body(...), user: User = Depends(is_clerk_user)):
    goal = user.onboarding_progress.get("goal")
    finishing_date = user.onboarding_progress.get("finishing_date")
    plan_description = data.get("planDescription")

    if not goal:
        raise HTTPException(
            status_code=400, detail="Goal not set in onboarding progress"
        )

    plans = plan_controller.generate_plans(goal, finishing_date, plan_description)
    return {"plans": plans}


@router.post("/onboarding/select-plan")
async def select_plan(plan: Dict = Body(...), user: User = Depends(is_clerk_user)):
    created_plan = plan_controller.create_plan(user.id, plan)
    updated_user = users_gateway.set_selected_plan(user.id, created_plan.id)
    return {
        "message": "Plan selected and created",
        "user": updated_user,
        "plan": created_plan,
    }


@router.get("/user")
async def get_user(user: User = Depends(is_clerk_user)):
    return user


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str, user: User = Depends(is_clerk_user)):
    plan = plan_controller.get_plan(plan_id).dict()
    activity_map = {
        activity.id: {"title": activity.title, "measure": activity.measure}
        for activity in activities_gateway.get_all_activities_by_user_id(user.id)
    }
    plan["activities"] = [activity_map[activity_id] for activity_id in plan["activity_ids"]]
    return plan

@router.get("/user-plan")
async def get_user_plan(user: User = Depends(is_clerk_user)):
    if not user.selected_plan_id:
        return None
    plan = plan_controller.get_plan(user.selected_plan_id).dict()
    activity_map = {
        activity.id: {"title": activity.title, "measure": activity.measure}
        for activity in activities_gateway.get_all_activities_by_user_id(user.id)
    }
    plan["activities"] = [activity_map[activity_id] for activity_id in plan["activity_ids"]]
    return plan

@router.post("/log-activity", response_model=ActivityEntryResponse)
async def log_activity(
    activity_id: str = Body(...),
    iso_date_string: str = Body(...),
    quantity: int = Body(...),
    user: User = Depends(is_clerk_user)
):
    activity_entry = ActivityEntry.new(
        activity_id=activity_id,
        quantity=quantity,
        date=iso_date_string,
    )
    logged_entry = activities_gateway.create_activity_entry(activity_entry)
    return ActivityEntryResponse(
        id=logged_entry.id,
        activity_id=logged_entry.activity_id,
        quantity=logged_entry.quantity,
        date=logged_entry.date
    )

@router.get("/recent-activities")
async def get_recent_activities(user: User = Depends(is_clerk_user)):
    recent_activities = activities_gateway.get_readable_recent_activity_entries(user.id, limit=5)
    return {"recent_activities": recent_activities}

# Add this new endpoint to your existing router

@router.post("/upsert-activity")
async def upsert_activity(
    activity: dict = Body(...),
    user: User = Depends(is_clerk_user)
):
    activity_id = activity.get('id')
    if activity_id:
        # Update existing activity
        updated_activity = activities_gateway.update_activity(activity_id, activity)
        return updated_activity
    else:
        # Create new activity
        new_activity = Activity.new(
            user_id=user.id,
            title=activity['title'],
            measure=activity['measure'],
            emoji=activity['emoji']
        )
        created_activity = activities_gateway.create_activity(new_activity)
        return created_activity

@router.post("/store-activity-photo")
async def store_activity_photo(
    photo: UploadFile = File(...),
    activityEntryId: str = Form(...),
    keepInProfile: bool = Form(...),
    user: User = Depends(is_clerk_user)
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

    # Update the activity entry with the image S3 path
    updated_entry = activities_gateway.update_activity_entry(activityEntryId, {"image_s3_path": s3_path})

    # If keepInProfile is True, you might want to update the user's profile or perform other actions

    return {"message": "Photo uploaded successfully", "updated_entry": updated_entry}