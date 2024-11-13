from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from auth.clerk import is_clerk_user
from entities.user import User
from services.notification_manager import NotificationManager
from constants import ADMIN_API_KEY
from entities.notification import Notification

router = APIRouter()
security = HTTPBearer()

notification_manager = NotificationManager()


async def admin_auth(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    token = credentials.credentials

    if not ADMIN_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Admin API key not set"
        )
    
    # Verify admin token
    if token != ADMIN_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid admin token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return True

@router.post("/send-notification")
async def send_notification(request: Request, verified: User = Depends(admin_auth)):
    body = await request.json()
    notification = Notification.new(
        user_id=body.get("user_id"),
        message=body.get("message"),
        type=body.get("type", "info"),
        related_id=body.get("related_id", None),
        prompt_tag=body.get("prompt_tag", None),
        related_data=body.get("related_data", None),
    )
    await notification_manager.create_and_process_notification(notification)
    return {"message": "Notification sent successfully"}


