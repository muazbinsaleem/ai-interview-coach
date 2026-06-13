"""
app/services/dashboard_service.py
=================================
Business logic for dashboard analytics.

Functions:
  - get_dashboard_stats(user_id) → dict with all dashboard metrics
  - calculate_improvement_trend(sessions) → "improving" | "declining" | "stable"
  - get_weak_strong_topics(sessions) → (weak_topics, strong_topics)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Tuple, Dict, Any
from uuid import UUID

from app.database import supabase

logger = logging.getLogger(__name__)


async def get_dashboard_stats(user_id: UUID) -> Dict[str, Any]:
    """
    Generate comprehensive dashboard analytics for a user.

    Args:
        user_id: UUID of the authenticated user.

    Returns:
        Dictionary with:
          - total_sessions: int
          - average_score: float
          - scores_over_time: list of {date, score}
          - weak_topics: list of topics with lowest scores
          - strong_topics: list of topics with highest scores
          - best_role: role with highest average score
          - sessions_this_week: int
          - improvement_trend: "improving" | "declining" | "stable"
    """
    logger.info("get_dashboard_stats — user=%s", user_id)
    user_id_str = str(user_id)

    try:
        # Fetch all sessions for this user
        sessions_result = supabase.table("sessions") \
            .select("id, role, overall_score, completed_at") \
            .eq("user_id", user_id_str) \
            .execute()

        sessions = sessions_result.data

        if not sessions:
            logger.info("get_dashboard_stats — no sessions found for user %s", user_id)
            return _empty_dashboard_stats()

        # --- Basic metrics ---
        total_sessions = len(sessions)
        avg_score = sum(s["overall_score"] for s in sessions) / total_sessions

        # --- Sort valid sessions ASCENDING (oldest first) ---
        # This order is required by _calculate_improvement_trend.
        valid_sessions = [s for s in sessions if s.get("completed_at")]
        valid_sessions.sort(key=lambda x: x["completed_at"])

        # --- Scores over time: take last 10, display newest first ---
        scores_over_time = [
            {
                "date": s["completed_at"][:10],
                "score": round(s["overall_score"], 1),
            }
            for s in reversed(valid_sessions[-10:])
        ]

        # --- Sessions this week ---
        # FIX: use timezone-aware datetime so comparison with Supabase ISO
        # timestamps (which include +00:00 / Z) doesn't raise TypeError.
        now_utc = datetime.now(timezone.utc)
        week_ago = now_utc - timedelta(days=7)
        sessions_this_week = 0
        for s in sessions:
            raw = s.get("completed_at")
            if not raw:
                continue
            try:
                raw = raw.replace("Z", "+00:00")
                dt = datetime.fromisoformat(raw)
                # If somehow still naive, treat as UTC
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                if dt > week_ago:
                    sessions_this_week += 1
            except (ValueError, TypeError):
                pass

        # --- Improvement Trend ---
        # valid_sessions is ascending (oldest first), which is what the
        # function expects: sessions[:3] = oldest, sessions[-3:] = newest.
        improvement_trend = _calculate_improvement_trend(valid_sessions)

        # --- Best Role ---
        best_role = _calculate_best_role(sessions)

        # --- Weak and Strong Topics ---
        weak_topics, strong_topics = await _get_weak_strong_topics(user_id)

        stats = {
            "total_sessions": total_sessions,
            "average_score": round(avg_score, 2),
            "scores_over_time": scores_over_time,
            "weak_topics": weak_topics[:5],
            "strong_topics": strong_topics[:5],
            "best_role": best_role,
            "sessions_this_week": sessions_this_week,
            "improvement_trend": improvement_trend,
        }

        logger.info(
            "get_dashboard_stats — total=%d, avg=%.2f, trend=%s, week=%d",
            total_sessions, avg_score, improvement_trend, sessions_this_week,
        )
        return stats

    except Exception as e:
        logger.error("get_dashboard_stats — database error: %s", e, exc_info=True)
        return _empty_dashboard_stats()


def _calculate_improvement_trend(sessions: List[Dict]) -> str:
    """
    Compare the average score of the first 3 sessions vs the last 3 sessions.

    Args:
        sessions: Session dicts sorted ASCENDING by completed_at (oldest first).

    Returns:
        "improving" | "declining" | "stable"
    """
    if len(sessions) < 4:
        return "stable"

    avg_first = sum(s["overall_score"] for s in sessions[:3]) / 3
    avg_last  = sum(s["overall_score"] for s in sessions[-3:]) / 3

    if avg_last > avg_first + 0.5:
        return "improving"
    elif avg_last < avg_first - 0.5:
        return "declining"
    return "stable"


def _calculate_best_role(sessions: List[Dict]) -> str:
    """
    Return the role with the highest average score across all sessions.

    Args:
        sessions: List of session dicts.

    Returns:
        Role name string, or "N/A" if no sessions.
    """
    role_scores: Dict[str, List[float]] = {}
    for s in sessions:
        role = s.get("role", "unknown")
        role_scores.setdefault(role, []).append(s.get("overall_score", 0))

    if not role_scores:
        return "N/A"

    return max(
        role_scores,
        key=lambda r: sum(role_scores[r]) / len(role_scores[r]),
    )


async def _get_weak_strong_topics(user_id: UUID) -> Tuple[List[str], List[str]]:
    """
    Analyse answer topics to identify weak and strong areas.

    Args:
        user_id: UUID of the user.

    Returns:
        Tuple of (weak_topics, strong_topics) lists.
    """
    user_id_str = str(user_id)
    try:
        sessions_result = supabase.table("sessions") \
            .select("id") \
            .eq("user_id", user_id_str) \
            .execute()

        session_ids = [s["id"] for s in sessions_result.data]
        if not session_ids:
            return [], []

        answers_result = supabase.table("answers") \
            .select("question_topic, score") \
            .in_("session_id", session_ids) \
            .execute()

        topic_scores: Dict[str, List[float]] = {}
        for ans in answers_result.data:
            topic = ans.get("question_topic", "General")
            topic_scores.setdefault(topic, []).append(ans.get("score", 0))

        if not topic_scores:
            return [], []

        topic_avg = {t: sum(v) / len(v) for t, v in topic_scores.items()}
        sorted_topics = sorted(topic_avg.items(), key=lambda x: x[1])

        weak_topics   = [t for t, _ in sorted_topics[:3]]
        strong_topics = [t for t, _ in sorted_topics[-3:][::-1]]

        logger.info(
            "_get_weak_strong_topics — weak=%s, strong=%s",
            weak_topics, strong_topics,
        )
        return weak_topics, strong_topics

    except Exception as e:
        logger.error("_get_weak_strong_topics — error: %s", e)
        return [], []


def _empty_dashboard_stats() -> Dict[str, Any]:
    """Return zeroed-out stats when the user has no sessions."""
    return {
        "total_sessions": 0,
        "average_score": 0.0,
        "scores_over_time": [],
        "weak_topics": [],
        "strong_topics": [],
        "best_role": "N/A",
        "sessions_this_week": 0,
        "improvement_trend": "stable",
    }