from fastapi import APIRouter, Depends, Body, HTTPException, Query
from loguru import logger
from typing import List, Optional, Dict
from pydantic import BaseModel
from auth.clerk import is_clerk_user
from entities.user import User
from gateways.users import UsersGateway
from shared.utils import exclude_embedding_fields
from gateways.activities import ActivitiesGateway
from gateways.moodreports import MoodsGateway
from controllers.plan_controller import PlanController
from gateways.plan_groups import PlanGroupsGateway
from entities.notification import Notification
from .notifications import router as notifications_router
from services.notification_manager import NotificationManager
import re
import concurrent.futures
import traceback
import logging

router = APIRouter()

users_gateway = UsersGateway()
activities_gateway = ActivitiesGateway()
moods_gateway = MoodsGateway()
plan_controller = PlanController()
notification_manager = NotificationManager()
plan_groups_gateway = PlanGroupsGateway()


@router.get("/user-health")
async def health():
    return {"status": "ok"}


@router.get("/user")
async def get_user(user: User = Depends(is_clerk_user)):
    return user


@router.get("/load-all-user-data/{username}")
async def load_all_user_data(
    username: Optional[str] = None, current_user: User = Depends(is_clerk_user)
):
    try:
        if not username or username == "me":
            user = current_user
        else:
            user = users_gateway.get_user_by_safely("username", username.lower())
            if not user:
                raise HTTPException(
                    status_code=404, detail=f"User {username} not found"
                )

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

            plans_future = executor.submit(plan_controller.get_all_user_plans, user)
            plan_groups_future = executor.submit(
                plan_groups_gateway.get_all_plan_groups_by_plan_ids, user.plan_ids
            )
            friend_requests_future = executor.submit(
                users_gateway.friend_request_gateway.get_pending_requests, user.id
            )

            activities = [
                exclude_embedding_fields(activity.dict())
                for activity in activities_future.result()
            ]
            entries = [entry.dict() for entry in entries_future.result()]
            mood_reports = [report.dict() for report in mood_reports_future.result()]
            plans = [
                exclude_embedding_fields(plan.dict()) for plan in plans_future.result()
            ]
            plan_groups = [
                plan_group.dict() for plan_group in plan_groups_future.result()
            ]
            friend_requests = [
                request.dict() for request in friend_requests_future.result()
            ]

        # Process plans to include activities
        activity_map = {activity["id"]: activity for activity in activities}

        for plan in plans:
            plan_activity_ids = set(
                session["activity_id"] for session in plan["sessions"]
            )
            plan["activities"] = [
                activity_map[activity_id]
                for activity_id in plan_activity_ids
                if activity_id in activity_map
            ]

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

        result = {
            "user": user,
            "activities": activities,
            "activity_entries": entries,
            "mood_reports": mood_reports,
            "plans": plans,
            "plan_groups": plan_groups,
        }

        if current_user.id == user.id:
            result["friend_requests"] = friend_requests

        return result
    except Exception as e:
        logger.error(f"Failed to load all user data: {e}")
        logger.error(f"Traceback: \n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching user data: {str(e)}",
        )


@router.get("/friends/{username}")
async def get_user_friends(username: str, current_user: User = Depends(is_clerk_user)):
    if username == "me":
        user = current_user
    else:
        user = users_gateway.get_user_by_safely("username", username.lower())

    friends = [users_gateway.get_user_by_id(friend_id) for friend_id in user.friend_ids]

    return {
        "friends": [
            {
                "picture": friend.picture,
                "username": friend.username,
                "name": friend.name,
            }
            for friend in friends
        ]
    }


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
    if user.username.lower() == username.lower():
        return []

    results = search_users(user, username)

    if not results:
        # If no results, return all users (up to 3)
        all_users = users_gateway.get_all_users()
        results = [
            {
                "user_id": u.id,
                "username": u.username,
                "name": u.name,
                "picture": u.picture,
            }
            for u in all_users
            if u.id != user.id
        ][:3]

    return results


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
    user_dict = user.dict(exclude={"email", "clerk_id", "plan_ids"})

    return user_dict

@router.post("/send-friend-request/{recipient_id}")
async def send_friend_request(
    recipient_id: str, current_user: User = Depends(is_clerk_user)
):
    try:
        friend_request = users_gateway.send_friend_request(current_user.id, recipient_id)
        notification = await notification_manager.create_and_process_notification(
            Notification.new(
                user_id=recipient_id,
                message=f"{current_user.name} sent you a friend request",
                type="friend_request",
                related_id=friend_request.id,
                related_data={
                    "id": current_user.id,
                    "name": current_user.name,
                    "username": current_user.username,
                    "picture": current_user.picture,
                },
            )
        )
        return {
            "message": "Friend request sent successfully",
            "request": friend_request,
            "notification": notification,
        }
    except Exception as e:
        logger.error(f"Failed to send friend request: {e}")
        logger.error(f"Traceback: \n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/accept-friend-request/{request_id}")
async def accept_friend_request(
    request_id: str, current_user: User = Depends(is_clerk_user)
):
    try:
        sender, recipient = users_gateway.accept_friend_request(request_id)
        try:
            await notification_manager.create_and_process_notification(
                Notification.new(
                    user_id=sender.id,
                    message=f"{current_user.name} accepted your friend request. You can now see their activities!",
                    type="info",
                    related_id=request_id,
                    related_data={
                        "id": current_user.id,
                        "name": current_user.name,
                        "username": current_user.username,
                        "picture": current_user.picture,
                    },
                )
            )
            logger.info(f"Sent push notification to {sender.id}")
        except Exception as e:
            logger.error(f"Failed to send push notification: {e}")

        return {
            "message": "Friend request accepted",
            "recipient": recipient,
        }
    except Exception as e:
        logger.error(f"Failed to accept friend request: {e}")
        logger.error(f"Traceback: \n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reject-friend-request/{request_id}")
async def reject_friend_request(
    request_id: str, current_user: User = Depends(is_clerk_user)
):
    try:
        sender = users_gateway.reject_friend_request(request_id)
        try:
            await notification_manager.create_and_process_notification(
                Notification.new(
                    user_id=sender.id,
                    message=f"{current_user.name} rejected your friend request.",
                    type="info",
                    related_id=request_id,
                    related_data={
                        "id": sender.id,
                        "name": sender.name,
                        "username": sender.username,
                        "picture": sender.picture,
                    },
                )
            )
            logger.info(f"Sent push notification to {sender.id}")
        except Exception as e:
            logger.error(f"Failed to send push notification: {e}")

        return {
            "message": "Friend request rejected",
            "sender": sender,
        }
    except Exception as e:
        logger.error(f"Failed to reject friend request: {e}")
        logger.error(f"Traceback: \n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/timeline")
async def get_timeline_data(current_user: User = Depends(is_clerk_user)):
    try:
        timeline_data = get_recommended_activity_entries(current_user)
        return timeline_data
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while fetching timeline data: {str(e)}",
        )


def search_users(user: User, username: str, limit: int = 3) -> List[dict]:
    search_patterns = [
        f"^{re.escape(username[:i])}.*" for i in range(len(username), 0, -1)
    ]

    results = []
    for pattern in search_patterns:
        users = users_gateway.get_all_users_by_regex("username", pattern)
        for user in users:
            if user.dict() not in results and user.id != user.id:
                results.append(
                    {
                        "user_id": user.id,
                        "username": user.username,
                        "name": user.name,
                        "picture": user.picture,
                    }
                )

        if len(results) >= limit:
            break

    return results[:limit]


def get_recommended_activity_entries(current_user: User):
    activities = plan_controller.get_recommended_activities(current_user, limit=10)
    activities_dicts = [
        exclude_embedding_fields(activity.dict()) for activity in activities
    ]

    users = {}

    for activity in activities:
        user = users_gateway.get_user_by_id(activity.user_id)
        if user:
            users[user.id] = user.dict()

    users = list(users.values())

    recommended_activity_entries = []
    for activity in activities:
        for entry in activities_gateway.get_all_activity_entries_by_activity_id(
            activity.id
        ):
            entry_dict = exclude_embedding_fields(entry.dict())
            recommended_activity_entries.append(entry_dict)

    return {
        "recommended_activity_entries": recommended_activity_entries,
        "recommended_activities": activities_dicts,
        "recommended_users": users,
    }
