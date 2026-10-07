"""
Application settings loaded from environment variables / ``.env``.

How it works:
  - ``Settings`` is a Pydantic BaseSettings model — each field maps to an
    env var of the same name (case-insensitive), e.g. ``PORT`` → ``port``.
  - ``get_settings()`` is cached so we parse ``.env`` only once per process.
  - Routes inject settings via ``SettingsDep``.

These are process-wide defaults only. Per-user ``user_settings`` overlays
are applied in ``ai.model.build_model`` / ``build_model_for_user`` — never
mutate this cached instance with DB values.

Sensitive keys (API secrets) are optional at the type level so the app can
start without every provider configured; individual services raise if *their*
key is missing when first used.
"""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All runtime configuration for the Writr backend.

    Values below are defaults used when the matching env var is unset.
    Chat fields also act as fallbacks when ``user_settings`` columns are NULL.
    """

    # Load from a local .env file in development; ignore unknown env keys
    # so adding new vars elsewhere does not crash startup.
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- server ---
    environment: str = "development"  # e.g. development | production
    port: int = 8000
    # Optional deploy identity. Wide events include these only when set.
    service_name: str = "writr-backend"
    service_version: str | None = None
    commit_sha: str | None = None
    region: str | None = None
    deployment_id: str | None = None
    # Shared secret for Supabase Cron → GET /internal/drain-jobs (Bearer token).
    cron_secret: str | None = None

    # --- Supabase ---
    # Project URL, e.g. https://xxxx.supabase.co
    supabase_url: str | None = None
    # Preferred client key (new publishable key name).
    supabase_publishable_key: str | None = None
    # Legacy anon key — still accepted via supabase_api_key property.
    supabase_anon_key: str | None = None
    # Preferred backend secret (new sb_secret_… style).
    supabase_secret_key: str | None = None
    # Legacy service_role JWT — still accepted via supabase_admin_key property.
    supabase_service_role_key: str | None = None

    # --- LLM / embedding provider API keys ---
    # Hosted Gemini is the only app default; other keys are optional integrations.
    gemini_api_key: str | None = None
    openai_api_key: str | None = None
    openrouter_api_key: str | None = None
    groq_api_key: str | None = None

    # --- chat defaults (nullable user_settings columns override when set) ---
    model_name: str = "gemini-2.5-pro"
    temperature: float = 0.0
    k: int = 5
    max_token: int = 1000
    top_p: float | None = None
    top_k: int | None = None

    # --- embedding model defaults ---
    gemini_embedding_model: str = "gemini-embedding-2"
    openai_embedding_model: str = "text-embedding-3-small"
    # Must match the vector column size in the database (pgvector).
    embedding_dim: int = 768

    # --- chunking defaults (consumed by services.chunking.Chunker) ---
    chunk_size: int = 800  # max characters per chunk (approx)
    chunk_overlap: int = 150  # chars re-included from previous chunk
    atomic_max: int = 2400  # below this token estimate → "record" profile
    min_chunk: int = 480  # tails shorter than this get merged

    @property
    def supabase_api_key(self) -> str | None:
        """Client-facing key: prefer publishable, fall back to legacy anon."""
        return self.supabase_publishable_key or self.supabase_anon_key

    @property
    def supabase_admin_key(self) -> str | None:
        """Backend-only key: prefer secret, fall back to legacy service_role."""
        return self.supabase_secret_key or self.supabase_service_role_key

    @property
    def gemini_chat_model(self) -> str:
        """Alias kept for older call sites (``services.llm``)."""
        return self.model_name


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the shared env Settings instance (parsed once, then cached)."""
    return Settings()


# Route signature helper: ``settings: SettingsDep``.
SettingsDep = Annotated[Settings, Depends(get_settings)]
