"""
app/dependencies.py
===================
FastAPI dependency functions shared across routers.

Provides:
  - get_current_user(token) → UserPublic
      Validates the Bearer token in the Authorization header and returns
      the authenticated user.  Raise HTTP 401 on any failure.
"""

import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.user import UserPublic
from app.utils.jwt import decode_access_token
from app.database import supabase

logger = logging.getLogger(__name__)

_bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> UserPublic:
    """
    FastAPI dependency — resolve and return the authenticated user.

    Reads the ``Authorization: Bearer <token>`` header, validates the JWT,
    looks up the user in Supabase, and returns a :class:`UserPublic` instance.

    Args:
        credentials: Injected by FastAPI from the Authorization header.

    Returns:
        :class:`~app.models.user.UserPublic` for the authenticated user.

    Raises:
        HTTPException 401: If the token is missing, invalid, or the user
                           no longer exists in the database.
    """
    token = credentials.credentials
    payload = decode_access_token(token)
    user_id: str = payload.get("sub", "")

    if not user_id:
        logger.warning("get_current_user — no sub in token payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        result = supabase.table("users").select("*").eq("id", user_id).single().execute()
    except Exception as exc:
        logger.error("get_current_user — Supabase error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not result.data:
        logger.warning("get_current_user — user %s not found", user_id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_data = result.data
    logger.debug("get_current_user — resolved user_id=%s", user_id)
    return UserPublic(
        id=user_data["id"],
        name=user_data["name"],
        email=user_data["email"],
        created_at=user_data.get("created_at"),
    )
