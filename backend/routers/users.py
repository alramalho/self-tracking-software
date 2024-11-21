from fastapi import APIRouter, Depends, Body, HTTPException, Query, Request
from loguru import logger
from typing import List
from auth.clerk import is_clerk_user
from entities.user import User
from gateways.users import UsersGateway
from shared.utils import exclude_embedding_fields
from gateways.activities import ActivitiesGateway
from gateways.moodreports import MoodsGateway
from controllers.plan_controller import PlanController
from gateways.plan_groups import PlanGroupsGateway
from entities.notification import Notification
from services.notification_manager import NotificationManager
from constants import MAX_TIMELINE_ENTRIES
import re
import concurrent.futures
from urllib import parse
import traceback
from gateways.aws.ses import SESGateway, get_email_template_string
from analytics.posthog import posthog
router = APIRouter()

users_gateway = UsersGateway()
activities_gateway = ActivitiesGateway()
moods_gateway = MoodsGateway()
plan_controller = PlanController()
notification_manager = NotificationManager()
plan_groups_gateway = PlanGroupsGateway()
ses_gateway = SESGateway()



@router.get("/user-health")
async def health():
    return {"status": "ok"}


@router.get("/user")
async def get_user(user: User = Depends(is_clerk_user)):
    return user


@router.get("/load-users-data")
async def load_users_data(
    usernames: str = Query(...), current_user: User = Depends(is_clerk_user)
):
    try:
        results = {}
        usernames = usernames.split(",")
        for username in usernames:
            if username == "me":
                user = current_user
            else:
                user = users_gateway.get_user_by_safely("username", username.lower())
                if not user:
                    continue

            # Reuse existing concurrent fetching logic
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

                plans_future = executor.submit(plan_controller.get_all_user_active_plans, user)
                plan_groups_future = executor.submit(
                    plan_groups_gateway.get_all_plan_groups_by_plan_ids, user.plan_ids
                )
                friend_requests_sent_future = executor.submit(
                    users_gateway.friend_request_gateway.get_pending_sent_requests,
                    user.id,
                )
                friend_requests_received_future = executor.submit(
                    users_gateway.friend_request_gateway.get_pending_received_requests,
                    user.id,
                )

                activities = [
                    exclude_embedding_fields(activity.dict())
                    for activity in activities_future.result()
                ]
                entries = [entry.dict() for entry in entries_future.result()]
                mood_reports = [
                    report.dict() for report in mood_reports_future.result()
                ]
                plans = [
                    exclude_embedding_fields(plan.dict())
                    for plan in plans_future.result()
                ]
                plan_groups = [
                    plan_group.dict() for plan_group in plan_groups_future.result()
                ]
                sent_friend_requests = [
                    request.dict() for request in friend_requests_sent_future.result()
                ]
                received_friend_requests = [
                    request.dict()
                    for request in friend_requests_received_future.result()
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

            if current_user.id != user.id and not users_gateway.are_friends(
                current_user.id, user.id
            ):
                logger.info(
                    f"Removing photos from activity entries for {user.id} because {current_user.id} is not friends with them"
                )
                # remove photos from activity entries
                for entry in entries:
                    entry.pop("image", None)

            results[username] = {
                "user": user,
                "activities": activities,
                "activity_entries": entries,
                "mood_reports": mood_reports,
                "plans": plans,
                "plan_groups": plan_groups,
            }

            if current_user.id == user.id:
                results[username]["sent_friend_requests"] = sent_friend_requests
                results[username]["received_friend_requests"] = received_friend_requests

            if username == "me" or username == current_user.username:
                try:
                    posthog.capture(
                        distinct_id=user.id,
                        event="load-user-data",
                        properties={
                            "$set": {
                                "email": user.email,
                                "name": user.name,
                                "username": user.username,
                                "plans_count": len(plans),
                                "plan_groups_count": len(plan_groups),
                                "activities_count": len(activities),
                                "activity_entries_count": len(entries),
                                "friend_count": len(current_user.friend_ids),
                            }
                        },
                    )
                except Exception as e:
                    logger.error(f"Failed to capture pageview: {e}")

        return results
    except Exception as e:
        logger.error(f"Failed to load multiple users data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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

    if len(results) == 0:
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
        friend_request = users_gateway.send_friend_request(
            current_user.id, recipient_id
        )
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
        friends = [users_gateway.get_user_by_id(friend_id).dict() for friend_id in current_user.friend_ids]
        friends_activities_entries = [
            entry.dict()
            for friend_id in current_user.friend_ids
            for entry in activities_gateway.get_most_recent_activity_entries(friend_id, limit=10)
        ]
        sorted_friends_activities_entries = sorted(
            friends_activities_entries,
            key=lambda x: x['created_at'],
            reverse=True
        )[:MAX_TIMELINE_ENTRIES]
        friends_activities = [activities_gateway.get_activity_by_id(aentry['activity_id']).dict() for aentry in sorted_friends_activities_entries]

        return {
            "recommended_activity_entries": friends_activities_entries,
            "recommended_activities": friends_activities,
            "recommended_users": friends,
        }
    except Exception as e:
        logger.error(f"Failed to get timeline data: {e}")
        logger.error(f"Traceback: \n{traceback.format_exc()}")
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
            if user.id not in [result["user_id"] for result in results]:
                results.append(
                    {
                        "user_id": user.id,
                        "username": user.username,
                        "name": user.name,
                        "picture": user.picture,
                    }
                )

        if len(results) >= limit or user.username == username:
            break

    return results[:limit]



@router.post("/report-feedback")
async def report_feedback(request: Request, user: User = Depends(is_clerk_user)):
    try:
        body = await request.json()
        email = body.get("email")
        text = body.get("text")
        type_ = body.get("type")

        email_type_map = {
            "bug_report": "🐞 Bug Report", 
            "help_request": "🆘 Help Request",
            "feature_request": "💡 Feature Request"
        }
        
        subject = f"[Tracking.so] New {email_type_map[type_]} from {email}"

        # Create the email body and properly encode it
        prefilled_content = (
            f"Hey!\n\n"
            f"I'm Alex, the dev from Tracking Software.\n"
            f"Noticed you've opened a {email_type_map[type_]} with '{text}'"
        )
        
        # Properly encode the mailto parameters
        mailto_params = parse.urlencode({
            'subject': f"Re: {email_type_map[type_]} on Tracking.so",
            'body': prefilled_content
        })
        mailto_link = f"mailto:{email}?{mailto_params}"
        
        html_content = get_email_template_string(
            header=email_type_map[type_],
            content=f"""
            <p><strong>From:</strong> {email}</p>
            <p><strong>Message:</strong></p>
            <p>{text}</p>
            <p><a href="{mailto_link}">Reply</a></p>
            """
        )
        
        ses_gateway.send_email(
            to="alexandre.ramalho.1998@gmail.com",
            subject=subject,
            html_body=html_content
        )

        # Track in PostHog
        posthog.capture(
            distinct_id=user.id,
            event=type_,
            properties={
                "email": email,
                "text": text
            }
        )

        return {"status": "success"}
    except Exception as e:
        logger.error(f"Traceback: \n{traceback.format_exc()}")
        logger.error(f"Failed to send feedback email: {e}")
        raise HTTPException(status_code=500, detail=str(e))
