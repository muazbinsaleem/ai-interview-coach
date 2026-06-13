"""
app/config.py
=============
Application configuration loaded once at startup via pydantic-settings.

All environment variables are read from the .env file (or the real environment)
and validated here.  Import `settings` from this module wherever config values
are needed — never read os.environ directly elsewhere.
"""

import logging
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    """
    Central settings object.

    Reads values from the .env file in the project root, then falls back to
    actual environment variables.  All fields are validated by pydantic on
    startup, so missing required variables raise an informative error
    immediately rather than at runtime.
    """

    # ── Supabase ──────────────────────────────────────────────────────────────
    supabase_url: str = Field(..., description="Full Supabase project URL")
    supabase_key: str = Field(..., description="Supabase service-role or anon key")

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt_secret: str = Field(..., description="Secret key used to sign JWTs")
    jwt_algorithm: str = Field(default="HS256", description="JWT signing algorithm")
    jwt_expire_minutes: int = Field(
        default=10080, description="Token lifetime in minutes (7 days)"
    )

    # ── Hugging Face ─────────────────────────────────────────────────────────
    huggingface_api_key: str = Field(
        default="", description="Hugging Face inference API key"
    )

    # ── Google Gemini ────────────────────────────────────────────────────────
    google_gemini_api_key: str = Field(
        default="", description="Google Gemini API key (primary) for AI feedback enhancement"
    )
    google_gemini_api_key_2: str = Field(
        default="", description="Google Gemini API key (secondary / rotation fallback)"
    )

    # ── App ───────────────────────────────────────────────────────────────────
    environment: str = Field(
        default="development", description="Runtime environment"
    )
    app_version: str = Field(default="1.0.0", description="Application version string")
    
    # ── Model Paths ──────────────────────────────────────────────────────────
    interview_model_path: str = Field(
        default="models_data/interview_model.joblib",
        description="Path to the trained interview model file"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Single shared instance — import this everywhere.
settings: Settings = Settings()

logger.info(
    "Config loaded — environment=%s, version=%s, gemini_keys=%d active",
    settings.environment,
    settings.app_version,
    sum(bool(k) for k in [settings.google_gemini_api_key, settings.google_gemini_api_key_2]),
)