"""
app/services/session_service.py
===============================
Business logic for saving and retrieving interview sessions.

Functions:
  - create_session(user_id, session_data) → SessionResponse
  - get_user_sessions(user_id) → List[SessionResponse]
  - get_session_by_id(session_id, user_id) → SessionDetailResponse | None
"""

import logging
import traceback
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from app.database import supabase
from app.models.session import (
    SessionCreate,
    SessionResponse,
    SessionDetailResponse,
    AnswerResponse,
)

logger = logging.getLogger(__name__)


async def create_session(
    user_id: UUID,
    session_data: SessionCreate,
) -> SessionResponse:
    """
    Save a complete interview session with all answers to Supabase.
    """
    logger.info("create_session — user=%s, role=%s, answers=%d",
                user_id, session_data.role, len(session_data.answers))

    # Calculate overall score (average of all answer scores)
    if session_data.answers:
        overall_score = sum(a.score for a in session_data.answers) / len(session_data.answers)
    else:
        overall_score = 0.0

    # Ensure started_at is timezone-aware
    started_at = session_data.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)

    # Prepare session data for insert
    session_insert = {
        "user_id": str(user_id),
        "role": session_data.role,
        "difficulty": session_data.difficulty,
        "voice_mode": session_data.voice_mode,
        "status": "complete",
        "overall_score": round(overall_score, 2),
        "started_at": started_at.isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        # Validate required fields
        if not session_data.role or not session_data.difficulty:
            raise ValueError(f"Missing required fields: role={session_data.role!r}, difficulty={session_data.difficulty!r}")

        if not session_data.answers:
            raise ValueError("Session must contain at least one answer")

        # Pre-flight: verify the user exists to catch FK errors early
        user_check = supabase.table("users").select("id").eq("id", str(user_id)).execute()
        if not user_check.data:
            raise ValueError(f"User {user_id} not found in database — cannot create session")

        logger.debug(
            "create_session — inserting session: %s",
            {k: v for k, v in session_insert.items() if k != "user_id"},
        )

        # Insert session
        session_result = supabase.table("sessions").insert(session_insert).execute()

        if not session_result.data:
            raise Exception("Session insert returned no data — check RLS policies on 'sessions' table")

        session_id = session_result.data[0]["id"]
        logger.info("create_session — session row created: %s", session_id)

        # Insert all answers
        for i, answer in enumerate(session_data.answers):
            answer_insert = {
                "session_id": str(session_id),
                "question_id": answer.question_id,
                "question_text": answer.question_text,
                "question_topic": answer.question_topic,
                "answer_text": answer.answer_text,
                "score": answer.score,
                "strengths": answer.strengths,
                "weaknesses": answer.weaknesses,
                "suggested_answer": answer.suggested_answer,
                "summary": answer.summary,
            }
            logger.debug("create_session — inserting answer %d/%d", i + 1, len(session_data.answers))
            ans_result = supabase.table("answers").insert(answer_insert).execute()
            if not ans_result.data:
                logger.warning("create_session — answer %d insert returned no data", i + 1)

        logger.info("create_session — created session %s with %d answers",
                    session_id, len(session_data.answers))

        return SessionResponse(
            id=session_id,
            role=session_data.role,
            difficulty=session_data.difficulty,
            voice_mode=session_data.voice_mode,
            overall_score=round(overall_score, 2),
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            answer_count=len(session_data.answers),
        )

    except Exception as e:
        logger.error(
            "create_session — FAILED for user=%s, role=%r, difficulty=%r\n"
            "Error type: %s\nError detail: %s\nTraceback:\n%s",
            user_id,
            session_data.role,
            session_data.difficulty,
            type(e).__name__,
            str(e),
            traceback.format_exc(),
        )
        raise


async def get_user_sessions(user_id: UUID) -> List[SessionResponse]:
    """
    Get all sessions for a user, ordered by most recent.
    """
    user_id_str = str(user_id)
    logger.info("get_user_sessions — user=%s", user_id_str)

    try:
        result = supabase.table("sessions") \
            .select("id, role, difficulty, voice_mode, overall_score, started_at, completed_at") \
            .eq("user_id", user_id_str) \
            .order("completed_at", desc=True) \
            .execute()

        logger.info("get_user_sessions — raw query returned %d rows", len(result.data))

        sessions = []
        for row in result.data:
            # Get answers for this session to count them
            answers_query = supabase.table("answers") \
                .select("id") \
                .eq("session_id", row["id"]) \
                .execute()
            
            # Get the count from the data length
            answer_count = len(answers_query.data) if answers_query.data else 0

            sessions.append(SessionResponse(
                id=row["id"],
                role=row["role"],
                difficulty=row["difficulty"],
                voice_mode=row["voice_mode"],
                overall_score=row["overall_score"],
                started_at=row.get("started_at"),
                completed_at=row.get("completed_at"),
                answer_count=answer_count,
            ))

        logger.info("get_user_sessions — found %d sessions for user %s", len(sessions), user_id_str)
        return sessions

    except Exception as e:
        logger.error("get_user_sessions — database error: %s", e)
        return []


async def get_session_by_id(
    session_id: str,
    user_id: UUID,
) -> Optional[SessionDetailResponse]:
    """
    Get a single session with all its answers.
    """
    user_id_str = str(user_id)
    logger.info("get_session_by_id — session=%s, user=%s", session_id, user_id_str)

    try:
        # Fetch session
        session_result = supabase.table("sessions") \
            .select("*") \
            .eq("id", session_id) \
            .eq("user_id", user_id_str) \
            .execute()

        if not session_result.data:
            logger.warning("get_session_by_id — session not found or not owned")
            return None

        session_row = session_result.data[0]

        # Fetch all answers for this session
        answers_result = supabase.table("answers") \
            .select("*") \
            .eq("session_id", session_id) \
            .execute()

        # Sort answers by created_at if available
        answers_data = sorted(answers_result.data, key=lambda x: x.get("created_at", "")) if answers_result.data else []

        answers = []
        for ans in answers_data:
            answers.append(AnswerResponse(
                id=ans["id"],
                session_id=ans["session_id"],
                question_id=ans["question_id"],
                question_text=ans["question_text"],
                question_topic=ans["question_topic"],
                answer_text=ans["answer_text"],
                score=ans["score"],
                strengths=ans.get("strengths", []),
                weaknesses=ans.get("weaknesses", []),
                suggested_answer=ans.get("suggested_answer", ""),
                summary=ans.get("summary", ""),
                created_at=ans.get("created_at"),
            ))

        logger.info("get_session_by_id — found session with %d answers", len(answers))

        return SessionDetailResponse(
            id=session_row["id"],
            role=session_row["role"],
            difficulty=session_row["difficulty"],
            voice_mode=session_row["voice_mode"],
            overall_score=session_row["overall_score"],
            started_at=session_row.get("started_at"),
            completed_at=session_row.get("completed_at"),
            answers=answers,
        )

    except Exception as e:
        logger.error("get_session_by_id — database error: %s", e)
        return None