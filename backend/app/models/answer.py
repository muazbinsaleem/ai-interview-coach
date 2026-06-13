"""
app/models/answer.py
====================
Pydantic v2 schemas for answer evaluation.

Schemas:
  - EvaluateAnswerRequest — input for POST /evaluate
  - EvaluationResult — evaluation output with score and feedback
"""

from __future__ import annotations

from typing import List

from pydantic import BaseModel, Field


class EvaluateAnswerRequest(BaseModel):
    """
    Request body for POST /evaluate.
    """

    question_text: str = Field(..., description="The interview question")
    question_topic: str = Field(..., description="Topic of the question")
    answer_text: str = Field(..., description="Candidate's answer to evaluate")
    role: str = Field(..., description="Job role: frontend, backend, data-analyst")
    difficulty: str = Field(..., description="Difficulty: junior, mid, senior")


class EvaluationResult(BaseModel):
    """
    Evaluation result for a single answer.
    """

    score: int = Field(..., ge=1, le=10, description="Score from 1-10")
    strengths: List[str] = Field(default=[], description="What the candidate did well")
    weaknesses: List[str] = Field(default=[], description="Areas for improvement")
    suggested_answer: str = Field(..., description="Model answer for comparison")
    summary: str = Field(..., description="Brief overall feedback")