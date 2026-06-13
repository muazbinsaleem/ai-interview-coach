"""
app/utils/hashing.py
====================
Password hashing and verification helpers.

Uses passlib with the bcrypt backend.  The CryptContext is created once at
module import time and reused for every call.

Functions:
  - hash_password(plain)        → bcrypt hash string
  - verify_password(plain, hash) → bool
"""

import logging
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """
    Hash a plain-text password using bcrypt.

    Args:
        plain_password: The raw password supplied by the user.

    Returns:
        A bcrypt hash string safe to store in the database.
    """
    hashed = _pwd_context.hash(plain_password)
    logger.debug("Password hashed successfully")
    return hashed


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Check whether *plain_password* matches the stored *hashed_password*.

    Args:
        plain_password:  Raw password from the login request.
        hashed_password: bcrypt hash retrieved from the database.

    Returns:
        ``True`` if the password is correct, ``False`` otherwise.
    """
    result = _pwd_context.verify(plain_password, hashed_password)
    logger.debug("Password verification result: %s", result)
    return result
