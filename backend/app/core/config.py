"""
Application configuration — loaded from environment variables via Pydantic Settings.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "VitalBridge API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = "CHANGE-ME-in-production-use-openssl-rand-hex-32"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:19006"

    # ── Auth ─────────────────────────────────────────────
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    ALGORITHM: str = "HS256"

    # ── Database ─────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./vitalbridge.db"

    # ── Grok AI ──────────────────────────────────────────
    GROK_API_KEY: Optional[str] = None
    GROK_MODEL: str = "grok-3-mini"
    GROK_BASE_URL: str = "https://api.x.ai/v1"

    # ── IoT Simulator ────────────────────────────────────
    IOT_DEMO_DAY_SECONDS: int = 120  # 2 minutes = 1 "day" in demo mode

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
