from fastapi import APIRouter, Depends, Body, HTTPException
from typing import Dict, List
from auth.clerk import is_clerk_user
from entities.user import User
from controllers.plan_controller import PlanController
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway
from services.notification_manager import NotificationManager

router = APIRouter()

plan_controller = PlanController()
users_gateway = UsersGateway()
activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()

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

@router.post("/invite-to-plan/{plan_id}/{recipient_id}")
async def invite_to_plan(plan_id: str, recipient_id: str, user: User = Depends(is_clerk_user)):
    try:
        invitation = plan_controller.invite_user_to_plan(plan_id, user.id, recipient_id)
        notification = notification_manager.create_notification(
            user_id=recipient_id,
            message=f"{user.name} invited you to join a plan",
            notification_type="plan_invitation",
            related_id=invitation.id
        )
        return {
            "message": "Invitation sent successfully",
            "invitation": invitation,
            "notification": notification
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/accept-plan-invitation/{invitation_id}")
async def accept_plan_invitation(invitation_id: str, user: User = Depends(is_clerk_user)):
    try:
        plan = plan_controller.accept_plan_invitation(invitation_id)
        return {"message": "Invitation accepted successfully", "plan": plan}
    except Exception as e:
        logger.error(f"Failed to accept plan invitation: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/reject-plan-invitation/{invitation_id}")
async def reject_plan_invitation(invitation_id: str, user: User = Depends(is_clerk_user)):
    try:
        plan_controller.reject_plan_invitation(invitation_id)
        return {"message": "Invitation rejected successfully"}
    except Exception as e:
        logger.error(f"Failed to reject plan invitation: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))
