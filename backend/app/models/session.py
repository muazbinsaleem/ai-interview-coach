"""
app/models/session.py
=====================
Pydantic v2 schemas for Sessions and Answers.

Schemas:
  - SessionCreate — input for POST /sessions
  - AnswerCreate — answer within a session
  - SessionResponse — output for GET /sessions
  - SessionDetailResponse — output for GET /sessions/{id}
  - AnswerResponse — answer details
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class AnswerCreate(BaseModel):
    """
    Single answer within a session — used when creating a session.
    """

    question_id: str = Field(..., description="ID of the question")
    question_text: str = Field(..., description="The interview question")
    question_topic: str = Field(..., description="Topic of the question")
    answer_text: str = Field(..., description="Candidate's answer")
    score: int = Field(..., ge=0, le=3, description="ML model score: 0=bad, 1=fair, 2=good, 3=very good")
    strengths: List[str] = Field(default=[], description="What was good")
    weaknesses: List[str] = Field(default=[], description="What needs improvement")
    suggested_answer: str = Field(..., description="Model answer")
    summary: str = Field(..., description="Brief feedback")


class SessionCreate(BaseModel):
    """
    Request body for POST /sessions — save a full interview session.
    """

    role: str = Field(..., description="Job role (e.g., software engineer, data scientist)")
    difficulty: str = Field(..., description="Difficulty: easy, medium, hard")
    voice_mode: bool = Field(default=False, description="Was voice mode used?")
    started_at: datetime = Field(..., description="When the session started")
    answers: List[AnswerCreate] = Field(..., description="All answers in the session")


class AnswerResponse(BaseModel):
    """
    Answer details returned in session responses.
    """

    id: UUID
    session_id: UUID
    question_id: str
    question_text: str
    question_topic: str
    answer_text: str
    score: int
    strengths: List[str]
    weaknesses: List[str]
    suggested_answer: str
    summary: str
    created_at: Optional[datetime] = None


class SessionResponse(BaseModel):
    """
    Session summary — used in list views.
    """

    id: UUID
    role: str
    difficulty: str
    voice_mode: bool
    overall_score: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    answer_count: int = Field(0, description="Number of answers in this session")


class SessionDetailResponse(BaseModel):
    """
    Full session with all answers — used for single session view.
    """

    id: UUID
    role: str
    difficulty: str
    voice_mode: bool
    overall_score: float
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    answers: List[AnswerResponse] = Field(default=[], description="All answers in this session")