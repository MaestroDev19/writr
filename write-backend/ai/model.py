from __future__ import annotations

from typing import Any

from langchain.chat_models import init_chat_model

from core.config import get_settings
from services.user_settings import EffectiveChatSettings


def build_model(
    model_name: str,
    temperature: float = 0.0,
    max_tokens: int = 1000,
    *,
    top_p: float | None = None,
    top_k: int | None = None,
    **kwargs: Any,
):
    """Build the app-hosted Gemini chat model from explicit params."""
    settings = get_settings()
    init_kwargs: dict[str, Any] = {
        "model": model_name,
        "model_provider": "google_genai",
        "temperature": temperature,
        "max_tokens": max_tokens,
        **kwargs,
    }
    if settings.gemini_api_key:
        init_kwargs["api_key"] = settings.gemini_api_key
    if top_p is not None:
        init_kwargs["top_p"] = top_p
    if top_k is not None:
        init_kwargs["top_k"] = top_k
    return init_chat_model(**init_kwargs)


def build_model_from_settings(effective: EffectiveChatSettings, **kwargs: Any):
    """Build a chat model from DB-over-env resolved settings."""
    return build_model(
        model_name=effective.model_name,
        temperature=effective.temperature,
        max_tokens=effective.max_token,
        top_p=effective.top_p,
        top_k=effective.top_k,
        **kwargs,
    )
