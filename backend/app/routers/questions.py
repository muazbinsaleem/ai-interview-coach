"""
app/routers/questions.py
========================
HTTP layer for interview questions.

Routes:
  GET  /questions/bank    — get questions from trained model (by role + difficulty)
  POST /questions/generate — legacy AI-generated questions (Anthropic-backed)

Note: For the ML-model-powered system with skills personalization, 
      use /interview/generate-questions instead.
"""

import logging

from fastapi import APIRouter, Depends, Query, status

from app.dependencies import get_current_user
from app.models.question import GenerateQuestionsRequest, GenerateQuestionsResponse, Question
from app.models.user import UserPublic
from app.services import ai_service
from app.services import interview_model as model_service
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


# ── NEW: GET /questions/bank (using trained model) ────────────────────────────

@router.get("/bank", status_code=status.HTTP_200_OK)
async def get_questions_from_bank(
    role: str = Query(..., description="Job role (e.g., software engineer)"),
    difficulty: str = Query(..., description="Difficulty: easy, medium, hard"),
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Get interview questions from the trained model's question bank.
    
    This endpoint is used when the user starts an interview without resume skills.
    It returns questions based solely on role and difficulty from the dataset.
    """
    logger.info(
        "GET /questions/bank — user=%s, role=%s, difficulty=%s",
        current_user.id, role, difficulty,
    )

    # Load model if not already loaded
    if model_service.get_model() is None:
        try:
            model_service.load_model()
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return error_response(
                message="Interview model is not available. Please try again later.",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    try:
        # Generate questions from the model
        result = model_service.generate_questions(
            role=role,
            difficulty=difficulty,
        )

        if not result["questions"]:
            logger.warning(f"No questions found for role={role}, difficulty={difficulty}")
            return error_response(
                message=f"No questions available for {role} at {difficulty} level. Please try another role or difficulty.",
                status_code=status.HTTP_404_NOT_FOUND,
            )

        # Transform to frontend expected format
        questions = []
        for q in result["questions"]:
            questions.append(
                Question(
                    id=str(q["id"]),
                    text=q["text"],
                    topic=q.get("category", "General"),
                    role=role,
                    difficulty=difficulty,
                )
            )

        response_data = {
            "questions": [q.model_dump(mode="json") for q in questions]
        }

        logger.info(f"GET /questions/bank — returned {len(questions)} questions")
        return success_response(data=response_data)

    except Exception as e:
        logger.error(f"GET /questions/bank — error: {e}")
        return error_response(
            message="Failed to generate questions. Please try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── Legacy: POST /questions/generate (Anthropic-backed) ───────────────────────

@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_questions(
    request: GenerateQuestionsRequest,
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Generate interview questions for a given role and difficulty.

    **Deprecated** — prefer GET /questions/bank which uses the trained ML model.
    This endpoint is kept for backward compatibility.

    Args:
        request: JSON body with role, difficulty, and optional skills.
        current_user: Injected authenticated user.

    Returns:
        200 with {\"success\": true, \"data\": {\"questions\": [...]}}
        401 if token is invalid.
        500 on generation error.
    """
    logger.info(
        "POST /questions/generate — user=%s, role=%s, difficulty=%s",
        current_user.id, request.role, request.difficulty,
    )

    try:
        result: GenerateQuestionsResponse = await ai_service.generate_interview_questions(request)
        return success_response(data=result.model_dump(mode="json"))
    except Exception as e:
        logger.error("POST /questions/generate — error: %s", e)
        return error_response(
            message="Failed to generate questions",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )