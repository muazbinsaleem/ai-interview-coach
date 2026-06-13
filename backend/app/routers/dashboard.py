"""
app/routers/dashboard.py
========================
HTTP layer for dashboard analytics.

Routes:
  GET /dashboard — get user progress stats and insights

Each handler does nothing except validate input, delegate to the service
layer, and format the response.
"""

import logging

from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user
from app.models.user import UserPublic
from app.services.dashboard_service import get_dashboard_stats
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", status_code=status.HTTP_200_OK)
async def get_dashboard(
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Get dashboard analytics for the authenticated user.

    Returns:
        {
            "total_sessions": int,
            "average_score": float,
            "scores_over_time": [{"date": "2024-01-01", "score": 7.5}],
            "weak_topics": ["System Design"],
            "strong_topics": ["React Hooks"],
            "best_role": "frontend",
            "sessions_this_week": int,
            "improvement_trend": "improving" | "declining" | "stable"
        }

    401 if token is invalid.
    """
    logger.info("GET /dashboard — user=%s", current_user.id)

    try:
        stats = await get_dashboard_stats(current_user.id)
        return success_response(data=stats)
    except Exception as e:
        logger.error("GET /dashboard — error: %s", e)
        return error_response(
            message="Failed to fetch dashboard stats",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )