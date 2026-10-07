"""App-hosted Gemini chat model + optional per-user overrides from DB."""

from __future__ import annotations

from typing import Any

from langchain.chat_models import init_chat_model
from supabase import AsyncClient

from core.config import get_settings

_OVERRIDE_COLS = "model_name,temperature,k,max_token,top_p,top_k"


def _pick(row: dict[str, Any] | None, key: str, default: Any) -> Any:
    if not row:
        return default
    value = row.get(key)
    return default if value is None else value


async def load_user_overrides(supabase: AsyncClient, user_id: str) -> dict[str, Any]:
    """Fetch the user's ``user_settings`` row, or ``{}`` if none / on error."""
    try:
        result = await (
            supabase.table("user_settings")
            .select(_OVERRIDE_COLS)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        return rows[0] if rows else {}
    except Exception:
        return {}


def build_model(
    overrides: dict[str, Any] | None = None,
    **kwargs: Any,
):
    """Build Gemini chat model. ``overrides`` null fields fall back to env defaults."""
    s = get_settings()
    row = overrides or {}

    init_kwargs: dict[str, Any] = {
        "model": _pick(row, "model_name", s.model_name),
        "model_provider": "google_genai",
        "temperature": _pick(row, "temperature", s.temperature),
        "max_tokens": _pick(row, "max_token", s.max_token),
        **kwargs,
    }
    if s.gemini_api_key:
        init_kwargs["api_key"] = s.gemini_api_key

    top_p = _pick(row, "top_p", s.top_p)
    top_k = _pick(row, "top_k", s.top_k)
    if top_p is not None:
        init_kwargs["top_p"] = top_p
    if top_k is not None:
        init_kwargs["top_k"] = top_k

    return init_chat_model(**init_kwargs)


async def build_model_for_user(
    supabase: AsyncClient,
    user_id: str,
    **kwargs: Any,
):
    """Load DB overrides for ``user_id`` (if any), then build the chat model."""
    return build_model(await load_user_overrides(supabase, user_id), **kwargs)


def resolved_k(overrides: dict[str, Any] | None = None) -> int:
    """Retriever ``k``: DB value if set, else env default."""
    return int(_pick(overrides, "k", get_settings().k))
