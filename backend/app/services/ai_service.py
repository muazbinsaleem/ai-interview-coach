"""
app/services/ai_service.py
==========================
AI service for interview question generation and answer evaluation.
Evaluation uses the Anthropic API (Claude) with a length-based fallback.
"""

import json
import logging
import os
import re
from typing import List
from uuid import uuid4

import httpx
import joblib
from sklearn.metrics.pairwise import cosine_similarity

from app.config import settings
from app.models.question import GenerateQuestionsRequest, Question, GenerateQuestionsResponse
from app.models.answer import EvaluateAnswerRequest, EvaluationResult

logger = logging.getLogger(__name__)

_ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")

# ---------------------------------------------------------------------------
# Load the ML model once at startup for ideal-answer retrieval
# ---------------------------------------------------------------------------

_MODEL_PATH = os.environ.get("INTERVIEW_MODEL_PATH", "interview_model.joblib")
_model = None

def _load_model():
    global _model
    if _model is None:
        try:
            _model = joblib.load(_MODEL_PATH)
            logger.info("interview_model.joblib loaded successfully")
        except Exception as e:
            logger.warning("Could not load interview model: %s", e)
    return _model


def get_ideal_answer(question: str) -> str:
    """
    Find the closest matching question in the dataset and return its ideal answer.
    Uses cosine similarity on the TF-IDF retriever stored in the model.
    Returns empty string if no good match is found.
    """
    model = _load_model()
    if model is None:
        return ""
    try:
        vectorizer = model["retriever_vectorizer"]
        matrix = model["retriever_matrix"]
        ideal_answers = model["ideal_answers"]

        q_vec = vectorizer.transform([question])
        similarities = cosine_similarity(q_vec, matrix).flatten()
        best_idx = int(similarities.argmax())

        if similarities[best_idx] > 0.15:
            return str(ideal_answers[best_idx])
    except Exception as e:
        logger.warning("get_ideal_answer failed: %s", e)
    return ""


# ---------------------------------------------------------------------------
# Question type detection
# ---------------------------------------------------------------------------

# Categories that require behavioral/soft-skills evaluation rubric
_BEHAVIORAL_CATEGORIES = {
    "work style", "culture fit", "leadership", "motivation",
    "adaptability", "conflict resolution", "team collaboration",
    "career goals", "general", "problem solving", "best practices",
}

def _is_behavioral(question_text: str, topic: str = "", role: str = "") -> bool:
    """
    Return True when the question is behavioral/HR rather than technical.
    Checks the topic/category first, then falls back to keyword heuristics.
    """
    topic_lower = (topic or "").lower()
    if topic_lower in _BEHAVIORAL_CATEGORIES:
        return True

    # Heuristic: typical behavioral openers
    behavioral_openers = (
        "tell me about a time",
        "describe a time",
        "describe a situation",
        "give me an example",
        "how do you",
        "how would you",
        "where do you see yourself",
        "what motivates",
        "why do you want",
        "what type of",
        "what kind of",
        "what makes a good",
        "do you prefer",
        "how does this role",
        "what are your",
        "what drives",
        "what would you do if",
        "how do you organize",
        "how do you prioritize",
        "how do you ensure",
        "how do you handle",
        "how do you stay",
        "how do you delegate",
        "how do you build",
        "how do you deal",
        "how do you react",
        "how do you motivate",
        "how do you align",
        "how do you contribute",
        "how do you respond",
        "describe your ideal",
        "what role do you",
        "what kind of growth",
    )
    q_lower = question_text.lower()
    return any(q_lower.startswith(opener) or opener in q_lower for opener in behavioral_openers)


# ---------------------------------------------------------------------------
# Prompt builder
# ---------------------------------------------------------------------------

def _build_prompt(request: EvaluateAnswerRequest, ideal_answer: str, behavioral: bool) -> str:
    if behavioral:
        rubric = """You are an expert HR interviewer evaluating a behavioral/soft-skills answer.

Scoring guide (1–10):
  1–3  Poor   — blank, gibberish, completely off-topic, or a single random word
  4–5  Weak   — on-topic but very vague, no examples, too short (< 30 words)
  6–7  Good   — relevant, shows self-awareness, some structure
  8–9  Strong — concrete example, clear situation/action/result, professional tone
  10   Exceptional — STAR method perfectly applied, memorable and specific

DO NOT penalize for lack of technical knowledge.
DO reward relevance, specificity, and communication clarity.
If the answer is a complete sentence and on-topic, score it at least 5."""

        ideal_section = f"\nIdeal Answer Reference:\n{ideal_answer}\n" if ideal_answer else ""

        return f"""{rubric}

Role: {request.role}
Question: {request.question_text}{ideal_section}
Candidate Answer: {request.answer_text}

Respond ONLY with a valid JSON object — no markdown fences, no preamble:
{{
  "score": 7,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1"],
  "suggested_answer": "A strong answer would...",
  "summary": "One-sentence overall assessment."
}}"""

    else:
        # Technical question
        difficulty_hint = {
            "easy":   "junior-level",
            "medium": "mid-level",
            "mid":    "mid-level",
            "hard":   "senior-level",
        }.get((request.difficulty or "").lower(), "mid-level")

        ideal_section = f"\nIdeal Answer Reference:\n{ideal_answer}\n" if ideal_answer else ""

        return f"""You are an expert technical interviewer. Evaluate the candidate's answer below.

Role: {request.role} ({difficulty_hint})
Question: {request.question_text}{ideal_section}
Candidate Answer: {request.answer_text}

Respond ONLY with a valid JSON object — no markdown fences, no preamble:
{{
  "score": 7,
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1"],
  "suggested_answer": "A strong {difficulty_hint} answer for this {request.role} question would include specific examples, trade-offs, and best practices.",
  "summary": "One-sentence overall assessment."
}}

Scoring guide (1–10):
  1–3  Poor    — missing key concepts or factually wrong
  4–6  Average — correct but shallow, lacks depth or examples
  7–8  Good    — accurate, some depth, minor gaps
  9–10 Excellent — comprehensive, concrete examples, trade-offs discussed

Base the score on: technical accuracy, depth of understanding, use of examples, and clarity."""


# ---------------------------------------------------------------------------
# Tech skills keyword bank
# ---------------------------------------------------------------------------

TECH_SKILLS = {
    "Languages": ["JavaScript", "TypeScript", "Python", "Java", "Go", "Ruby", "PHP", "Swift", "Kotlin", "SQL", "HTML", "CSS"],
    "Frontend": ["React", "React.js", "Next.js", "Vue", "Angular", "Tailwind CSS", "Bootstrap", "Redux", "jQuery"],
    "Backend": ["Node.js", "Express", "Django", "FastAPI", "Flask", "Spring Boot", "ASP.NET", "REST APIs", "GraphQL"],
    "Database": ["PostgreSQL", "MySQL", "MongoDB", "Supabase", "Firebase", "Redis", "SQLite", "Oracle"],
    "Cloud & DevOps": ["AWS", "Azure", "GCP", "Docker", "Kubernetes", "Vercel", "Netlify", "CI/CD", "GitHub Actions"],
    "Tools": ["Git", "GitHub", "GitLab", "Postman", "Figma", "Jira", "VS Code", "Linux", "Bash"],
    "Other": ["TypeScript", "JavaScript", "Python", "SQL", "NoSQL", "REST", "GraphQL", "SSR", "RLS"],
}

ALL_SKILLS: set = set()
for _category in TECH_SKILLS.values():
    ALL_SKILLS.update(_category)


# ---------------------------------------------------------------------------
# Skill extraction
# ---------------------------------------------------------------------------

def extract_skills_from_text(text: str) -> List[str]:
    """Extract technical skills from resume text using keyword matching."""
    extracted = set()
    text_lower = text.lower()
    for skill in ALL_SKILLS:
        if skill.lower() in text_lower:
            extracted.add(skill)
    return sorted(extracted)


async def extract_skills_from_resume(resume_text: str) -> List[str]:
    """Extract technical skills from resume text with a sensible fallback."""
    logger.info("extract_skills_from_resume — text length: %d chars", len(resume_text))
    skills = extract_skills_from_text(resume_text)
    logger.info("extract_skills_from_resume — extracted %d skills", len(skills))
    if not skills:
        skills = ["JavaScript", "Python", "React", "Node.js", "SQL", "Git",
                  "Teamwork", "Problem Solving"]
    return skills


# ---------------------------------------------------------------------------
# Question generation
# ---------------------------------------------------------------------------

async def generate_interview_questions(request: GenerateQuestionsRequest) -> GenerateQuestionsResponse:
    """Generate interview questions based on role and difficulty."""
    logger.info(
        "generate_interview_questions — role=%s, difficulty=%s",
        request.role, request.difficulty,
    )

    role_topics = {
        "frontend":     ["React", "JavaScript", "CSS", "Performance", "Accessibility", "State Management", "API Integration"],
        "backend":      ["Database", "API Design", "Authentication", "Caching", "System Design", "Security", "Testing"],
        "data-analyst": ["SQL", "Data Cleaning", "Visualization", "Statistics", "Python/pandas", "A/B Testing", "ETL"],
    }

    topics = role_topics.get(request.role.lower(), role_topics["frontend"])
    questions = [
        Question(
            id=str(uuid4()),
            text=f"Explain {topic} in the context of {request.role} development.",
            topic=topic,
            role=request.role,
            difficulty=request.difficulty,
        )
        for topic in topics[:5]
    ]

    return GenerateQuestionsResponse(questions=questions)


# ---------------------------------------------------------------------------
# Answer evaluation — real AI via Anthropic API with length-based fallback
# ---------------------------------------------------------------------------

async def evaluate_candidate_answer(request: EvaluateAnswerRequest) -> EvaluationResult:
    """
    Evaluate a candidate's answer using Claude.

    - Detects whether the question is behavioral or technical
    - Retrieves the ideal answer from the ML model for context
    - Falls back to simple length-based scoring if the API call fails
    """
    logger.info(
        "evaluate_candidate_answer — role=%s, difficulty=%s, question=%s",
        request.role, request.difficulty, request.question_text[:60],
    )

    topic = getattr(request, "question_topic", "") or ""
    behavioral = _is_behavioral(request.question_text, topic=topic, role=request.role)
    logger.info("evaluate_candidate_answer — behavioral=%s", behavioral)

    # Retrieve ideal answer from dataset for context
    ideal_answer = get_ideal_answer(request.question_text)
    logger.info("evaluate_candidate_answer — ideal_answer found: %s", bool(ideal_answer))

    prompt = _build_prompt(request, ideal_answer, behavioral)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": _ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-haiku-4-5-20251001",
                    "max_tokens": 512,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            response.raise_for_status()
            data = response.json()

        # Extract the text block from the response
        text = ""
        for block in data.get("content", []):
            if block.get("type") == "text":
                text = block["text"]
                break

        # Strip accidental markdown fences before parsing
        text = re.sub(r"```(?:json)?", "", text).strip()
        parsed = json.loads(text)

        score = max(1, min(10, int(parsed.get("score", 6))))

        # Use dataset ideal answer as suggested_answer if AI left it generic
        suggested = parsed.get("suggested_answer", "")
        if ideal_answer and (not suggested or "strong answer would" in suggested.lower()):
            suggested = ideal_answer

        return EvaluationResult(
            score=score,
            strengths=parsed.get("strengths", []),
            weaknesses=parsed.get("weaknesses", []),
            suggested_answer=suggested,
            summary=parsed.get("summary", ""),
        )

    except Exception as e:
        logger.warning(
            "evaluate_candidate_answer — API call failed, using fallback: %s", e,
        )
        return _length_based_fallback(request.answer_text, request.role, request.difficulty, ideal_answer, behavioral)


def _length_based_fallback(
    answer: str,
    role: str,
    difficulty: str,
    ideal_answer: str = "",
    behavioral: bool = False,
) -> EvaluationResult:
    """Simple fallback evaluator based on answer length."""
    if ideal_answer:
        suggested = ideal_answer
    elif behavioral:
        suggested = (
            "A strong answer would include a specific example using the STAR method "
            "(Situation, Task, Action, Result) and demonstrate self-awareness."
        )
    else:
        suggested = (
            f"A strong {difficulty}-level {role} answer includes specific examples, "
            "trade-offs, and best practices relevant to the question."
        )

    n = len((answer or "").strip())

    if n < 20:
        return EvaluationResult(
            score=1,
            strengths=[],
            weaknesses=["Answer is too short or blank"],
            suggested_answer=suggested,
            summary="Please provide a meaningful answer to receive a proper evaluation.",
        )
    elif n < 50:
        return EvaluationResult(
            score=4,
            strengths=["Attempted to answer the question"],
            weaknesses=["Answer is too short", "Missing technical detail or context"],
            suggested_answer=suggested,
            summary="Answer was too brief — aim for at least a paragraph with concrete detail.",
        )
    elif n < 200:
        return EvaluationResult(
            score=6,
            strengths=["Basic understanding shown"],
            weaknesses=["Needs more depth", "Could provide examples"],
            suggested_answer=suggested,
            summary="Good attempt. Keep practicing to strengthen your answers.",
        )
    return EvaluationResult(
        score=8,
        strengths=["Comprehensive answer", "Good examples", "Clear explanation"],
        weaknesses=[],
        suggested_answer=suggested,
        summary="Excellent answer! You demonstrated strong understanding.",
    )