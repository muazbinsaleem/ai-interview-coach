"""
app/models/resume.py
====================
Pydantic v2 schemas for the Resume domain.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from uuid import UUID

from pydantic import BaseModel, Field


class ResumeUploadResponse(BaseModel):
    """
    Response returned after successfully uploading and processing a resume.
    """

    id: UUID = Field(..., description="ID of the created resume row")
    user_id: UUID = Field(..., description="ID of the owning user")
    skills: List[str] = Field(..., description="Extracted technical skills from resume")
    predicted_role: str = Field(..., description="Predicted interview role")
    role_confidence: float = Field(..., description="Confidence score for role prediction")
    extracted_text: str = Field(..., description="First 500 characters of extracted text")
    created_at: Optional[datetime] = Field(None, description="Timestamp of creation")


class ResumeInDB(BaseModel):
    """
    Internal representation of a resume row from Supabase.
    """

    id: UUID
    user_id: UUID
    extracted_text: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    predicted_role: Optional[str] = None
    role_confidence: Optional[float] = None
    used_gemini: bool = False
    created_at: Optional[datetime] = None


class ResumeSuggestionsResponse(BaseModel):
    """
    Response for resume improvement suggestions.
    """
    summary: str
    improvements: List[str]
    learning_resources: List[str]
    keywords_to_add: List[str]