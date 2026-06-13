"""
app/routers/interview.py
========================
HTTP layer for the ML-model-powered interview system.

Routes:
  POST /interview/generate-questions  — get questions for role+difficulty (with skills personalization)
  POST /interview/evaluate-answer     — score a single answer (ML + Gemini)
  POST /interview/evaluate-session    — evaluate and enhance a full session
  POST /interview/save-session        — evaluate + persist to database

Score scale (used consistently everywhere):
  ML model  → 0–3  (raw)
  Public API → 0–10 (score_10 = raw * 10/3, rounded to 1 dp)
  Labels: 0–1 → "bad" | 1–2 → "average" | 2–3 → "good"

Question flow:
  Resume mode  (skills provided) → Gemini personalized  → skill-template fallback
  Practice mode (no skills)      → Gemini technical      → filtered ML bank fallback
"""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user
from app.models.interview import (
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    EvaluateSessionRequest,
    EvaluateSessionResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
    InterviewQuestion,
    ScoredAnswer,
    StrengthsWeaknesses,
)
from app.models.session import AnswerCreate, SessionCreate
from app.models.user import UserPublic
from app.services import gemini_service
from app.services import interview_model as model_service
from app.services.session_service import create_session
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_feedback_schema(feedback: dict) -> StrengthsWeaknesses:
    """Convert a raw feedback dict to the Pydantic schema."""
    return StrengthsWeaknesses(
        strengths=feedback.get("strengths") or [],
        weaknesses=feedback.get("weaknesses") or [],
        tips=feedback.get("tips") or [],
        follow_up=feedback.get("follow_up"),
    )


def _score_10(raw_score: float) -> float:
    """Convert a 0–3 ML score to a 0–10 score, rounded to 1 dp."""
    return round(raw_score * (10 / 3), 1)


def _label_from_score(raw_score: float) -> str:
    """Derive a human label from a 0–3 raw score."""
    raw_score = max(0.0, min(3.0, raw_score))  # clamp to valid range
    if raw_score >= 2.0:
        return "good"
    if raw_score >= 1.0:
        return "average"
    return "bad"


def _ensure_model_loaded() -> bool:
    """
    Attempt to load the ML model if it isn't already.
    Returns True if the model is ready, False otherwise.
    """
    try:
        if model_service.get_model() is None:
            model_service.load_model()
        return model_service.get_model() is not None
    except Exception as exc:
        logger.error("Failed to load interview model: %s", exc)
        return False


def _model_unavailable_response():
    """Return a consistent 503 when the ML model cannot be loaded."""
    return error_response(
        message="Interview model is not available. Please contact the administrator.",
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


# ── Behavioral-question filter ─────────────────────────────────────────────────

# Keywords that indicate a behavioral / HR question rather than a technical one.
_BEHAVIORAL_PATTERNS = [
    "motivat", "mentor", "feedback", "disagree", "conflict", "adapt", "challenge",
    "team player", "why do you want", "career goal", "biggest weakness",
    "greatest strength", "tell me about yourself", "why should we hire",
    "where do you see yourself", "work under pressure", "handle stress",
    "leadership style", "describe a time", "give an example of",
    "communication skill", "work-life balance", "what are your goals",
    "what motivates", "how do you stay", "how do you handle",
    "most significant change", "repetitive task",
]

# Technical roles for which we want to suppress behavioral ML-bank questions.
_TECHNICAL_ROLES = {
    "software engineer", "data scientist", "devops engineer", "qa analyst",
}


def _is_behavioral(question_text: str) -> bool:
    """Return True if the question text looks like a behavioral / HR question."""
    lower = question_text.lower()
    return any(pat in lower for pat in _BEHAVIORAL_PATTERNS)


def _filter_behavioral_questions(questions: list[dict], role: str) -> list[dict]:
    """
    For technical roles, remove behavioral questions from the ML bank results.
    Returns the filtered list (may be empty if all questions were behavioral).
    """
    if role.lower() not in _TECHNICAL_ROLES:
        return questions  # Non-technical roles may legitimately have behavioral Qs

    filtered = [q for q in questions if not _is_behavioral(q.get("text", ""))]
    dropped = len(questions) - len(filtered)
    if dropped:
        logger.warning(
            "_filter_behavioral_questions — dropped %d behavioral question(s) for role=%r",
            dropped, role,
        )
    return filtered


# ── POST /interview/generate-questions ───────────────────────────────────────

@router.post("/generate-questions", status_code=status.HTTP_200_OK)
async def generate_questions(
    request: GenerateQuestionsRequest,
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Generate interview questions for a given role and difficulty.

    Resume flow  (skills provided):
      1. Try Gemini for personalised questions.
      2. Fall back to skill-templated questions if Gemini fails.

    Practice flow (no skills):
      Use the ML model question bank.
    """
    logger.info(
        "POST /interview/generate-questions — user=%s, role=%r, difficulty=%r, skills=%d",
        current_user.id, request.role, request.difficulty, len(request.skills or []),
    )

    try:
        questions_list = []

        # ── FLOW 1: Resume (skills provided) ────────────────────────────────
        if request.skills:
            logger.info(
                "Resume flow — %d skills provided: %s",
                len(request.skills), ", ".join(request.skills[:8]),
            )

            gemini_questions = await gemini_service.generate_personalized_questions(
                role=request.role,
                difficulty=request.difficulty,
                skills=request.skills,
                num_questions=6,
            )

            if gemini_questions:
                for i, q in enumerate(gemini_questions[:6]):
                    skill_used = q.get("skill_used", request.skills[i % len(request.skills)])
                    questions_list.append({
                        "id": i + 1,
                        "text": q.get("text") or "",
                        "category": q.get("topic") or skill_used,
                        "_ideal_answer": (
                            f"Based on your {skill_used} experience, a strong answer "
                            f"includes specific examples, the challenges faced, decisions "
                            f"made, and measurable outcomes."
                        ),
                    })
                logger.info("Gemini generated %d personalised questions", len(questions_list))
            else:
                # Skill-template fallback
                logger.warning("Gemini unavailable — generating skill-template questions")
                for i, skill in enumerate(request.skills[:8]):
                    questions_list.append({
                        "id": i + 1,
                        "text": (
                            f"Describe a specific project where you used {skill}. "
                            f"What challenges did you face and how did you overcome them?"
                        ),
                        "category": skill,
                        "_ideal_answer": (
                            f"A strong answer about {skill} includes a concrete example, "
                            f"your specific role, the challenges you overcame, and "
                            f"measurable results."
                        ),
                    })
                logger.info("Generated %d skill-template questions", len(questions_list))

        # ── FLOW 2: Practice (no skills / Gemini returned nothing) ──────────
        if not questions_list:
            logger.info("Practice flow — role=%r, difficulty=%r", request.role, request.difficulty)

            # 2a. For technical roles, try Gemini first to get proper technical Qs
            if request.role.lower() in _TECHNICAL_ROLES:
                logger.info("Practice flow (technical role) — attempting Gemini technical questions")
                try:
                    gemini_practice_qs = await gemini_service.generate_technical_practice_questions(
                        role=request.role,
                        difficulty=request.difficulty,
                        num_questions=6,
                    )
                    if gemini_practice_qs:
                        for i, q in enumerate(gemini_practice_qs[:6]):
                            questions_list.append({
                                "id": i + 1,
                                "text": q.get("text") or "",
                                "category": q.get("topic") or "Technical",
                                "_ideal_answer": q.get("ideal_answer") or None,
                            })
                        logger.info(
                            "Practice flow — Gemini generated %d technical questions",
                            len(questions_list),
                        )
                except Exception as exc:
                    logger.warning(
                        "Practice flow — Gemini technical questions failed, using ML bank: %s", exc
                    )

            # 2b. Fall back to ML model question bank (filtered for technical roles)
            if not questions_list:
                logger.info("Practice flow — loading ML model question bank")

                if not _ensure_model_loaded():
                    return _model_unavailable_response()

                result = model_service.generate_questions(
                    role=request.role,
                    difficulty=request.difficulty,
                    seed=request.seed,
                )
                raw_qs = result["questions"]

                # Strip behavioral questions for technical roles
                filtered_qs = _filter_behavioral_questions(raw_qs, request.role)

                # If filtering wiped everything, fall back to unfiltered bank
                questions_list = filtered_qs if filtered_qs else raw_qs
                if not filtered_qs and raw_qs:
                    logger.warning(
                        "Practice flow — all %d ML bank questions were behavioral; "
                        "returning unfiltered as last resort",
                        len(raw_qs),
                    )

            return success_response(
                data=GenerateQuestionsResponse(
                    role=request.role,
                    difficulty=request.difficulty,
                    num_questions=len(questions_list),
                    enough=len(questions_list) >= 6,
                    available=len(questions_list),
                    questions=[
                        InterviewQuestion(
                            id=q["id"],
                            text=q["text"],
                            category=q.get("category") or "General",
                            ideal_answer=q.get("_ideal_answer") or None,
                        )
                        for q in questions_list
                    ],
                    personalized=False,
                ).model_dump(mode="json")
            )

        # ── Build response for resume-flow questions ─────────────────────────
        return success_response(
            data=GenerateQuestionsResponse(
                role=request.role,
                difficulty=request.difficulty,
                num_questions=len(questions_list),
                enough=True,
                available=len(questions_list),
                questions=[
                    InterviewQuestion(
                        id=q["id"],
                        text=q["text"],
                        category=q.get("category") or "General",
                        ideal_answer=q.get("_ideal_answer") or None,
                    )
                    for q in questions_list
                ],
                personalized=True,
            ).model_dump(mode="json")
        )

    except Exception as exc:
        logger.error("POST /interview/generate-questions — error: %s", exc)
        return error_response(
            message="Failed to generate questions. Please try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── POST /interview/evaluate-answer ──────────────────────────────────────────

@router.post("/evaluate-answer", status_code=status.HTTP_200_OK)
async def evaluate_answer(
    request: EvaluateAnswerRequest,
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Evaluate a single answer.

    Resume flow  (ideal_answer starts with "Based on your"):
      → Gemini evaluates and provides a score (0–3) + qualitative feedback.
        Falls through to the ML model if Gemini fails or returns no strengths.

    Practice flow (generic ideal_answer):
      → ML model scoring (0–3) → Gemini enhancement.

    All responses use the same score scale: raw 0–3, public 0–10.
    """
    logger.info(
        "POST /interview/evaluate-answer — user=%s, question=%.60s…",
        current_user.id, request.question,
    )

    try:
        # ── FLOW 1: Resume (Gemini-first) ────────────────────────────────────
        is_resume_flow = bool(
            request.ideal_answer
            and request.ideal_answer.startswith("Based on your")
        )

        if is_resume_flow:
            logger.info("Resume flow — attempting Gemini-only evaluation")
            try:
                gemini_feedback = await gemini_service.enhance_feedback(
                    question=request.question,
                    user_answer=request.user_answer,
                    ideal_answer=request.ideal_answer,
                    score=0,
                    label="",
                )

                if gemini_feedback and gemini_feedback.get("strengths"):
                    # Gemini may return a 0–3 score; fall back to counting
                    # strengths vs weaknesses if it doesn't.
                    raw = gemini_feedback.get("score")
                    if raw is None:
                        strengths_n = len(gemini_feedback.get("strengths") or [])
                        weaknesses_n = len(gemini_feedback.get("weaknesses") or [])
                        total = strengths_n + weaknesses_n
                        raw = round((strengths_n / total) * 3, 2) if total else 1.5
                        logger.info(
                            "Gemini evaluation — score derived from feedback "
                            "(strengths=%d, weaknesses=%d) — raw=%.2f score_10=%.1f label=%s",
                            strengths_n, weaknesses_n, raw, _score_10(raw), _label_from_score(raw),
                        )
                    else:
                        logger.info(
                            "Gemini evaluation — score from Gemini response "
                            "— raw=%.2f score_10=%.1f label=%s",
                            raw, _score_10(raw), _label_from_score(raw),
                        )

                    raw = float(raw)
                    response = EvaluateAnswerResponse(
                        score=raw,
                        score_10=_score_10(raw),
                        label=_label_from_score(raw),
                        similarity=0.5,  # Not applicable in Gemini-only path
                        ideal_answer=request.ideal_answer,
                        feedback=_build_feedback_schema(gemini_feedback),
                    )
                    return success_response(data=response.model_dump(mode="json"))

            except Exception as exc:
                logger.warning(
                    "Gemini evaluation failed for resume flow, falling back to ML: %s", exc
                )

        # ── FLOW 2: ML model (practice or Gemini fallback) ───────────────────
        if not _ensure_model_loaded():
            return _model_unavailable_response()

        # 1. ML scoring → 0–3 raw score
        eval_result = model_service.evaluate_answer(
            ideal_answer=request.ideal_answer,
            user_answer=request.user_answer,
        )

        raw = float(eval_result["score"])
        s10 = float(eval_result.get("score_10") or _score_10(raw))

        # 2. Gemini enhancement (non-blocking)
        raw_feedback = await gemini_service.enhance_feedback(
            question=request.question,
            user_answer=request.user_answer,
            ideal_answer=request.ideal_answer,
            score=eval_result["score"],
            label=eval_result["label"],
        )

        return success_response(
            data=EvaluateAnswerResponse(
                score=raw,
                score_10=s10,
                label=eval_result["label"],
                similarity=eval_result["similarity"],
                ideal_answer=request.ideal_answer,
                feedback=_build_feedback_schema(raw_feedback) if raw_feedback else None,
            ).model_dump(mode="json")
        )

    except Exception as exc:
        logger.error("POST /interview/evaluate-answer — error: %s", exc)
        return error_response(
            message="Failed to evaluate answer. Please try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── POST /interview/evaluate-session ─────────────────────────────────────────

@router.post("/evaluate-session", status_code=status.HTTP_200_OK)
async def evaluate_session(
    request: EvaluateSessionRequest,
    current_user: UserPublic = Depends(get_current_user),
):
    """Evaluate a full interview session (multiple answers) and enhance with Gemini."""
    logger.info(
        "POST /interview/evaluate-session — user=%s, role=%r, answers=%d",
        current_user.id, request.role, len(request.answers),
    )

    if not request.answers:
        return error_response(
            message="At least one answer is required.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    if not _ensure_model_loaded():
        return _model_unavailable_response()

    try:
        # 1. Score every answer with the ML model (0–3 raw)
        scored: list[dict] = []
        for i, answer in enumerate(request.answers):
            eval_result = model_service.evaluate_answer(
                ideal_answer=answer.ideal_answer,
                user_answer=answer.user_answer,
            )
            raw = float(eval_result["score"])
            s10 = float(eval_result.get("score_10") or _score_10(raw))
            scored.append({
                "id": i + 1,
                "question": answer.question,
                "user_answer": answer.user_answer,
                "ideal_answer": answer.ideal_answer,
                "score": raw,
                "score_10": s10,
                "label": eval_result["label"],
                "similarity": eval_result["similarity"],
            })

        # 2. Concurrently enhance all answers with Gemini
        enhanced = await gemini_service.enhance_session(scored)

        # 3. Aggregate — both scales are summed from consistent per-answer values
        n = len(enhanced)
        total_score = round(sum(r.get("score", 0.0) for r in enhanced), 2)
        total_score_10 = round(sum(r.get("score_10", 0.0) for r in enhanced), 1)
        max_score = 3 * n
        average_score = round(total_score / max(1, n), 2)
        average_score_10 = round(total_score_10 / max(1, n), 1)

        # 4. Build typed response objects
        scored_answers = [
            ScoredAnswer(
                id=r["id"],
                question=r["question"],
                user_answer=r["user_answer"],
                ideal_answer=r["ideal_answer"],
                score=float(r.get("score", 0.0)),
                score_10=float(r.get("score_10", 0.0)),
                label=r.get("label") or "bad",
                similarity=float(r.get("similarity", 0.0)),
                feedback=_build_feedback_schema(r["feedback"]) if r.get("feedback") else None,
            )
            for r in enhanced
        ]

        return success_response(
            data=EvaluateSessionResponse(
                session_id=request.session_id,
                role=request.role,
                difficulty=request.difficulty,
                total_score=total_score,
                max_score=max_score,
                average_score=average_score,
                average_score_10=average_score_10,
                results=scored_answers,
                saved=False,
            ).model_dump(mode="json")
        )

    except Exception as exc:
        logger.error("POST /interview/evaluate-session — error: %s", exc)
        return error_response(
            message="Failed to evaluate session. Please try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── POST /interview/save-session ─────────────────────────────────────────────

@router.post("/save-session", status_code=status.HTTP_201_CREATED)
async def save_interview_session(
    request: EvaluateSessionRequest,
    current_user: UserPublic = Depends(get_current_user),
):
    """Evaluate a session AND persist it to the database."""
    logger.info(
        "POST /interview/save-session — user=%s, role=%r, answers=%d",
        current_user.id, request.role, len(request.answers),
    )

    if not request.answers:
        return error_response(
            message="At least one answer is required.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    if not _ensure_model_loaded():
        return _model_unavailable_response()

    try:
        evaluated_answers = []
        for answer in request.answers:
            eval_result = model_service.evaluate_answer(
                ideal_answer=answer.ideal_answer,
                user_answer=answer.user_answer,
            )
            evaluated_answers.append(
                AnswerCreate(
                    question_id=str(uuid4()),
                    question_text=answer.question,
                    question_topic="General",
                    answer_text=answer.user_answer,
                    score=eval_result["score"],
                    strengths=[],
                    weaknesses=[],
                    suggested_answer=answer.ideal_answer,
                    summary=f"Score: {eval_result['score']}/3 — {eval_result['label']}",
                )
            )

        overall_score = (
            sum(a.score for a in evaluated_answers) / len(evaluated_answers)
            if evaluated_answers else 0.0
        )

        session_result = await create_session(
            current_user.id,
            SessionCreate(
                role=request.role,
                difficulty=request.difficulty,
                voice_mode=False,
                started_at=datetime.now(timezone.utc),
                answers=evaluated_answers,
            ),
        )

        return success_response(
            data={
                "session_id": str(session_result.id),
                "role": request.role,
                "difficulty": request.difficulty,
                "overall_score": round(overall_score, 2),
                "overall_score_10": _score_10(overall_score),
                "answer_count": len(evaluated_answers),
            },
            status_code=status.HTTP_201_CREATED,
        )

    except Exception as exc:
        logger.error("POST /interview/save-session — error: %s", exc)
        return error_response(
            message="Failed to save session. Please try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


# ── GET /interview/health ───────────────────────────────────────────────────────────────────────────────

@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    Report the operational status of the interview service.

    Returns:
      healthy   — ML model loaded, Gemini reachable.
      degraded  — ML model loaded, Gemini unavailable (resume flow will fall back to ML).
      unhealthy — ML model not loaded (practice flow unavailable).
    """
    model_loaded = model_service.get_model() is not None
    try:
        # Probe Gemini with a minimal request; treat any response as available.
        await gemini_service.enhance_feedback(
            question="ping", user_answer="ping", ideal_answer="ping", score=0, label=""
        )
        gemini_ok = True
    except Exception:
        gemini_ok = False

    if model_loaded and gemini_ok:
        svc_status = "healthy"
    elif model_loaded:
        svc_status = "degraded"
    else:
        svc_status = "unhealthy"

    return success_response(
        data={
            "status": svc_status,
            "model_loaded": model_loaded,
            "gemini_available": gemini_ok,
        }
    )