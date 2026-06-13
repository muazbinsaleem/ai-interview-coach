"""
app/utils/jwt.py
================
JWT creation and verification helpers.

Uses python-jose under the hood.  The signing secret and algorithm are read
from `app.config.settings` so they never have to be passed as arguments.

Functions:
  - create_access_token(data)  → signed JWT string
  - decode_access_token(token) → raw payload dict or raises HTTPException 401
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger(__name__)


def create_access_token(data: dict[str, Any]) -> str:
    """
    Create a signed JWT containing *data* as the payload claims.

    An `exp` claim is added automatically based on `JWT_EXPIRE_MINUTES`
    in settings.

    Args:
        data: Arbitrary key/value pairs to embed in the token payload.
              Typically contains at least ``{"sub": "<user_id>"}``.

    Returns:
        A signed JWT string ready to be sent to the client.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_expire_minutes
    )
    to_encode["exp"] = expire
    token = jwt.encode(
        to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm
    )
    logger.debug("JWT created — sub=%s, exp=%s", data.get("sub"), expire)
    return token


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a signed JWT.

    Args:
        token: Raw JWT string (without the ``Bearer `` prefix).

    Returns:
        The decoded payload as a plain Python dict.

    Raises:
        HTTPException 401: If the token is invalid, expired, or missing the
                           ``sub`` claim.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload: dict[str, Any] = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
        sub: str | None = payload.get("sub")
        if sub is None:
            logger.warning("JWT decode failed — missing 'sub' claim")
            raise credentials_exception
        return payload
    except JWTError as exc:
        logger.warning("JWT decode error: %s", exc)
        raise credentials_exception from exc
