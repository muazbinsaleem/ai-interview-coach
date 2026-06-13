"""
app/main.py
===========
FastAPI application factory and entry-point.

Responsibilities:
  - Configure the Python logging system.
  - Create the FastAPI app instance with OpenAPI metadata.
  - Add CORS middleware.
  - Register all routers with their URL prefixes and OpenAPI tags.
  - Expose the /health endpoint.
  - Load the interview model on startup.

Run locally with:
  uvicorn app.main:app --reload
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Logging (must be configured BEFORE any other app imports use loggers) ──────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s — %(levelname)s — %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

from app.config import settings  # noqa: E402  (import after logging setup)
from app.routers import auth, resume, questions, evaluate, sessions, dashboard, interview  # noqa: E402
from app.services import interview_model  # noqa: E402


# ── Lifespan (startup/shutdown) ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup
    logger.info("Starting up application...")

    # Pre-load the interview model to avoid cold-start latency on first request
    try:
        interview_model.load_model()
        logger.info("Interview model loaded successfully on startup")
    except Exception as e:
        logger.error("Failed to load interview model on startup: %s", e)
        # Non-fatal: the API keeps running; /interview/* endpoints will return
        # graceful 503 errors until the model file is present.

    yield

    # Shutdown
    logger.info("Shutting down application...")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Interview Coach API",
    description=(
        "Backend for the AI Interview Coach university project. "
        "Features: user auth, resume parsing, interview question generation, "
        "answer evaluation with trained ML model, and AI feedback."
    ),
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Always allow localhost for local development.
_cors_origins: list[str] = ["http://localhost:3000"]

# Pull in the primary frontend URL (e.g. Vercel / Netlify deployment).
if settings.frontend_url:
    _cors_origins.append(settings.frontend_url.rstrip("/"))

# Pull in any additional comma-separated origins from CORS_ORIGINS.
if settings.cors_origins:
    for _origin in settings.cors_origins.split(","):
        _origin = _origin.strip().rstrip("/")
        if _origin and _origin not in _cors_origins:
            _cors_origins.append(_origin)

logger.info("CORS allowed origins: %s", _cors_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# Legacy endpoints (kept for backward compatibility)
app.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
app.include_router(resume.router,    prefix="/resume",    tags=["Resume"])
app.include_router(questions.router, prefix="/questions", tags=["Questions (Legacy)"])
app.include_router(evaluate.router,  prefix="/evaluate",  tags=["Evaluate (Legacy)"])
app.include_router(sessions.router,  prefix="/sessions",  tags=["Sessions"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])

# ML-model-powered interview system (primary endpoints)
app.include_router(interview.router, prefix="/interview", tags=["Interview"])


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check() -> dict:
    """
    Liveness probe — confirms the API is up and returns version info.
    """
    logger.info("GET /health")

    # Check whether the interview model is ready
    model_loaded = interview_model.get_model() is not None

    return {
        "success": True,
        "data": {
            "status": "ok",
            "version": settings.app_version,
            "environment": settings.environment,
            "model_loaded": model_loaded,
            "gemini_enabled": bool(settings.google_gemini_api_key),
        },
    }


# ── Root endpoint ────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
def root() -> dict:
    """
    Root endpoint with API information.
    """
    return {
        "success": True,
        "data": {
            "name": "AI Interview Coach API",
            "version": settings.app_version,
            "docs": "/docs",
            "endpoints": [
                "/auth/* — Authentication",
                "/resume/* — Resume management",
                "/questions/* — Legacy question generation",
                "/evaluate/* — Legacy answer evaluation",
                "/sessions/* — Session management",
                "/dashboard/* — Analytics",
                "/interview/* — ML-powered interview system (primary)",
            ],
        },
    }


logger.info(
    "FastAPI app initialised — environment=%s, gemini=%s",
    settings.environment,
    "enabled" if settings.google_gemini_api_key else "disabled",
)