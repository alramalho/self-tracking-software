import os
from datetime import UTC, datetime, timezone
from typing import Union

from fastapi import Depends, HTTPException, Request, WebSocket, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from loguru import logger
from passlib.context import CryptContext
from constants import CLERK_JWT_PUBLIC_KEY, ENVIRONMENT

# JWT token settings
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "RS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

def get_token_from_request(request: Request) -> str:
    # Try to get the token from the Authorization header first
    auth_header = request.headers.get("Authorization")
    if auth_header:
        return auth_header.split(" ")[1]
    
    # Fallback to getting the token from the _session cookie
    token = request.cookies.get("__session")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication information available",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token

async def get_token_from_websocket(websocket: WebSocket) -> str:
    logger.info('Getting token from websocket')
    # Try to get the token from the WebSocket query parameters
    token = websocket.query_params.get("token")
    if not token:
        # If not in query params, check the cookies
        token = websocket.cookies.get("__session")
    
    if not token:
        logger.error("Token not found in query params or session cookie")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication information available",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token

async def validate_token(token: str) -> bool:
    logger.info("Validating token")

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
        logger.info(f"User w/ clerk id {clerk_id} authorized.")

        if not exp:
            raise credentials_exception
        if datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(tz=timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except JWTError as e:
        logger.error(f"Could not validate user credentials. Error: {str(e)}")
        raise credentials_exception
    return True

async def is_clerk_user(token: str = Depends(get_token_from_request)) -> bool:
    return await validate_token(token)

async def is_clerk_user_ws(websocket: WebSocket) -> bool:
    token = await get_token_from_websocket(websocket)
    return await validate_token(token)