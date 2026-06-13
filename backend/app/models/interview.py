"""
app/models/interview.py
=======================
Pydantic schemas for the interview system using your trained model.

Schemas:
  - GenerateQuestionsRequest — input for POST /interview/generate-questions
  - InterviewQuestion — individual question from dataset
  - GenerateQuestionsResponse — output with questions
  - EvaluateAnswerRequest — input for answer evaluation
  - EvaluateAnswerResponse — score + Gemini feedback
  - EvaluateSessionRequest — batch evaluation for full session
  - EvaluateSessionResponse — session-wide results
"""

from __future__ import annotations

from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field


# ── Question Generation ──────────────────────────────────────────────────────

class GenerateQuestionsRequest(BaseModel):
    """Request body for POST /interview/generate-questions"""
    role: str = Field(..., description="Job role (e.g., Data Scientist, Software Engineer)")
    difficulty: str = Field(..., description="Difficulty: Easy, Medium, Hard")
    skills: Optional[List[str]] = Field(default=[], description="Skills from resume for personalized questions")
    seed: Optional[int] = Field(None, description="Optional seed for reproducible shuffling")


class InterviewQuestion(BaseModel):
    """Individual interview question from the dataset"""
    id: int = Field(..., description="Question number in the response")
    text: str = Field(..., description="The interview question text")
    category: str = Field(..., description="Question category (Leadership, Adaptability, etc.)")
    ideal_answer: Optional[str] = Field(None, description="Ideal/model answer for scoring")


class GenerateQuestionsResponse(BaseModel):
    """Response for POST /interview/generate-questions"""
    role: str
    difficulty: str
    num_questions: int
    enough: bool = Field(..., description="Whether enough questions exist for this pair")
    available: int = Field(..., description="Total available questions for this pair")
    questions: List[InterviewQuestion]
    personalized: bool = Field(default=False, description="Whether questions were personalized with skills")


# ── Answer Evaluation ────────────────────────────────────────────────────────

class EvaluateAnswerRequest(BaseModel):
    """Request body for POST /interview/evaluate-answer"""
    question: str = Field(..., description="The interview question")
    ideal_answer: str = Field(..., description="The ideal answer from dataset")
    user_answer: str = Field(..., description="The candidate's answer")


class StrengthsWeaknesses(BaseModel):
    """Gemini-generated feedback"""
    strengths: List[str] = Field(default_factory=list, description="What was good")
    weaknesses: List[str] = Field(default_factory=list, description="What needs improvement")
    tips: List[str] = Field(default_factory=list, description="Improvement suggestions")
    follow_up: Optional[str] = Field(None, description="Suggested follow-up question")


class EvaluateAnswerResponse(BaseModel):
    """Response for POST /interview/evaluate-answer"""
    score: int = Field(..., ge=0, le=3, description="Score: 0=bad, 1=fair, 2=good, 3=very good")
    score_10: float = Field(..., ge=0, le=10, description="Score scaled to 0-10 for frontend")
    label: str = Field(..., description="bad | fair | good | very good")
    similarity: float = Field(..., ge=0, le=1, description="Cosine similarity to ideal answer")
    ideal_answer: str = Field(..., description="The ideal answer from dataset")
    feedback: Optional[StrengthsWeaknesses] = Field(None, description="Gemini feedback if available")


# ── Session Evaluation ───────────────────────────────────────────────────────

class EvaluateSessionRequest(BaseModel):
    """Request body for POST /interview/evaluate-session"""
    session_id: Optional[UUID] = Field(None, description="Optional session ID to save to database")
    role: str
    difficulty: str
    answers: List[EvaluateAnswerRequest]


class ScoredAnswer(BaseModel):
    """Individual answer with score"""
    id: int
    question: str
    user_answer: str
    ideal_answer: str
    score: int
    score_10: float
    label: str
    similarity: float
    feedback: Optional[StrengthsWeaknesses] = None


class EvaluateSessionResponse(BaseModel):
    """Response for POST /interview/evaluate-session"""
    session_id: Optional[UUID] = None
    role: str
    difficulty: str
    total_score: int
    max_score: int
    average_score: float
    average_score_10: float
    results: List[ScoredAnswer]
    saved: bool = False