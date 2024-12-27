from loguru import logger
from gateways.users import UsersGateway
from entities.user import User
from fastapi import APIRouter, HTTPException, Request, Depends, status
from svix.webhooks import Webhook, WebhookVerificationError
from constants import SVIX_SECRET
import traceback

async def is_svix_verified(request: Request) -> bool:
    headers = request.headers
    payload = await request.body()
    logger.info("Verifying svix webhook")

    try:
        webhook = Webhook(SVIX_SECRET)
        webhook.verify(payload, headers)
        logger.info("Webhook verified")
    except WebhookVerificationError as e:
        logger.error(f"Could not validate webhook signature. Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not validate webhook signature",
        )
    return True

router = APIRouter(prefix="/clerk", dependencies=[Depends(is_svix_verified)])  # Replace with your actual table name

@router.post("/webhook")
async def user_event_webhook(request: Request):
    try:
        payload = await request.json()
        event_type = payload.get("type")

        logger.info(f"Received clerk webhook {event_type}")
        
        data = payload.get("data")
        if not event_type or not data:
            raise HTTPException(status_code=400, detail="Missing event type or data")

        user_clerk_id = data["id"]
        email_address = data["email_addresses"][0]["email_address"]
        first_name = data["first_name"]
        last_name = data["last_name"]
        username = data["username"]
        picture = None
        if data.get("external_accounts"):
            picture = data.get("profile_image_url")
            
            if not picture:
                picture = data.get("external_accounts")[0].get("picture")

            if picture:
                logger.info(f"Picture found!")
                picture = picture.strip('"')
            else:
                logger.info(f"No picture found for user {user_clerk_id}")
        else:
            logger.info(f"No external accounts found for user {user_clerk_id}")
        users_gateway = UsersGateway()

        if event_type == "user.created":
            user = users_gateway.get_user_by_safely("email", email_address)
            if user:
                users_gateway.update_fields(
                    user.id,
                    {
                        "email": email_address,
                        "name": f"{first_name} {last_name}",
                        "clerk_id": user_clerk_id,
                        "username": username,
                        "picture": picture,  # Add the picture field
                    },
                )
                logger.info(f"User with email '{email_address}' updated.")
            else:
                logger.info(
                    f"User with email '{email_address}' not found. Creating new user."
                )
                users_gateway.create_user(
                    User.new(
                        email=email_address,
                        name=f"{first_name} {last_name}",
                        username=username,
                        clerk_id=user_clerk_id,
                        picture=picture,  # Add the picture field
                    )
                )
            return {"status": "success", "message": "User created successfully"}
        elif event_type == "user.updated":
            user = users_gateway.get_user_by_safely("clerk_id", user_clerk_id)
            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            users_gateway.update_fields(
                user.id,
                {
                    "email": email_address,
                    "name": f"{first_name} {last_name}",
                    "username": username,
                    "clerk_id": user_clerk_id,
                    "picture": picture,  # Add the picture field
                },
            )
            return {"status": "success", "message": "User updated successfully"}
        elif event_type == "user.deleted":
            user = users_gateway.get_user_by("clerk_id", user_clerk_id)
            users_gateway.delete_user(user_id=user.id)
            return {"status": "success", "message": "User deleted successfully"}
        else:
            error_msg = f"Unhandled event type: {event_type}"
            logger.error(error_msg)
            raise HTTPException(status_code=400, detail=error_msg)

    except KeyError as e:
        logger.error(f"Missing key in payload: {e}")
        raise HTTPException(status_code=400, detail=f"Missing key in payload: {e}")
    except Exception as e:
        traceback.print_exc()
        logger.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))
