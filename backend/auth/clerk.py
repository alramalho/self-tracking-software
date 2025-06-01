import os
from datetime import UTC, datetime, timezone
from typing import Union

from fastapi import Depends, HTTPException, Request, WebSocket, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from loguru import logger
from passlib.context import CryptContext
from constants import CLERK_JWT_PUBLIC_KEY, ENVIRONMENT
from gateways.users import UsersGateway
from entities.user import User
from typing import Tuple

# JWT token settings
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "RS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

def get_token_from_request(request: Request) -> str:
    # Try to get the token from the Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header:
        # Validate Authorization header format
        auth_parts = auth_header.split(" ")
        if len(auth_parts) != 2 or auth_parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header format. Expected 'Bearer <token>'",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = auth_parts[1]
        
        # Validate JWT format (should have 3 segments)
        if len(token.split(".")) != 3:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid JWT format - token must have 3 segments",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return token
    
    # Fallback to getting the token from the __session cookie
    token = request.cookies.get("__session")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication information available",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Validate JWT format for cookie token as well
    if len(token.split(".")) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid JWT format in session cookie - token must have 3 segments",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token

async def get_token_from_websocket(websocket: WebSocket) -> str:
    # Try to get the token from the WebSocket query parameters
    token = websocket.query_params.get("token")
    if not token:
        # If not in query params, check the cookies
        token = websocket.cookies.get("__session")
    
    if not token:
        logger.error('AUTH', "Token not found in query params or session cookie")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication information available",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Validate JWT format (should have 3 segments)
    if len(token.split(".")) != 3:
        logger.error('AUTH', f"Invalid JWT format - token has {len(token.split('.'))} segments instead of 3")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid JWT format - token must have 3 segments",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return token

async def validate_token(token: str) -> Tuple[bool, str]:

    # if ENVIRONMENT == "dev":
    #     return True
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, CLERK_JWT_PUBLIC_KEY, algorithms=[ALGORITHM])

        # Check token expiration
        exp = payload.get("exp")
        clerk_id = payload.get("sub")

        if not exp:
            logger.error("Token does not have an expiration date")
            raise credentials_exception
        if datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
            logger.error("Token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except JWTError as e:
        # Log more specific information about the JWT error
        error_msg = str(e)
        logger.error(f"JWT validation failed. Error: {error_msg}")
        logger.error(f"Token preview (first 50 chars): {token[:50]}...")
        logger.error(f"Token segments count: {len(token.split('.'))}")
        
        if "Not enough segments" in error_msg:
            logger.error("JWT format error: Token should have exactly 3 segments separated by dots (header.payload.signature)")
        elif "Invalid signature" in error_msg:
            logger.error("JWT signature validation failed - check CLERK_JWT_PUBLIC_KEY")
        elif "Invalid header" in error_msg:
            logger.error("JWT header is malformed")
        elif "Invalid payload" in error_msg:
            logger.error("JWT payload is malformed")
            
        raise credentials_exception
    return True, clerk_id

async def is_clerk_user(token: str = Depends(get_token_from_request)) -> User:
    validated, clerk_id = await validate_token(token)
    if validated:
        user = UsersGateway().get_user_by_safely("clerk_id", clerk_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found with clerk id {clerk_id}")
        return user

async def is_clerk_user_ws(websocket: WebSocket) -> User:
    token = await get_token_from_websocket(websocket)
    validated, clerk_id = await validate_token(token)
    if validated:
        user = UsersGateway().get_user_by_safely("clerk_id", clerk_id)
        if not user:
            raise HTTPException(status_code=404, detail=f"User not found with clerk id {clerk_id}")
        return user