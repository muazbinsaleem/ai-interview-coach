"""
app/models/question.py
======================
Pydantic v2 schemas for AI-generated interview questions.

Schemas:
  - GenerateQuestionsRequest — input for POST /questions/generate
  - Question — individual question object
  - GenerateQuestionsResponse — output with list of questions
"""

from __future__ import annotations

from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class GenerateQuestionsRequest(BaseModel):
    """
    Request body for POST /questions/generate.
    """

    role: str = Field(..., description="Job role: frontend, backend, data-analyst")
    difficulty: str = Field(..., description="Difficulty: junior, mid, senior")
    skills: Optional[List[str]] = Field(default=[], description="Optional skills to focus on")


class Question(BaseModel):
    """
    Individual interview question.
    """

    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique question ID")
    text: str = Field(..., description="The interview question text")
    topic: str = Field(..., description="Topic category (e.g., React, Python, SQL)")
    role: str = Field(..., description="Target role")
    difficulty: str = Field(..., description="Difficulty level")


class GenerateQuestionsResponse(BaseModel):
    """
    Response for POST /questions/generate.
    """

    questions: List[Question] = Field(..., description="List of 5 generated questions")