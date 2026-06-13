"""
app/routers/sessions.py
=======================
HTTP layer for session management.

Routes:
  POST /sessions       — save a completed interview session
  GET  /sessions       — list all sessions for the current user
  GET  /sessions/{id}  — get a single session with all answers
"""

import logging

from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user
from app.models.session import SessionCreate, SessionResponse, SessionDetailResponse
from app.models.user import UserPublic
from app.services import session_service
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_session(
    session_data: SessionCreate,
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Save a completed interview session with all answers.

    Args:
        session_data: JSON body with role, difficulty, voice_mode, started_at, answers.
        current_user: Injected authenticated user.

    Returns:
        201 with {"success": true, "data": {session summary}}
        401 if token is invalid.
        500 on database error.
    """
    logger.info(
        "POST /sessions — user=%s, role=%s, answers=%d",
        current_user.id, session_data.role, len(session_data.answers)
    )

    try:
        result = await session_service.create_session(current_user.id, session_data)
        return success_response(
            data=result.model_dump(mode="json"),
            status_code=status.HTTP_201_CREATED,
        )
    except Exception as e:
        logger.error("POST /sessions — error: %s", e)
        return error_response(
            message=f"Failed to save session: {e}",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/", status_code=status.HTTP_200_OK)
async def list_sessions(
    current_user: UserPublic = Depends(get_current_user),
):
    """
    List all sessions for the current user, newest first.

    Returns:
        200 with {"success": true, "data": [session summaries]}
        401 if token is invalid.
    """
    logger.info("GET /sessions — user=%s", current_user.id)

    try:
        sessions = await session_service.get_user_sessions(current_user.id)
        return success_response(data=[s.model_dump(mode="json") for s in sessions])
    except Exception as e:
        logger.error("GET /sessions — error: %s", e)
        return error_response(
            message="Failed to fetch sessions",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/{session_id}", status_code=status.HTTP_200_OK)
async def get_session(
    session_id: str,
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Get a single session with all its answers.

    Args:
        session_id: UUID string of the target session.
        current_user: Injected authenticated user.

    Returns:
        200 with full session including all answers.
        404 if session not found or not owned by user.
        401 if token is invalid.
    """
    logger.info("GET /sessions/%s — user=%s", session_id, current_user.id)

    try:
        session = await session_service.get_session_by_id(session_id, current_user.id)
        if not session:
            return error_response(
                message="Session not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        return success_response(data=session.model_dump(mode="json"))
    except Exception as e:
        logger.error("GET /sessions/%s — error: %s", session_id, e)
        return error_response(
            message="Failed to fetch session",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
