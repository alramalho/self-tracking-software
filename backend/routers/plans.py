from fastapi import APIRouter, Depends, Body, HTTPException
from typing import Dict, List
from auth.clerk import is_clerk_user
from entities.user import User
from controllers.plan_controller import PlanController
from gateways.users import UsersGateway
from gateways.activities import ActivitiesGateway
from services.notification_manager import NotificationManager
from entities.notification import Notification
from loguru import logger
from fastapi import Request
import traceback
from entities.plan_group import PlanGroup, PlanGroupMember
from gateways.plan_groups import PlanGroupsGateway
from gateways.plan_invitations import PlanInvitationsGateway
from shared.utils import exclude_embedding_fields
from entities.plan_invitation import PlanInvitation

router = APIRouter()

plan_controller = PlanController()
users_gateway = UsersGateway()
activities_gateway = ActivitiesGateway()
notification_manager = NotificationManager()
plan_groups_gateway = PlanGroupsGateway()
plan_invitations_gateway = PlanInvitationsGateway()

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
async def create_plan(plan_data: dict = Body(...), current_user: User = Depends(is_clerk_user)):
    new_plan, created_activities = plan_controller.create_plan_from_generated_plan(current_user.id, plan_data)
    
    # Create a PlanGroup for the new plan
    plan_group = PlanGroup.new(
        plan_ids=[new_plan.id],
        members=[PlanGroupMember(
            user_id=current_user.id,
            username=current_user.username,
            name=current_user.name,
            picture=current_user.picture
        )]
    )
    plan_groups_gateway.upsert_plan_group(plan_group)
    
    # Update the plan with the plan_group_id
    new_plan.plan_group_id = plan_group.id
    plan_controller.update_plan(new_plan)

    # Update the user with the new plan_id
    users_gateway.add_plan_to_user(current_user.id, new_plan.id)
    
    return {"plan": new_plan, "plan_group": plan_group, "activities": created_activities}

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

@router.post("/invite-to-plan/{plan_id}/{invitee_id}")
async def invite_to_plan(
    plan_id: str, invitee_id: str, current_user: User = Depends(is_clerk_user)
):
    plan = plan_controller.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    if plan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to invite to this plan")
    
    invitee = users_gateway.get_user_by_id(invitee_id)
    if not invitee:
        raise HTTPException(status_code=404, detail="Invitee not found")
    
    plan_group = plan_groups_gateway.get_plan_group_by_plan_id(plan.id)
    if not plan_group:
        raise HTTPException(status_code=404, detail="Plan group not found")
    
    if invitee.id not in current_user.friend_ids:
        friend_request = users_gateway.send_friend_request(current_user.id, invitee.id)
        notification = await notification_manager.create_and_process_notification(
            Notification.new(
                user_id=invitee.id,
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

    # Update plan with plan group id
    plan.plan_group_id = plan_group.id
    plan_controller.update_plan(plan)
    
    # Update plan group members
    current_user_member = PlanGroupMember(
        user_id=current_user.id,
        username=current_user.username,
        name=current_user.name,
        picture=current_user.picture
    )

    plan_groups_gateway.add_member(plan_group, current_user_member)
    # Create a plan invitation
    plan_invitation = PlanInvitation.new(
        plan_id=plan.id,
        recipient_id=invitee_id,
        sender_id=current_user.id
    )
    plan_invitations_gateway.upsert_plan_invitation(plan_invitation)
    
    # Create a notification for the invitee
    notification = await notification_manager.create_and_process_notification(
        Notification.new(
            user_id=invitee_id,
            message=f"{current_user.name} invited you to join their plan: {plan.goal}",
            type="plan_invitation",
            related_id=plan_invitation.id,
            related_data={
                "id": current_user.id,
                "name": current_user.name,
                "username": current_user.username,
                "picture": current_user.picture
            }
        )
    )
    
    return {"message": "Invitation sent successfully", "notification": notification}

@router.post("/accept-plan-invitation/{invitation_id}")
async def accept_plan_invitation(
    invitation_id: str,
    request: Request,
    user: User = Depends(is_clerk_user)
):
    try:
        body = await request.json()
        activity_associations = body.get("activity_associations", [])
        plan = plan_controller.accept_plan_invitation(invitation_id, activity_associations)
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

@router.get("/plan-group/{plan_id}")
async def get_plan_group(plan_id: str, current_user: User = Depends(is_clerk_user)):
    plan = plan_controller.get_plan_by_id(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    if plan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this plan group")
    
    plan_group = plan_groups_gateway.get_plan_group_by_plan_id(plan_id)
    if not plan_group:
        return {"members": []}
    
    return plan_group

@router.get("/get-plan-from-invitation-id/{invitation_id}")
async def get_plan_from_invitation_id(invitation_id: str, user: User = Depends(is_clerk_user)):
    try:
        invitation = plan_invitations_gateway.get(invitation_id)
        if not invitation:
            raise ValueError("Invitation not found")
        
        plan = plan_controller.get_plan(invitation.plan_id)
        if not plan:
            raise ValueError("Plan not found")
        
        user_activities = activities_gateway.get_all_activities_by_user_id(invitation.recipient_id)
        plan_activity_ids = list(set([session.activity_id for session in plan.sessions]))
        plan_activities = activities_gateway.get_all_activites_by_ids(plan_activity_ids)
        
        return {
            "plan": exclude_embedding_fields(plan.dict()),
            "plan_activities": [exclude_embedding_fields(activity.dict()) for activity in plan_activities],
            "user_activities": [exclude_embedding_fields(activity.dict()) for activity in user_activities],
            "invitation": invitation.dict()
        }
    except Exception as e:
        logger.error(f"Failed to get plan from invitation: {e}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

