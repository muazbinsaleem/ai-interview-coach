"""
app/services/interview_model.py
===============================
Service that loads and uses the trained interview model.
"""

import logging
import random
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from app.config import settings

logger = logging.getLogger(__name__)

# ── Module-level state ────────────────────────────────────────────────────────
_model: Optional[Dict[str, Any]] = None
_load_failed: bool = False

# Valid roles for your model
VALID_MODEL_ROLES: List[str] = [
    "software engineer", "data scientist", "devops engineer",
    "product manager", "qa analyst", "ux designer",
    "hr specialist", "marketing associate"
]


def _norm(s: str) -> str:
    """Normalise string for lookup (strip whitespace, lowercase)."""
    return s.strip().lower()


# ── Model loading ─────────────────────────────────────────────────────────────

def load_model() -> Dict[str, Any]:
    """
    Load the interview model from the configured joblib file.
    """
    global _model, _load_failed

    if _model is not None:
        return _model

    if _load_failed:
        raise RuntimeError(
            "Interview model previously failed to load. "
            "Fix the model file and restart the server."
        )

    # Resolve model path
    configured = Path(settings.interview_model_path)

    if configured.is_absolute():
        candidates = [configured]
    else:
        here = Path(__file__).resolve().parent
        app_root = here.parent
        backend_root = app_root.parent
        candidates = [
            backend_root / configured,
            app_root / configured,
            Path.cwd() / configured,
        ]

    model_path: Optional[Path] = None
    for candidate in candidates:
        if candidate.exists():
            model_path = candidate
            break

    if model_path is None:
        _load_failed = True
        searched = ", ".join(str(c) for c in candidates)
        logger.error("Model file not found. Searched: %s", searched)
        raise FileNotFoundError(
            f"Interview model not found. Searched paths: {searched}. "
            "Please copy interview_model.joblib to the models_data/ folder."
        )

    try:
        logger.info("Loading interview model from %s …", model_path)
        raw = joblib.load(model_path)
        if not isinstance(raw, dict):
            raise ValueError(
                f"Expected a dict from joblib.load, got {type(raw).__name__}"
            )
        _model = raw
        logger.info(
            "Interview model loaded successfully — version=%s, keys=%s",
            _model.get("version", "unknown"),
            list(_model.keys()),
        )
        return _model
    except Exception as e:
        _load_failed = True
        logger.error("Failed to load interview model from %s: %s", model_path, e)
        raise RuntimeError(f"Could not deserialise model at {model_path}: {e}") from e


def get_model() -> Optional[Dict[str, Any]]:
    """Return the cached model without raising."""
    return _model


def _require_model() -> Dict[str, Any]:
    """Return the model, attempting to load it if not yet loaded."""
    if _model is not None:
        return _model
    return load_model()


def _get_vectorizer_safely(model: Dict[str, Any], key: str):
    """Safely get a vectorizer from the model, raising a clear error if missing."""
    vectorizer = model.get(key)
    if vectorizer is None:
        raise RuntimeError(f"Model is missing required component: {key}")
    return vectorizer


# ── Question Generation ──────────────────────────────────────────────────────

def generate_questions(
    role: str,
    difficulty: str,
    seed: Optional[int] = None,
    min_q: Optional[int] = None,
    max_q: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Generate interview questions for a given role and difficulty.
    """
    model = _require_model()

    question_index: Dict = model.get("question_index", {})
    MIN_Q: int = min_q if min_q is not None else model.get("min_q", 6)
    MAX_Q: int = max_q if max_q is not None else model.get("max_q", 8)

    key = (_norm(role), _norm(difficulty))
    pool: List[Dict] = question_index.get(key, [])

    # Deduplicate by question text
    seen = set()
    unique: List[Dict] = []
    for item in pool:
        q_text = item.get("question", "")
        if q_text and q_text not in seen:
            seen.add(q_text)
            unique.append(item)

    logger.info(
        "generate_questions — role=%r, difficulty=%r, pool=%d, unique=%d",
        role, difficulty, len(pool), len(unique),
    )

    # Shuffle with optional seed
    rng = random.Random(seed)
    rng.shuffle(unique)

    # Clamp selection count between MIN_Q and MAX_Q
    target = min(MAX_Q, max(MIN_Q, len(unique)))
    selected = unique[:target]

    return {
        "role": role,
        "difficulty": difficulty,
        "num_questions": len(selected),
        "enough": len(unique) >= MIN_Q,
        "available": len(unique),
        "questions": [
            {
                "id": i + 1,
                "text": q["question"],
                "category": q.get("category", "General"),
                "_ideal_answer": q.get("ideal_answer", ""),
            }
            for i, q in enumerate(selected)
        ],
    }


# ── Answer Scoring (0-3) ─────────────────────────────────────────────────────

def _get_score_bands() -> List[Tuple[float, int, str]]:
    """Return configured score bands or sensible defaults."""
    model = _require_model()
    return model.get(
        "score_bands",
        [
            (0.60, 3, "very good"),
            (0.35, 2, "good"),
            (0.15, 1, "fair"),
            (0.00, 0, "bad"),
        ],
    )


def _band_to_score(similarity: float) -> Tuple[int, str]:
    """Convert a cosine similarity value to a (score, label) pair."""
    for lo, score, label in _get_score_bands():
        if similarity >= lo:
            return score, label
    return 0, "bad"


def _generate_fallback_feedback(user_answer: str, score: int) -> Tuple[List[str], List[str]]:
    """
    Generate simple strengths and weaknesses based on answer length and content.
    """
    strengths = []
    weaknesses = []
    
    answer_length = len(user_answer.strip())
    
    # Length-based assessment
    if answer_length > 150:
        strengths.append("Comprehensive answer with good detail")
    elif answer_length > 80:
        strengths.append("Adequate length and basic understanding shown")
    else:
        weaknesses.append("Answer is too brief - provide more detail")
    
    # Check for key structural elements
    if "example" in user_answer.lower() or "project" in user_answer.lower() or "experience" in user_answer.lower():
        strengths.append("Includes practical examples")
    else:
        weaknesses.append("Add specific examples from your experience")
    
    if "i" in user_answer.lower() or "my" in user_answer.lower():
        strengths.append("Uses personal experience")
    else:
        weaknesses.append("Use 'I' statements to describe your personal contributions")
    
    if score >= 2:
        strengths.append("Clear and well-structured response")
    else:
        weaknesses.append("Improve structure and clarity")
    
    # Limit to 3 each
    return strengths[:3], weaknesses[:3]


def evaluate_answer(ideal_answer: str, user_answer: str) -> Dict[str, Any]:
    """
    Evaluate a single candidate answer against an ideal answer.
    If no ideal answer is available, use length-based scoring as fallback.
    """
    model = _require_model()
    
    # Safely get answer_vectorizer
    answer_vectorizer = model.get("answer_vectorizer")
    if answer_vectorizer is None:
        logger.error("evaluate_answer — answer_vectorizer missing from model")
        raise RuntimeError("Model is missing the answer_vectorizer component")

    # Empty answer → score 0 immediately
    if not user_answer or not user_answer.strip():
        return {
            "score": 0, 
            "label": "bad", 
            "similarity": 0.0, 
            "score_10": 0.0,
            "strengths": [],
            "weaknesses": ["No answer provided"],
            "suggested_answer": "Please provide an answer to receive feedback.",
            "summary": "No answer provided."
        }

    # FIX: If no ideal answer provided, use length-based scoring as fallback
    if not ideal_answer or ideal_answer.strip() == "" or ideal_answer == "no ideal answer provided":
        logger.warning("evaluate_answer — no ideal answer provided, using length-based fallback scoring")
        
        answer_length = len(user_answer.strip())
        
        if answer_length > 200:
            fallback_score = 3
            fallback_label = "very good"
            fallback_similarity = 0.85
            fallback_summary = "Excellent answer! Good length and detail."
        elif answer_length > 100:
            fallback_score = 2
            fallback_label = "good"
            fallback_similarity = 0.55
            fallback_summary = "Good answer. Consider adding more specific examples."
        elif answer_length > 30:
            fallback_score = 1
            fallback_label = "fair"
            fallback_similarity = 0.3
            fallback_summary = "Fair answer. Try to provide more detail and examples."
        else:
            fallback_score = 0
            fallback_label = "bad"
            fallback_similarity = 0.1
            fallback_summary = "Answer too short. Please provide more detail."
        
        # Generate strengths and weaknesses
        strengths, weaknesses = _generate_fallback_feedback(user_answer, fallback_score)
        
        return {
            "score": fallback_score,
            "label": fallback_label,
            "similarity": fallback_similarity,
            "score_10": round(fallback_score * (10/3), 1),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "suggested_answer": "A strong answer includes specific examples, clear structure, and demonstrates your experience. For behavioral questions, use the STAR method (Situation, Task, Action, Result).",
            "summary": fallback_summary,
        }

    try:
        # Transform both texts to vectors
        vectors = answer_vectorizer.transform([ideal_answer, user_answer])
        
        # Check if we got valid vectors
        if vectors.shape[0] < 2:
            logger.error("evaluate_answer — insufficient vectors returned")
            return {
                "score": 0, 
                "label": "bad", 
                "similarity": 0.0, 
                "score_10": 0.0,
                "strengths": [],
                "weaknesses": ["Evaluation error"],
                "suggested_answer": "Please try again.",
                "summary": "Evaluation error."
            }
        
        # Calculate cosine similarity
        sim_matrix = cosine_similarity(vectors[0:1], vectors[1:2])
        similarity = float(sim_matrix[0, 0])
        score, label = _band_to_score(similarity)
        score_10 = round(score * (10/3), 1)

        # Generate appropriate summary based on score
        if score >= 3:
            summary = "Excellent answer! You demonstrated strong understanding."
            suggested_answer = ideal_answer
        elif score >= 2:
            summary = "Good answer. Keep practicing to strengthen your responses."
            suggested_answer = ideal_answer
        elif score >= 1:
            summary = "Good attempt. Review the model answer for improvement areas."
            suggested_answer = ideal_answer
        else:
            summary = "Your answer needs improvement. Review the model answer for guidance."
            suggested_answer = ideal_answer
        
        # Generate strengths and weaknesses based on similarity
        strengths = []
        weaknesses = []
        
        if similarity > 0.5:
            strengths.append("Answer aligns well with expected response")
        else:
            weaknesses.append("Answer differs significantly from expected response")
        
        if len(user_answer) > 100:
            strengths.append("Good level of detail")
        else:
            weaknesses.append("Add more detail to your answer")
        
        return {
            "score": score,
            "label": label,
            "similarity": round(similarity, 4),
            "score_10": score_10,
            "strengths": strengths,
            "weaknesses": weaknesses,
            "suggested_answer": suggested_answer,
            "summary": summary,
        }
    except Exception as e:
        logger.error(f"evaluate_answer — error during scoring: {e}")
        return {
            "score": 0, 
            "label": "bad", 
            "similarity": 0.0, 
            "score_10": 0.0,
            "strengths": [],
            "weaknesses": ["Evaluation error occurred"],
            "suggested_answer": "Please try again.",
            "summary": "Evaluation error. Please try again.",
        }


def evaluate_session(answers: List[Dict[str, str]]) -> Dict[str, Any]:
    """
    Evaluate multiple answers in a single interview session.
    """
    results: List[Dict[str, Any]] = []
    total_score = 0
    total_score_10 = 0.0

    for i, item in enumerate(answers):
        eval_result = evaluate_answer(
            ideal_answer=item.get("ideal_answer", ""),
            user_answer=item.get("user_answer", ""),
        )
        results.append(
            {
                "id": i + 1,
                "score": eval_result["score"],
                "score_10": eval_result.get("score_10", 0),
                "label": eval_result["label"],
                "similarity": eval_result["similarity"],
            }
        )
        total_score += eval_result["score"]
        total_score_10 += eval_result.get("score_10", 0)

    n = max(1, len(answers))

    return {
        "results": results,
        "total_score": total_score,
        "max_score": 3 * len(answers),
        "average_score": round(total_score / n, 2),
        "average_score_10": round(total_score_10 / n, 1),
    }


# ── Ideal Answer Retrieval ───────────────────────────────────────────────────

def retrieve_ideal_answer(question: str, top_k: int = 1) -> List[Dict[str, Any]]:
    """
    Find the closest matching question from the dataset and return its ideal answer.
    """
    model = _require_model()

    # Safely get all retriever components
    retriever_vec = model.get("retriever_vectorizer")
    retriever_matrix = model.get("retriever_matrix")
    questions_bank = model.get("questions_bank")
    ideal_answers = model.get("ideal_answers")

    if retriever_vec is None:
        logger.error("retrieve_ideal_answer — retriever_vectorizer is None")
        return []
    
    if retriever_matrix is None:
        logger.error("retrieve_ideal_answer — retriever_matrix is None")
        return []
    
    if questions_bank is None:
        logger.error("retrieve_ideal_answer — questions_bank is None")
        return []
    
    if ideal_answers is None:
        logger.error("retrieve_ideal_answer — ideal_answers is None")
        return []

    if not question or not question.strip():
        logger.warning("retrieve_ideal_answer — empty question provided")
        return []

    try:
        q_vec = retriever_vec.transform([question])
        similarities = cosine_similarity(q_vec, retriever_matrix).ravel()
        
        # Get top_k indices
        indices = similarities.argsort()[::-1][:top_k]

        return [
            {
                "matched_question": str(questions_bank[i]),
                "ideal_answer": str(ideal_answers[i]),
                "similarity": round(float(similarities[i]), 4),
            }
            for i in indices
        ]
    except Exception as e:
        logger.error("retrieve_ideal_answer — error: %s", e)
        return []


# ── Resume Role Helpers ──────────────────────────────────────────────────────

def get_questions_for_resume_role(
    role: str,
    difficulty: str = "medium",
    fallback: bool = True,
) -> Dict[str, Any]:
    """
    Get questions for a role, with automatic fallback if role not found.
    """
    normalized_role = normalize_role_for_model(role)
    
    result = generate_questions(
        role=normalized_role,
        difficulty=difficulty,
    )
    
    # If no questions found and fallback enabled, use default role
    if result["num_questions"] == 0 and fallback:
        logger.warning(f"Role '{role}' (normalized: {normalized_role}) has no questions, falling back to 'software engineer'")
        result = generate_questions(
            role="software engineer",
            difficulty=difficulty,
        )
        result["original_role"] = role
        result["fallback_role"] = "software engineer"
    
    return result


def normalize_role_for_model(role: str) -> str:
    """
    Normalize any role string to a valid model role.
    """
    role_lower = role.lower().strip()
    
    # Direct matches
    if role_lower in VALID_MODEL_ROLES:
        return role_lower
    
    # Fuzzy matching
    fuzzy_matches: Dict[str, str] = {
        "frontend": "software engineer",
        "backend": "software engineer",
        "fullstack": "software engineer",
        "full stack": "software engineer",
        "web developer": "software engineer",
        "ml": "data scientist",
        "machine learning": "data scientist",
        "ai": "data scientist",
        "cloud": "devops engineer",
        "infrastructure": "devops engineer",
        "site reliability": "devops engineer",
        "po": "product manager",
        "quality assurance": "qa analyst",
        "ui": "ux designer",
        "user experience": "ux designer",
        "people ops": "hr specialist",
        "talent acquisition": "hr specialist",
    }
    
    for key, mapped in fuzzy_matches.items():
        if key in role_lower:
            return mapped
    
    # Default
    return "software engineer"