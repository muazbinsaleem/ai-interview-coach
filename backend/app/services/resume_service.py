"""
app/services/resume_service.py
===============================
Business logic for resume processing with role prediction.
"""

import logging
import re
from typing import List, Tuple, Optional, Dict, Any
from uuid import UUID

import fitz  # PyMuPDF

from app.database import supabase
from app.models.resume import ResumeUploadResponse
from app.services.gemini_service import predict_role_from_resume

logger = logging.getLogger(__name__)

# Expanded skill database
SKILL_DATABASE: Dict[str, str] = {
    # Programming Languages
    "python": "Programming Language",
    "javascript": "Programming Language",
    "typescript": "Programming Language",
    "java": "Programming Language",
    "go": "Programming Language",
    "rust": "Programming Language",
    "c++": "Programming Language",
    "c#": "Programming Language",
    "ruby": "Programming Language",
    "php": "Programming Language",
    "swift": "Programming Language",
    "kotlin": "Programming Language",
    "scala": "Programming Language",
    
    # Frontend
    "react": "Frontend",
    "react.js": "Frontend",
    "next.js": "Frontend",
    "vue": "Frontend",
    "vue.js": "Frontend",
    "angular": "Frontend",
    "svelte": "Frontend",
    "html": "Frontend",
    "css": "Frontend",
    "tailwind": "Frontend",
    "bootstrap": "Frontend",
    "jquery": "Frontend",
    "redux": "Frontend",
    
    # Backend
    "node.js": "Backend",
    "express": "Backend",
    "django": "Backend",
    "flask": "Backend",
    "fastapi": "Backend",
    "spring": "Backend",
    "spring boot": "Backend",
    "asp.net": "Backend",
    "graphql": "Backend",
    "rest api": "Backend",
    
    # Database
    "sql": "Database",
    "postgresql": "Database",
    "mysql": "Database",
    "mongodb": "Database",
    "redis": "Database",
    "elasticsearch": "Database",
    "dynamodb": "Database",
    "firebase": "Database",
    "supabase": "Database",
    
    # Cloud & DevOps
    "aws": "Cloud",
    "azure": "Cloud",
    "gcp": "Cloud",
    "docker": "DevOps",
    "kubernetes": "DevOps",
    "k8s": "DevOps",
    "terraform": "DevOps",
    "jenkins": "DevOps",
    "github actions": "DevOps",
    "gitlab ci": "DevOps",
    "ci/cd": "DevOps",
    
    # Data Science
    "pandas": "Data Science",
    "numpy": "Data Science",
    "scikit-learn": "Data Science",
    "tensorflow": "Data Science",
    "pytorch": "Data Science",
    "keras": "Data Science",
    "spark": "Data Science",
    "hadoop": "Data Science",
    "tableau": "Data Science",
    "power bi": "Data Science",
    
    # Tools
    "git": "Tools",
    "github": "Tools",
    "gitlab": "Tools",
    "jira": "Tools",
    "confluence": "Tools",
    "slack": "Tools",
    "figma": "Tools",
    "postman": "Tools",
}

# Skills to EXCLUDE for software engineering/dev roles
IRRELEVANT_SKILLS = {
    "figma", "sketch", "adobe xd", "photoshop", "illustrator",
    "java",  # false positive from JavaScript
    "html", "css",
    "git", "github", "gitlab",
    "postman", "vs code", "jira", "confluence", "slack",
}

# Role mapping based on skills
ROLE_KEYWORDS: Dict[str, List[str]] = {
    "software engineer": [
        "react", "angular", "vue", "node.js", "express", "django",
        "flask", "spring", "html", "css", "javascript", "typescript",
        "git", "rest api", "graphql", "next.js", "tailwind"
    ],
    "frontend developer": ["software engineer"],
    "backend developer": ["software engineer"],
    "full stack developer": ["software engineer"],
    
    "data scientist": [
        "python", "pandas", "numpy", "scikit-learn", "tensorflow",
        "pytorch", "sql", "statistics", "machine learning", "data analysis",
        "tableau", "power bi", "spark"
    ],
    "data analyst": ["data scientist"],
    "ml engineer": ["data scientist"],
    
    "devops engineer": [
        "docker", "kubernetes", "aws", "azure", "gcp", "terraform",
        "jenkins", "ci/cd", "linux", "bash", "prometheus", "grafana"
    ],
    "cloud engineer": ["devops engineer"],
    "sre": ["devops engineer"],
    
    "product manager": ["product", "agile", "scrum", "jira", "confluence", "roadmap"],
    "qa analyst": ["testing", "selenium", "cypress", "jest", "pytest", "qa"],
    "ux designer": ["figma", "sketch", "adobe xd", "ui", "ux", "prototype"],
    "hr specialist": ["recruiting", "hiring", "onboarding", "hr", "people ops"],
    "marketing associate": ["marketing", "seo", "social media", "content", "analytics"],
}

# Valid roles for your model
VALID_MODEL_ROLES: List[str] = [
    "software engineer", "data scientist", "devops engineer",
    "product manager", "qa analyst", "ux designer",
    "hr specialist", "marketing associate"
]


def validate_and_clean_skills(skills: List[str]) -> List[str]:
    """
    Remove skills that are clearly false positives or irrelevant for development.
    """
    cleaned = [s for s in skills if s.lower() not in IRRELEVANT_SKILLS]
    cleaned = [s for s in cleaned if len(s) > 1]  # Remove single-letter skills
    
    if len(cleaned) != len(skills):
        logger.info(f"validate_and_clean_skills — removed {len(skills) - len(cleaned)} false positives")
    
    return cleaned


def extract_skills_from_text(text: str) -> List[str]:
    """
    Extract technical skills from resume text using keyword matching.
    Uses word boundaries to avoid false positives (e.g., "java" from "javascript").
    """
    extracted = set()
    text_lower = text.lower()
    
    for skill in SKILL_DATABASE.keys():
        # Use word boundaries to match whole words only
        pattern = r'\b' + re.escape(skill) + r'\b'
        if re.search(pattern, text_lower):
            extracted.add(skill.capitalize())
        # Note: substring fallback intentionally omitted to prevent false positives
    
    # Convert to list and clean
    result = validate_and_clean_skills(list(extracted))
    
    logger.info(f"extract_skills_from_text — extracted {len(result)} skills: {result[:10]}")
    return result


def predict_role_from_skills(skills: List[str]) -> Tuple[str, float]:
    """
    Predict the best matching role based on extracted skills.
    
    Returns:
        Tuple of (role, confidence_score)
    """
    scores: Dict[str, int] = {role: 0 for role in VALID_MODEL_ROLES}
    skills_lower = [s.lower() for s in skills]
    
    for role, keywords in ROLE_KEYWORDS.items():
        # Get the base role (handle mappings)
        base_role = role if role in VALID_MODEL_ROLES else "software engineer"
        
        for keyword in keywords:
            for skill in skills_lower:
                if keyword in skill or skill in keyword:
                    if base_role in scores:
                        scores[base_role] += 1
                    break
    
    # Find role with highest score
    if max(scores.values()) == 0:
        return "software engineer", 0.0
    
    # Get the role with maximum score
    best_role = max(scores.items(), key=lambda x: x[1])[0]
    confidence = scores[best_role] / max(1, len(skills))
    
    return best_role, round(min(confidence, 1.0), 2)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract all text from a PDF file using PyMuPDF (fitz).
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text_parts: List[str] = []
        
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            if text and isinstance(text, str):
                text_parts.append(text)
        
        doc.close()
        full_text = "\n".join(text_parts)
        logger.info("extract_text_from_pdf — extracted %d characters", len(full_text))
        return full_text.strip()
    except Exception as e:
        logger.error("extract_text_from_pdf — error: %s", e)
        raise ValueError(f"Failed to extract text from PDF: {e}")


async def save_resume_to_db(
    user_id: UUID,
    extracted_text: str,
    skills: List[str],
    predicted_role: str,
    role_confidence: float,
    used_gemini: bool = False,
) -> Dict[str, Any]:
    """
    Save resume data to Supabase and return the created row.
    """
    resume_data = {
        "user_id": str(user_id),
        "extracted_text": extracted_text[:5000],  # Limit text length
        "skills": skills,
        "predicted_role": predicted_role,
        "role_confidence": role_confidence,
        "used_gemini": used_gemini,
    }

    try:
        result = supabase.table("resumes").insert(resume_data).execute()
        if result.data:
            logger.info("save_resume_to_db — saved resume for user: %s, role: %s, skills: %d",
                       user_id, predicted_role, len(skills))
            return result.data[0]
        else:
            logger.error("save_resume_to_db — insert returned no data")
            raise Exception("Failed to save resume")
    except Exception as e:
        logger.error("save_resume_to_db — error: %s", e)
        raise


async def process_resume(
    user_id: UUID,
    file_bytes: bytes,
    filename: str,
    use_gemini: bool = True,
) -> ResumeUploadResponse:
    """
    Complete resume processing pipeline with role prediction.
    
    Pipeline:
        1. Validate PDF
        2. Extract text
        3. Extract skills (keyword matching)
        4. Clean and validate skills
        5. Predict role (local OR Gemini)
        6. Save to database
    """
    logger.info("process_resume — user: %s, file: %s, size: %d bytes, use_gemini: %s", 
                user_id, filename, len(file_bytes), use_gemini)

    # 1. Size check (10 MB limit)
    if len(file_bytes) > 10 * 1024 * 1024:
        raise ValueError("File is too large. Maximum allowed size is 10 MB.")

    # 2. Extension check
    if not filename.lower().endswith(".pdf"):
        raise ValueError("Only PDF files are allowed")

    # 3. Magic-bytes check — PDF files always start with %PDF
    if file_bytes[:4] != b"%PDF":
        raise ValueError("Uploaded file does not appear to be a valid PDF")

    # 4. Extract text
    try:
        extracted_text = extract_text_from_pdf(file_bytes)
        if not extracted_text:
            raise ValueError("No text could be extracted from PDF")
    except Exception as e:
        logger.error("process_resume — text extraction failed: %s", e)
        raise ValueError(f"Failed to extract text: {e}")

    # 5. Extract skills using keyword matching
    skills = extract_skills_from_text(extracted_text)
    skills_preview_str = ", ".join(skills[:10]) if skills else "none"
    logger.info("process_resume — extracted %d skills after cleaning: %s", len(skills), skills_preview_str)

    # 6. Predict role
    used_gemini = False
    role_confidence = 0.0
    predicted_role = "software engineer"  # Default
    
    if use_gemini and skills:
        # Try Gemini first for better accuracy
        try:
            gemini_result = await predict_role_from_resume(extracted_text, skills)
            if gemini_result and gemini_result.get("role"):
                predicted_role = gemini_result["role"].lower()
                role_confidence = gemini_result.get("confidence", 0.8)
                used_gemini = True
                logger.info("process_resume — Gemini predicted role: %s (confidence: %s)", 
                           predicted_role, role_confidence)
            else:
                predicted_role, role_confidence = predict_role_from_skills(skills)
        except Exception as e:
            logger.warning("process_resume — Gemini failed, falling back to local: %s", e)
            predicted_role, role_confidence = predict_role_from_skills(skills)
    else:
        predicted_role, role_confidence = predict_role_from_skills(skills)

    # Ensure role is in valid model roles
    if predicted_role not in VALID_MODEL_ROLES:
        logger.warning("process_resume — role '%s' not in model, mapping to default", predicted_role)
        # Try to find closest match
        found = False
        for valid_role in VALID_MODEL_ROLES:
            if valid_role in predicted_role or predicted_role in valid_role:
                predicted_role = valid_role
                found = True
                break
        if not found:
            predicted_role = "software engineer"  # Final fallback
        role_confidence = 0.3

    # 7. Save to database
    row = await save_resume_to_db(
        user_id=user_id,
        extracted_text=extracted_text,
        skills=skills,
        predicted_role=predicted_role,
        role_confidence=role_confidence,
        used_gemini=used_gemini,
    )

    # 8. Build response
    preview = extracted_text[:500] + "..." if len(extracted_text) > 500 else extracted_text

    logger.info("process_resume — completed for user: %s, role: %s (%.2f), skills: %d, gemini: %s",
               user_id, predicted_role, role_confidence, len(skills), used_gemini)
    
    return ResumeUploadResponse(
        id=row["id"],
        user_id=user_id,
        skills=skills,
        predicted_role=predicted_role,
        role_confidence=role_confidence,
        extracted_text=preview,
        created_at=row.get("created_at"),
    )