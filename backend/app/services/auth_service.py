"""
app/services/auth_service.py
============================
All business logic for the authentication domain.

Functions:
  - signup_user(request)     → AuthResponse
  - login_user(request)      → AuthResponse
  - get_user_by_id(user_id)  → UserPublic

Raises HTTPException on expected errors (duplicate email, bad credentials).
All Supabase calls and JWT generation happen here — routers contain none.
"""

import logging
from uuid import UUID

from fastapi import HTTPException, status

from app.database import supabase
from app.models.user import AuthResponse, LoginRequest, SignupRequest, UserPublic
from app.utils.hashing import hash_password, verify_password
from app.utils.jwt import create_access_token

logger = logging.getLogger(__name__)


# ── Internal helpers ──────────────────────────────────────────────────────────


def _build_user_public(row: dict) -> UserPublic:
    """
    Construct a :class:`UserPublic` from a raw Supabase row dict.

    Args:
        row: A single row dictionary returned by Supabase.

    Returns:
        Validated :class:`UserPublic` instance.
    """
    return UserPublic(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        created_at=row.get("created_at"),
    )


# ── Public service functions ──────────────────────────────────────────────────


def signup_user(request: SignupRequest) -> AuthResponse:
    """
    Register a new user.

    Steps:
      1. Check whether the email is already in use.
      2. Hash the password with bcrypt.
      3. Insert a new row into the ``users`` table.
      4. Generate a JWT.
      5. Return token + public user data.

    Args:
        request: Validated :class:`SignupRequest` from the router.

    Returns:
        :class:`AuthResponse` containing the JWT and public user info.

    Raises:
        HTTPException 409: If the email address is already registered.
        HTTPException 500: If the Supabase insert fails for any other reason.
    """
    logger.info("signup_user — checking email: %s", request.email)

    # 1. Check for duplicate email
    try:
        existing = (
            supabase.table("users")
            .select("id")
            .eq("email", request.email)
            .execute()
        )
    except Exception as exc:
        logger.error("signup_user — Supabase select error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error during email check",
        ) from exc

    if existing.data:
        logger.warning("signup_user — email already exists: %s", request.email)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email address is already registered",
        )

    # 2. Hash password
    hashed = hash_password(request.password)

    # 3. Insert user
    new_user_data = {
        "name": request.name,
        "email": request.email,
        "password_hash": hashed,
    }
    try:
        insert_result = (
            supabase.table("users").insert(new_user_data).execute()
        )
    except Exception as exc:
        logger.error("signup_user — Supabase insert error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        ) from exc

    if not insert_result.data:
        logger.error("signup_user — insert returned no data")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

    user_row = insert_result.data[0]
    user_public = _build_user_public(user_row)

    # 4. Generate JWT
    token = create_access_token({"sub": str(user_public.id)})

    logger.info("signup_user — new user registered: id=%s email=%s", user_public.id, request.email)
    return AuthResponse(token=token, user=user_public)


def login_user(request: LoginRequest) -> AuthResponse:
    """
    Authenticate an existing user and return a fresh JWT.

    Steps:
      1. Fetch the user row by email.
      2. Verify the supplied password against the stored hash.
      3. Generate a JWT.
      4. Return token + public user data.

    Args:
        request: Validated :class:`LoginRequest` from the router.

    Returns:
        :class:`AuthResponse` containing the JWT and public user info.

    Raises:
        HTTPException 401: If the email is not found or the password is wrong.
    """
    logger.info("login_user — attempt for email: %s", request.email)

    # 1. Look up user
    try:
        result = (
            supabase.table("users")
            .select("*")
            .eq("email", request.email)
            .execute()
        )
    except Exception as exc:
        logger.error("login_user — Supabase error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error",
        ) from exc

    if not result.data:
        logger.warning("login_user — email not found: %s", request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user_row = result.data[0]

    # 2. Verify password
    if not verify_password(request.password, user_row["password_hash"]):
        logger.warning("login_user — wrong password for email: %s", request.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    user_public = _build_user_public(user_row)

    # 3. Generate JWT
    token = create_access_token({"sub": str(user_public.id)})

    logger.info("login_user — success: id=%s email=%s", user_public.id, request.email)
    return AuthResponse(token=token, user=user_public)


def get_user_by_id(user_id: UUID) -> UserPublic:
    """
    Fetch a user by primary key and return the public representation.

    Args:
        user_id: UUID of the target user.

    Returns:
        :class:`UserPublic` for the requested user.

    Raises:
        HTTPException 404: If no user with that ID exists.
    """
    logger.info("get_user_by_id — id=%s", user_id)
    try:
        result = (
            supabase.table("users")
            .select("id, name, email, created_at")
            .eq("id", str(user_id))
            .single()
            .execute()
        )
    except Exception as exc:
        logger.error("get_user_by_id — Supabase error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        ) from exc

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return _build_user_public(result.data)
