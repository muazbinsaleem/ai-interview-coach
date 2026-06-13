"""
app/routers/evaluate.py
=======================
Legacy HTTP layer for answer evaluation (pre-ML-model era).

Routes:
  POST /evaluate — evaluate a candidate answer via ai_service (Anthropic-backed)

Note: For the ML-model-powered system, use /interview/evaluate-answer instead.
"""

import logging

from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user
from app.models.answer import EvaluateAnswerRequest, EvaluationResult
from app.models.user import UserPublic
from app.services import ai_service
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", status_code=status.HTTP_200_OK)
async def evaluate_answer(
    request: EvaluateAnswerRequest,
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Evaluate a candidate's answer to an interview question.

    **Deprecated** — prefer POST /interview/evaluate-answer which uses the
    trained ML model for similarity-based scoring combined with Gemini feedback.

    Args:
        request: JSON body with question_text, answer_text, role, difficulty.
        current_user: Injected authenticated user.

    Returns:
        200 with {\"success\": true, \"data\": {\"score\": ..., \"strengths\": [...], ...}}
        401 if token is invalid.
        500 on evaluation error.
    """
    logger.info(
        "POST /evaluate — user=%s, role=%s, difficulty=%s",
        current_user.id, request.role, request.difficulty,
    )

    try:
        result: EvaluationResult = await ai_service.evaluate_candidate_answer(request)
        return success_response(data=result.model_dump(mode="json"))
    except Exception as e:
        logger.error("POST /evaluate — error: %s", e)
        return error_response(
            message="Failed to evaluate answer",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
