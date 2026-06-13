"""
app/routers/resume.py
=====================
HTTP layer for resume upload and processing.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile, Query, status

from app.dependencies import get_current_user
from app.models.resume import ResumeUploadResponse, ResumeSuggestionsResponse
from app.models.user import UserPublic
from app.services.resume_service import process_resume
from app.services.gemini_service import generate_resume_suggestions
from app.database import supabase
from app.utils.response import error_response, success_response

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(..., description="PDF file to upload"),
    use_gemini: bool = Query(True, description="Use Gemini for role prediction"),
    current_user: UserPublic = Depends(get_current_user),
):
    """
    Upload a PDF resume, extract text, extract skills, and predict interview role.
    
    Pipeline:
        1. Validate PDF
        2. Extract text (PyMuPDF)
        3. Extract skills (keyword matching)
        4. Predict role (local OR Gemini Flash)
        5. Return skills + predicted role
    """
    logger.info("POST /resume/upload — user_id=%s, filename=%s, use_gemini=%s",
                current_user.id, file.filename, use_gemini)

    try:
        file_bytes = await file.read()
        
        # Handle case where filename might be None
        filename = file.filename or "resume.pdf"
        
        result = await process_resume(
            user_id=current_user.id,
            file_bytes=file_bytes,
            filename=filename,
            use_gemini=use_gemini,
        )

        return success_response(
            data=result.model_dump(mode="json"),
            status_code=status.HTTP_201_CREATED,
        )

    except ValueError as e:
        logger.warning("POST /resume/upload — validation error: %s", e)
        return error_response(
            message=str(e),
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as e:
        logger.error("POST /resume/upload — unexpected error: %s", e)
        return error_response(
            message="Internal server error processing resume",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/", status_code=status.HTTP_200_OK)
async def list_resumes(
    current_user: UserPublic = Depends(get_current_user),
):
    """Return all resumes uploaded by the current user, newest first."""
    logger.info("GET /resume/ — user_id=%s", current_user.id)

    try:
        result = (
            supabase.table("resumes")
            .select("id, user_id, skills, predicted_role, role_confidence, created_at")
            .eq("user_id", str(current_user.id))
            .order("created_at", desc=True)
            .execute()
        )
        return success_response(data={"resumes": result.data or []})
    except Exception as e:
        logger.error("GET /resume/ — error: %s", e)
        return error_response(
            message="Failed to retrieve resumes",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.get("/{resume_id}", status_code=status.HTTP_200_OK)
async def get_resume(
    resume_id: str,
    current_user: UserPublic = Depends(get_current_user),
):
    """Retrieve a specific resume's details by ID."""
    logger.info("GET /resume/%s — user_id=%s", resume_id, current_user.id)

    try:
        result = (
            supabase.table("resumes")
            .select("*")
            .eq("id", resume_id)
            .eq("user_id", str(current_user.id))
            .execute()
        )
        if not result.data:
            return error_response(
                message="Resume not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        
        row = result.data[0]
        return success_response(
            data={
                "id": row["id"],
                "user_id": row["user_id"],
                "skills": row["skills"] or [],
                "predicted_role": row.get("predicted_role", "software engineer"),
                "role_confidence": row.get("role_confidence", 0.0),
                "extracted_text": row.get("extracted_text", ""),
                "created_at": row.get("created_at"),
            }
        )
    except Exception as e:
        logger.error("GET /resume/%s — error: %s", resume_id, e)
        return error_response(
            message="Failed to retrieve resume",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@router.post("/{resume_id}/suggestions", status_code=status.HTTP_200_OK)
async def get_resume_suggestions(
    resume_id: str,
    current_user: UserPublic = Depends(get_current_user),
):
    """Get AI-powered suggestions to improve the resume."""
    logger.info("POST /resume/%s/suggestions — user_id=%s", resume_id, current_user.id)

    try:
        # Fetch resume data
        result = (
            supabase.table("resumes")
            .select("*")
            .eq("id", resume_id)
            .eq("user_id", str(current_user.id))
            .execute()
        )
        if not result.data:
            return error_response(
                message="Resume not found",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        
        row = result.data[0]
        extracted_text = row.get("extracted_text", "")
        predicted_role = row.get("predicted_role", "software engineer")
        
        # Get Gemini suggestions
        suggestions = await generate_resume_suggestions(
            resume_text=extracted_text or "",
            predicted_role=predicted_role,
            missing_skills=[],
        )
        
        if suggestions:
            return success_response(data=suggestions)
        else:
            return success_response(
                data={
                    "summary": "Resume looks good! Focus on gaining practical experience.",
                    "improvements": [
                        "Add quantifiable achievements",
                        "Use action verbs",
                        "Tailor skills to the job description"
                    ],
                    "learning_resources": [
                        "LeetCode for coding practice",
                        "Coursera/edX for courses",
                        "GitHub for portfolio projects"
                    ],
                    "keywords_to_add": [predicted_role, "team collaboration", "problem solving"]
                }
            )
            
    except Exception as e:
        logger.error("POST /resume/%s/suggestions — error: %s", resume_id, e)
        return error_response(
            message="Failed to generate suggestions",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )