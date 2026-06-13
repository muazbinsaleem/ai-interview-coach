"""
app/services/gemini_service.py
===============================
Gemini Flash integration for personalised interview feedback and question generation.
"""

import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)
_TIMEOUT_SECONDS = 20.0
_MAX_OUTPUT_TOKENS = 600

# ── Key rotation ─────────────────────────────────────────────────────────────
# The active-key index cycles between 0 and 1 each time a limit is hit so
# the two quota buckets are consumed roughly equally over time.
_key_index: int = 0


def _get_keys() -> List[str]:
    """Return all configured API keys (non-empty only)."""
    candidates = [
        settings.google_gemini_api_key,
        settings.google_gemini_api_key_2,
    ]
    return [k.strip() for k in candidates if k and k.strip()]


def _current_key() -> Optional[str]:
    """Return the currently active API key (None if none configured)."""
    keys = _get_keys()
    if not keys:
        return None
    return keys[_key_index % len(keys)]


def _rotate_key() -> Optional[str]:
    """
    Rotate to the next API key and return it.
    Called automatically when the current key hits a rate / quota limit.
    """
    global _key_index
    keys = _get_keys()
    if len(keys) < 2:
        logger.warning("_rotate_key — only one key configured, cannot rotate")
        return keys[0] if keys else None
    _key_index = (_key_index + 1) % len(keys)
    logger.info("_rotate_key — switched to key index %d", _key_index)
    return keys[_key_index]

# Fallback response returned when Gemini is unavailable or errors out
_FALLBACK_FEEDBACK: Dict[str, Any] = {
    "strengths": [],
    "weaknesses": [],
    "tips": ["Review the ideal answer to identify areas for improvement."],
    "follow_up": None,
}


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(
    question: str,
    user_answer: str,
    ideal_answer: str,
    score: int,
    label: str,
) -> str:
    """Construct the Gemini prompt for interview feedback."""
    return f"""You are an expert interview coach. Analyse this interview answer and provide constructive, specific feedback.

QUESTION: {question}

CANDIDATE'S ANSWER: {user_answer}

IDEAL ANSWER (for reference): {ideal_answer}

AUTOMATED SCORE: {score}/3 ({label})

Provide feedback in JSON format with EXACTLY these fields:
{{
  "strengths": ["specific strength 1", "specific strength 2"],
  "weaknesses": ["specific gap 1", "specific gap 2"],
  "tips": ["actionable tip 1", "actionable tip 2"],
  "follow_up": "A challenging follow-up question that probes deeper understanding"
}}

Guidelines:
- strengths: Be specific — clarity, structure, use of examples, correct concepts, etc.
- weaknesses: Concrete gaps — missing metrics, no STAR format, vague statements, etc.
- tips: Actionable advice the candidate can apply immediately.
- follow_up: A question that tests deeper understanding or uncovers more experience.

Return ONLY valid JSON. No markdown fences, no preamble, no trailing text."""


# ── JSON extraction helper ────────────────────────────────────────────────────

def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse JSON from Gemini's response text.

    Handles:
      - Raw JSON objects
      - JSON wrapped in ```json … ``` fences
      - JSON wrapped in ``` … ``` fences
    """
    # Strip markdown fences (both opening and closing)
    cleaned = re.sub(r"```(?:json)?", "", text, flags=re.IGNORECASE).strip()

    # If there are still backtick remnants, remove them
    cleaned = cleaned.strip("`").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract the first {...} block as a last resort
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        logger.warning("_extract_json — could not parse Gemini response: %.200s", text)
        return None


async def _post_with_rotation(
    client: httpx.AsyncClient,
    url: str,
    **kwargs,
) -> httpx.Response:
    """
    POST to the Gemini API, automatically rotating to the secondary key when
    the primary returns HTTP 429 (rate-limited) or HTTP 403 (quota exceeded).

    Raises ``httpx.HTTPStatusError`` if both keys fail.
    """
    api_key = _current_key()
    if not api_key:
        raise ValueError("No Gemini API keys configured")

    response = await client.post(url, params={"key": api_key}, **kwargs)

    if response.status_code in (429, 403):
        rotated_key = _rotate_key()
        if rotated_key and rotated_key != api_key:
            logger.warning(
                "_post_with_rotation — key %d returned HTTP %d, retrying with rotated key",
                _key_index, response.status_code,
            )
            response = await client.post(url, params={"key": rotated_key}, **kwargs)

    response.raise_for_status()
    return response


# ── Core API call ─────────────────────────────────────────────────────────────

async def enhance_feedback(
    question: str,
    user_answer: str,
    ideal_answer: str,
    score: int,
    label: str,
) -> Optional[Dict[str, Any]]:
    """Request enhanced qualitative feedback from Gemini Flash."""
    api_key = _current_key()
    if not api_key:
        logger.warning("enhance_feedback — no Gemini API keys configured; skipping")
        return None

    prompt = _build_prompt(question, user_answer, ideal_answer, score, label)

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await _post_with_rotation(
                client,
                url=_GEMINI_URL,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": _MAX_OUTPUT_TOKENS,
                        "topP": 0.9,
                    },
                    "safetySettings": [
                        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                    ],
                },
            )
            data: Dict = response.json()

        candidates = data.get("candidates", [])
        if not candidates:
            logger.warning("enhance_feedback — Gemini returned no candidates")
            return _FALLBACK_FEEDBACK.copy()

        text: str = (
            candidates[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )

        if not text:
            logger.warning("enhance_feedback — Gemini returned empty text")
            return _FALLBACK_FEEDBACK.copy()

        parsed = _extract_json(text)
        if parsed is None:
            return _FALLBACK_FEEDBACK.copy()

        logger.info("enhance_feedback — success for question: %.60s…", question)

        return {
            "strengths": parsed.get("strengths") or [],
            "weaknesses": parsed.get("weaknesses") or [],
            "tips": parsed.get("tips") or [],
            "follow_up": parsed.get("follow_up"),
        }

    except httpx.TimeoutException:
        logger.warning("enhance_feedback — Gemini API timed out (%.0fs)", _TIMEOUT_SECONDS)
        return _FALLBACK_FEEDBACK.copy()
    except httpx.HTTPStatusError as exc:
        logger.error("enhance_feedback — Gemini HTTP %d error", exc.response.status_code)
        return _FALLBACK_FEEDBACK.copy()
    except Exception as exc:
        logger.error("enhance_feedback — unexpected error: %s", exc)
        return _FALLBACK_FEEDBACK.copy()


# ── Batch enhancement ─────────────────────────────────────────────────────────

async def enhance_session(answers_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enhance multiple evaluated answers with Gemini feedback concurrently."""
    async def _enhance_one(item: Dict[str, Any]) -> Dict[str, Any]:
        try:
            feedback = await enhance_feedback(
                question=item.get("question", ""),
                user_answer=item.get("user_answer", ""),
                ideal_answer=item.get("ideal_answer", ""),
                score=item.get("score", 0),
                label=item.get("label", "bad"),
            )
        except Exception as exc:
            logger.error("enhance_session — unhandled error for item: %s", exc)
            feedback = _FALLBACK_FEEDBACK.copy()
        return {**item, "feedback": feedback}

    tasks = [_enhance_one(item) for item in answers_data]
    results = await asyncio.gather(*tasks, return_exceptions=False)
    return list(results)


# ── Skill Categorization ──────────────────────────────────────────────────────

def get_category_for_skill(skill: str) -> str:
    """Return a specific category based on the skill name."""
    skill_lower = skill.lower()
    
    # Frontend Development
    if any(x in skill_lower for x in ["react", "next", "vue", "angular", "frontend", "ui", "css", "tailwind", "html", "bootstrap", "figma"]):
        return "Frontend Development"
    
    # Backend Development
    elif any(x in skill_lower for x in ["node", "express", "django", "flask", "fastapi", "api", "backend", "rest", "graphql", "spring"]):
        return "Backend Development"
    
    # Database & Data Modeling
    elif any(x in skill_lower for x in ["postgresql", "supabase", "mysql", "mongodb", "database", "sql", "redis", "dynamodb", "firebase"]):
        return "Database & Data Modeling"
    
    # Programming Languages
    elif any(x in skill_lower for x in ["typescript", "python", "javascript", "go", "rust", "java", "c++", "c#", "ruby", "php", "swift", "kotlin"]):
        return f"{skill} Programming"
    
    # Cloud & DevOps
    elif any(x in skill_lower for x in ["aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "ci/cd", "cloud"]):
        return "Cloud & DevOps"
    
    # Testing & Quality
    elif any(x in skill_lower for x in ["test", "jest", "pytest", "cypress", "selenium", "quality", "qa"]):
        return "Testing & Quality Assurance"
    
    # Performance Optimization
    elif any(x in skill_lower for x in ["performance", "optimization", "caching", "ssr", "lazy loading"]):
        return "Performance Optimization"
    
    # Security & Authentication
    elif any(x in skill_lower for x in ["security", "auth", "rls", "authorization", "encryption", "jwt"]):
        return "Security & Authentication"
    
    # System Design
    elif any(x in skill_lower for x in ["system design", "architecture", "scalability", "microservices"]):
        return "System Design"
    
    # Default
    else:
        return "Technical Skills"


# ── Personalized Question Generation ─────────────────────────────────────────

# Templates used by the local fallback personalizer.
# Each entry must contain {skill} and {role}.
_FALLBACK_TEMPLATES = [
    # Frontend/Fullstack focused (matches your resume)
    "You have {skill} listed on your resume. In your e-commerce project, how did you use {skill} to solve a specific technical challenge?",
    "Based on your experience with {skill} in your Health AI project, walk me through how you implemented a key feature using {skill}.",
    "As a {role} with {skill} experience, describe how you used {skill} to optimize performance in your applications.",
    "In your Academy Dashboard System, how did you use {skill} to handle data management and user authentication?",
    "Tell me about a time you debugged a difficult issue involving {skill} in a production application.",
    "How do you approach testing and code quality when working with {skill} in your freelance projects?",
    "Describe your process for implementing responsive, production-ready UIs using {skill}.",
    "How have you used {skill} to improve database query performance or implement security measures?",
]

# Skill prioritization order - technical skills first
SKILL_PRIORITY_ORDER = [
    "typescript", "react.js", "next.js", "tailwind css", "postgresql",
    "supabase", "node.js", "python", "javascript", "rest apis",
    "git", "github", "vercel", "postman",
]

# Low-signal skills to filter out
_LOW_SIGNAL_SKILLS = {
    "html", "css", "git", "github", "gitlab", "figma", "postman",
    "vs code", "jira", "confluence", "slack", "linux", "bash",
    "java",  # not on resume; extractor false-positive guard
    "javascript",  # too broad, use TypeScript instead
    "sql",  # too broad, your specific DB skills are better
}

# High-value skills to prioritize
_HIGH_VALUE_SKILLS = {
    "typescript", "react.js", "next.js", "tailwind css", "tailwind",
    "postgresql", "supabase", "node.js", "python", "rest api", "graphql"
}


def _prioritize_skills(skills: List[str]) -> List[str]:
    """Return skills sorted by relevance to development roles."""
    # Filter out low-signal skills first
    filtered = []
    for s in skills:
        s_lower = s.lower()
        if s_lower in _HIGH_VALUE_SKILLS:
            filtered.append(s)
        elif s_lower not in _LOW_SIGNAL_SKILLS and len(s) > 2:
            filtered.append(s)
    
    # Then prioritize by order
    skills_lower = {s.lower(): s for s in filtered}
    prioritized = []
    for priority_skill in SKILL_PRIORITY_ORDER:
        if priority_skill in skills_lower:
            prioritized.append(skills_lower[priority_skill])
    
    # Then add remaining skills
    for skill in filtered:
        if skill not in prioritized:
            prioritized.append(skill)
    
    # Fallback defaults if nothing left
    if not prioritized:
        prioritized = ["TypeScript", "React.js", "Next.js", "Tailwind CSS", "PostgreSQL", "Supabase", "Node.js"]
        logger.warning(f"_prioritize_skills — no skills after filtering, using defaults: {prioritized}")
    
    return prioritized[:15]  # Limit to 15 skills


def _skill_is_referenced(question_text: str, skill: str) -> bool:
    """Return True if the skill name appears (case-insensitive) in the question text."""
    return skill.lower() in question_text.lower()


def _validate_and_filter_questions(
    questions: List[Dict[str, str]],
    skills: List[str],
) -> List[Dict[str, str]]:
    """
    Validate that each generated question actually references a resume skill.

    Strategy:
    - Keep questions where ``skill_used`` appears verbatim in the question text.
    - For questions that claim a skill but don't embed it, attempt a simple
      repair by prepending "Given your {skill_used} experience, ".
    - Drop questions with no ``skill_used`` field that also contain no skill
      keyword at all.

    Returns a cleaned list (may be shorter than the input).
    """
    skills_lower = {s.lower(): s for s in skills}
    valid: List[Dict[str, str]] = []

    for q in questions:
        text: str = q.get("text", "").strip()
        skill_used: str = q.get("skill_used", "").strip()

        if not text:
            continue

        # If Gemini set skill_used, verify it appears in the text.
        if skill_used:
            if _skill_is_referenced(text, skill_used):
                valid.append(q)
                logger.debug("_validate — PASS: skill %r found in question", skill_used)
            else:
                # Attempt repair: prepend the skill reference.
                repaired_text = f"Given your experience with {skill_used}, {text[0].lower()}{text[1:]}"
                logger.info(
                    "_validate — REPAIRED question (skill %r missing from text): %.80s",
                    skill_used, text,
                )
                valid.append({**q, "text": repaired_text})
            continue

        # No skill_used field — check whether any resume skill appears in the text.
        matched_skill = next(
            (orig for lower, orig in skills_lower.items() if lower in text.lower()),
            None,
        )
        if matched_skill:
            valid.append({**q, "skill_used": matched_skill})
        else:
            logger.warning("_validate — DROPPED generic question (no skill reference): %.80s", text)

    return valid


def _build_local_fallback_questions(
    role: str,
    skills: List[str],
    num_questions: int,
) -> List[Dict[str, str]]:
    """
    Build personalized questions locally without calling Gemini.
    Uses role-appropriate templates and prioritizes relevant skills.
    """
    # Filter out low-signal skills
    filtered_skills = [s for s in skills if s.lower() not in _LOW_SIGNAL_SKILLS]
    
    if not filtered_skills:
        # Fallback to default skills based on role
        if "frontend" in role.lower() or "software" in role.lower():
            filtered_skills = ["TypeScript", "React.js", "Next.js", "Tailwind CSS", "PostgreSQL"]
        elif "data" in role.lower():
            filtered_skills = ["Python", "SQL", "Pandas"]
        else:
            filtered_skills = ["JavaScript", "Node.js", "PostgreSQL"]
    
    # Prioritize skills
    skills_lower = {s.lower(): s for s in filtered_skills}
    prioritized = []
    for priority in SKILL_PRIORITY_ORDER:
        if priority in skills_lower:
            prioritized.append(skills_lower[priority])
    
    for skill in filtered_skills:
        if skill not in prioritized:
            prioritized.append(skill)
    
    skills_to_use = prioritized[:num_questions]
    
    questions: List[Dict[str, str]] = []
    template_count = len(_FALLBACK_TEMPLATES)
    
    for i, skill in enumerate(skills_to_use):
        template_index = i % template_count
        template = _FALLBACK_TEMPLATES[template_index]
        
        # Get specific category for this skill
        category = get_category_for_skill(skill)
        
        # Customize template based on skill type
        skill_lower = skill.lower()
        if skill_lower in ["react.js", "next.js", "tailwind css"]:
            text = template.format(skill=skill, role="frontend developer")
        elif skill_lower in ["postgresql", "supabase"]:
            text = template.format(skill=skill, role="database engineer")
        else:
            text = template.format(skill=skill, role=role)
        
        questions.append({
            "text": text,
            "topic": category,
            "skill_used": skill,
        })
    
    logger.info("_build_local_fallback_questions — built %d questions with categories: %s", 
                len(questions), [(q["skill_used"], q["topic"]) for q in questions])
    return questions


async def generate_personalized_questions(
    role: str,
    difficulty: str,
    skills: List[str],
    num_questions: int = 6,
) -> Optional[List[Dict[str, str]]]:
    """
    Generate personalized interview questions based on resume skills using Gemini.

    The function applies a three-layer approach:
    1. **Strict Gemini prompt** — explicit per-skill examples and hard
       rules force the model to embed skill names in every question.
    2. **Post-generation validation** — every returned question is checked
       for a skill keyword; generic ones are repaired or dropped.
    3. **Local fallback** — if Gemini is unavailable or produces too few
       valid questions, template-based personalization fills the gap.

    Args:
        role: Job role (e.g. "software engineer").
        difficulty: "Easy", "Medium", or "Hard".
        skills: Skills extracted from the candidate's resume.
        num_questions: Number of questions to return (default 6).

    Returns:
        List of dicts with keys ``text``, ``topic``, ``skill_used``.
        Never returns None — falls back to local personalization instead.
    """
    # ── Filter skills based on role ──────────────────────────────────────────
    role_lower = role.lower()
    
    # For software engineer roles, exclude low-signal skills
    if "software" in role_lower or "engineer" in role_lower or "full" in role_lower:
        filtered_skills = [s for s in skills if s.lower() not in _LOW_SIGNAL_SKILLS]
        logger.info(f"generate_personalized_questions — filtered from {len(skills)} to {len(filtered_skills)} skills for {role}")
        skills = filtered_skills
    
    # If no skills after filtering, add default relevant skills
    if not skills:
        logger.warning(f"generate_personalized_questions — no skills after filtering, using defaults for {role}")
        skills = ["TypeScript", "React.js", "Next.js", "PostgreSQL", "Node.js"]
    
    # ── Prioritize skills ───────────────────────────────────────────────────
    skill_list = _prioritize_skills(skills)
    logger.info(f"generate_personalized_questions — using {len(skill_list)} prioritized skills: {skill_list[:8]}")

    api_key = _current_key()
    if not api_key:
        logger.warning("generate_personalized_questions — no API key; using local fallback")
        return _build_local_fallback_questions(role, skill_list, num_questions)

    # ── Build skill block for the prompt ──────────────────────────────────────
    numbered_skills = "\n".join(f"  {i+1}. {s}" for i, s in enumerate(skill_list))

    # Build concrete per-skill examples with specific categories
    example_skills = skill_list[:3]
    example_block = "\n".join(
        f'    {{ "text": "You listed {s} on your resume — describe a specific project '
        f'where {s} was critical and explain the architectural decision you made.", '
        f'"topic": "{get_category_for_skill(s)}", "skill_used": "{s}" }}'
        for s in example_skills
    )

    prompt = f"""You are a strict technical interviewer creating HIGHLY PERSONALISED questions.

CANDIDATE'S RESUME SKILLS (use ONLY these exact names — DO NOT invent skills):
{numbered_skills}

CRITICAL RULES — follow every one of them:
1. You MUST use ONLY skills from the numbered list above. DO NOT use Java, HTML, CSS, Git, Figma, or any skill not listed.
2. EVERY question MUST include the exact skill name from the list above.
3. If the candidate doesn't have a skill, DO NOT ask about it.
4. The candidate's actual skills are: {', '.join(skill_list[:8])}. Ask ONLY about these.

ROLE: {role}
DIFFICULTY: {difficulty}
QUESTIONS NEEDED: {num_questions}

════════════════════════════════════════════
MORE RULES — follow every one of them:
════════════════════════════════════════════
1. EVERY question text MUST include the exact skill name from the list above.
   Do NOT paraphrase or abbreviate the skill name.
2. FORBIDDEN opening phrases (these produce generic questions):
   - "Explain [skill] in context of..."
   - "What is [skill]?"
   - "Describe [skill]."
   - "How does [skill] work?"
3. REQUIRED opening patterns — use one of these:
   - "You listed [skill] on your resume — ..."
   - "Based on your [skill] experience, walk me through ..."
   - "In one of your [skill] projects, how did you handle ..."
   - "Given that you have worked with [skill], describe a situation where ..."
4. Each question must be scenario-based or experience-based, NOT definition-based.
5. Spread questions across DIFFERENT skills from the list above.
6. The `skill_used` field must exactly match the skill name from the numbered list.
7. The `topic` field must be a SPECIFIC category based on the skill (e.g., "Frontend Development", "Database & Data Modeling", not just "Technical").
════════════════════════════════════════════

EXAMPLES of CORRECT questions (match this style exactly):
{example_block}

EXAMPLES of WRONG questions (NEVER produce these):
  BAD: "Explain React in context of software engineering."
  BAD: "What is Node.js and how does it work?"
  BAD: "Describe Python and its use cases."
  BAD: "How do you use Java in your projects?" (if Java not in list)

Respond ONLY with valid JSON — no markdown fences, no explanation:
{{
  "questions": [
    {{
      "text": "<question text that explicitly names the skill>",
      "topic": "<specific category like 'Frontend Development' or 'Database & Data Modeling'>",
      "skill_used": "<exact skill name from the numbered list>"
    }}
  ]
}}"""

    gemini_questions: Optional[List[Dict[str, str]]] = None

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await _post_with_rotation(
                client,
                url=_GEMINI_URL,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.4,   # Lower temp → more deterministic skill references
                        "maxOutputTokens": 1200,
                        "topP": 0.85,
                    },
                    "safetySettings": [
                        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                    ],
                },
            )
            data: Dict = response.json()

        candidates = data.get("candidates", [])
        if not candidates:
            logger.warning("generate_personalized_questions — Gemini returned no candidates")
        else:
            raw_text = (
                candidates[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            if not raw_text:
                logger.warning("generate_personalized_questions — Gemini returned empty text")
            else:
                parsed = _extract_json(raw_text)
                if parsed is not None:
                    raw_questions = parsed.get("questions", [])
                    validated = _validate_and_filter_questions(raw_questions, skill_list)
                    if validated:
                        gemini_questions = validated[:num_questions]
                        logger.info(
                            "generate_personalized_questions — %d/%d Gemini questions passed validation",
                            len(gemini_questions), len(raw_questions),
                        )
                    else:
                        logger.warning(
                            "generate_personalized_questions — all %d Gemini questions failed validation",
                            len(raw_questions),
                        )

    except httpx.TimeoutException:
        logger.warning("generate_personalized_questions — Gemini timed out; using local fallback")
    except httpx.HTTPStatusError as exc:
        logger.error("generate_personalized_questions — Gemini HTTP %d; using local fallback", exc.response.status_code)
    except Exception as exc:
        logger.error("generate_personalized_questions — unexpected error: %s; using local fallback", exc)

    # ── Gap-fill or full fallback ──────────────────────────────────────────────
    if gemini_questions and len(gemini_questions) >= num_questions:
        return gemini_questions

    fallback = _build_local_fallback_questions(role, skill_list, num_questions)

    if gemini_questions:
        # Merge: keep Gemini questions, pad remainder with fallback.
        needed = num_questions - len(gemini_questions)
        merged = gemini_questions + fallback[:needed]
        logger.info(
            "generate_personalized_questions — merged %d Gemini + %d fallback questions",
            len(gemini_questions), needed,
        )
        return merged

    logger.info("generate_personalized_questions — returning %d local fallback questions", len(fallback))
    return fallback


# ── Technical Practice Question Generation ───────────────────────────────────

# Role → example technical topics to seed the Gemini prompt.
_ROLE_TECH_TOPICS: dict[str, list[str]] = {
    "software engineer": [
        "TypeScript", "React.js", "Next.js", "Node.js", "PostgreSQL",
        "REST APIs", "system design", "algorithms & data structures",
        "performance optimization", "code review practices",
    ],
    "data scientist": [
        "Python", "Pandas", "NumPy", "scikit-learn", "SQL",
        "machine learning models", "data pipelines", "feature engineering",
        "model evaluation", "data visualization",
    ],
    "devops engineer": [
        "Docker", "Kubernetes", "CI/CD", "Terraform", "AWS",
        "monitoring & alerting", "incident response", "Linux", "networking", "security",
    ],
    "qa analyst": [
        "test automation", "Selenium", "Cypress", "Jest", "pytest",
        "test planning", "regression testing", "API testing", "performance testing",
        "bug reporting",
    ],
}


async def generate_technical_practice_questions(
    role: str,
    difficulty: str,
    num_questions: int = 6,
) -> Optional[List[Dict[str, str]]]:
    """
    Generate pure technical interview questions for practice mode (no resume).

    Unlike ``generate_personalized_questions``, this function does NOT require
    resume skills — it uses common technologies and concepts for the given role.
    Behavioral / soft-skill questions are explicitly forbidden in the prompt.

    Args:
        role:          Job role, e.g. "software engineer".
        difficulty:    "easy", "medium", or "hard".
        num_questions: Number of questions to return (default 6).

    Returns:
        List of dicts with keys ``text``, ``topic``, ``ideal_answer``.
        Returns None if Gemini is unavailable (caller should fall back to ML bank).
    """
    api_key = _current_key()
    if not api_key:
        logger.warning("generate_technical_practice_questions — no API key; returning None")
        return None

    role_lower = role.lower()
    topics = _ROLE_TECH_TOPICS.get(role_lower, ["programming", "system design", "algorithms"])
    topics_str = ", ".join(topics)

    difficulty_guidance = {
        "easy":   "Suitable for junior engineers. Focus on fundamentals and basic concepts.",
        "medium": "Suitable for mid-level engineers. Include scenario-based and design questions.",
        "hard":   "Suitable for senior engineers. Focus on complex system design, trade-offs, and edge cases.",
    }.get(difficulty.lower(), "Mix of conceptual and scenario-based questions.")

    prompt = f"""You are a senior technical interviewer generating practice interview questions for a {role} position.

DIFFICULTY: {difficulty}
{difficulty_guidance}

RELEVANT TECHNICAL TOPICS FOR THIS ROLE:
{topics_str}

STRICT RULES — follow every one:
1. ALL {num_questions} questions must be PURELY TECHNICAL. No behavioral, motivational, or HR questions.
2. FORBIDDEN question types (do NOT include ANY of these):
   - "Tell me about a time you..." (behavioral)
   - "How do you stay motivated..." (motivational)
   - "Describe a conflict..." (HR/soft-skill)
   - "Why do you want to work here?" (HR)
   - "What are your career goals?" (HR)
   - "How do you handle feedback?" (behavioral)
   - "What is your biggest weakness?" (HR)
3. ALLOWED question types (use only these):
   - Coding / algorithm challenges
   - System design and architecture
   - Technology-specific technical questions (e.g., "How does React's reconciliation work?")
   - Debugging and problem-solving scenarios
   - Performance optimization trade-offs
   - Security and best-practice questions about specific technologies
4. Each question must be specific and technical — not vague or generic.
5. Spread questions across DIFFERENT topics from the list above.
6. Provide a concise ideal answer (2-4 sentences) for each question.

Respond ONLY with valid JSON — no markdown fences, no explanation:
{{
  "questions": [
    {{
      "text": "<specific technical question>",
      "topic": "<specific topic category, e.g. 'React.js' or 'System Design'>",
      "ideal_answer": "<concise model answer, 2-4 sentences>"
    }}
  ]
}}"""

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await _post_with_rotation(
                client,
                url=_GEMINI_URL,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.5,
                        "maxOutputTokens": 1400,
                        "topP": 0.9,
                    },
                    "safetySettings": [
                        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                    ],
                },
            )
            data: Dict = response.json()

        candidates = data.get("candidates", [])
        if not candidates:
            logger.warning("generate_technical_practice_questions — Gemini returned no candidates")
            return None

        raw_text = (
            candidates[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        if not raw_text:
            logger.warning("generate_technical_practice_questions — Gemini returned empty text")
            return None

        parsed = _extract_json(raw_text)
        if parsed is None:
            return None

        questions = parsed.get("questions", [])
        if not questions:
            logger.warning("generate_technical_practice_questions — Gemini returned empty questions list")
            return None

        logger.info(
            "generate_technical_practice_questions — Gemini returned %d technical questions for role=%r",
            len(questions), role,
        )
        return questions[:num_questions]

    except httpx.TimeoutException:
        logger.warning("generate_technical_practice_questions — Gemini timed out")
        return None
    except httpx.HTTPStatusError as exc:
        logger.error(
            "generate_technical_practice_questions — Gemini HTTP %d", exc.response.status_code
        )
        return None
    except Exception as exc:
        logger.error("generate_technical_practice_questions — unexpected error: %s", exc)
        return None


# ── Resume Role Prediction ────────────────────────────────────────────────────

async def predict_role_from_resume(
    resume_text: str,
    extracted_skills: List[str],
) -> Optional[Dict[str, Any]]:
    """Use Gemini to predict the best interview role from a resume."""
    api_key = _current_key()
    if not api_key:
        logger.warning("predict_role_from_resume — no Gemini API keys configured; skipping")
        return None

    truncated_text = resume_text[:8000] if len(resume_text) > 8000 else resume_text
    skills_str = ", ".join(extracted_skills[:20]) if extracted_skills else "No specific skills detected"
    
    prompt = f"""You are an expert career coach and technical recruiter. Analyze this resume and determine the BEST interview role from the list below.

VALID ROLES (choose ONLY from these):
- software engineer
- data scientist  
- devops engineer
- product manager
- qa analyst
- ux designer
- hr specialist
- marketing associate

RESUME TEXT:
{truncated_text}

EXTRACTED SKILLS:
{skills_str}

Respond ONLY with valid JSON — no markdown, no explanation:
{{
  "role": "one of the valid roles above",
  "confidence": 0.85,
  "reasoning": "Brief explanation of why this role fits",
  "suggested_topics": ["topic1", "topic2", "topic3"],
  "missing_skills": ["skill1", "skill2"]
}}"""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await _post_with_rotation(
                client,
                url=_GEMINI_URL,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 300,
                        "topP": 0.9,
                    },
                },
            )
            data = response.json()

        candidates = data.get("candidates", [])
        if not candidates:
            return None

        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not text:
            return None

        parsed = _extract_json(text)
        if parsed is None:
            return None

        logger.info("predict_role_from_resume — Gemini predicted role: %s", parsed.get("role"))
        return {
            "role": parsed.get("role", "software engineer"),
            "confidence": float(parsed.get("confidence", 0.7)),
            "reasoning": parsed.get("reasoning", ""),
            "suggested_topics": parsed.get("suggested_topics", []),
            "missing_skills": parsed.get("missing_skills", []),
        }
    except Exception as exc:
        logger.error("predict_role_from_resume — error: %s", exc)
        return None


async def generate_resume_suggestions(
    resume_text: str,
    predicted_role: str,
    missing_skills: List[str],
) -> Optional[Dict[str, Any]]:
    """Generate personalized suggestions for resume improvement."""
    api_key = _current_key()
    if not api_key:
        return None

    truncated_text = resume_text[:8000]
    missing_str = ", ".join(missing_skills) if missing_skills else "None identified"
    
    prompt = f"""You are an expert resume coach. Provide actionable suggestions to improve this resume for a {predicted_role} role.

CURRENT RESUME (excerpt):
{truncated_text}

MISSING SKILLS IDENTIFIED:
{missing_str}

Respond ONLY with valid JSON:
{{
  "summary": "1-2 sentence overall assessment",
  "improvements": ["specific improvement 1", "improvement 2", "improvement 3"],
  "learning_resources": ["free resource 1", "resource 2"],
  "keywords_to_add": ["keyword1", "keyword2"]
}}"""

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await _post_with_rotation(
                client,
                url=_GEMINI_URL,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.3,
                        "maxOutputTokens": 400,
                    },
                },
            )
            data = response.json()

        candidates = data.get("candidates", [])
        if not candidates:
            return None

        text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if not text:
            return None

        return _extract_json(text)
    except Exception as exc:
        logger.error("generate_resume_suggestions — error: %s", exc)
        return None