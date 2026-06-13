"""
app/routers/auth.py
===================
HTTP layer for the authentication domain.

Routes:
  POST /auth/signup  — create account, return JWT
  POST /auth/login   — verify credentials, return JWT
  GET  /auth/me      — return current user from Bearer token

Each handler does nothing except validate input, delegate to the service
layer, and format the response.  Zero business logic lives here.
"""

import logging

from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user
from app.models.user import LoginRequest, SignupRequest, UserPublic
from app.services import auth_service
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(request: SignupRequest):
    """
    Register a new user account.

    Args:
        request: JSON body containing ``name``, ``email``, and ``password``.

    Returns:
        201 with ``{"success": true, "data": {"token": "...", "user": {...}}}``
        409 if the email is already in use.
    """
    logger.info("POST /auth/signup — email=%s", request.email)
    auth_data = auth_service.signup_user(request)
    return success_response(
        data=auth_data.model_dump(mode="json"),
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/login", status_code=status.HTTP_200_OK)
def login(request: LoginRequest):
    """
    Authenticate an existing user and return a fresh JWT.

    Args:
        request: JSON body containing ``email`` and ``password``.

    Returns:
        200 with ``{"success": true, "data": {"token": "...", "user": {...}}}``
        401 if credentials are invalid.
    """
    logger.info("POST /auth/login — email=%s", request.email)
    auth_data = auth_service.login_user(request)
    return success_response(data=auth_data.model_dump(mode="json"))


@router.get("/me", status_code=status.HTTP_200_OK)
def me(current_user: UserPublic = Depends(get_current_user)):
    """
    Return the currently authenticated user's profile.

    Args:
        current_user: Injected by the ``get_current_user`` dependency after
                      validating the Bearer token.

    Returns:
        200 with ``{"success": true, "data": {"id", "name", "email", "created_at"}}``
        401 if the token is missing or invalid.
    """
    logger.info("GET /auth/me — user_id=%s", current_user.id)
    return success_response(data=current_user.model_dump(mode="json"))
