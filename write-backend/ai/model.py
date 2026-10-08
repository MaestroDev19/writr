"""App-hosted Gemini chat model + optional per-user overrides from DB."""

from __future__ import annotations

from typing import Any

from langchain.chat_models import init_chat_model
from supabase import AsyncClient

from core.config import get_settings
from core.user_settings import WorkflowName, settings_columns, workflow_column

_OVERRIDE_COLS = ",".join(settings_columns())


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
    *,
    workflow: WorkflowName = "generate",
    **kwargs: Any,
):
    """Build Gemini chat model for ``workflow``. Null columns fall back to env defaults."""
    s = get_settings()
    row = overrides or {}

    init_kwargs: dict[str, Any] = {
        "model": _pick(row, "model_name", s.model_name),
        "model_provider": "google_genai",
        "temperature": _pick(row, workflow_column(workflow, "temperature"), s.temperature),
        "max_tokens": _pick(row, workflow_column(workflow, "max_tokens"), s.max_token),
        **kwargs,
    }
    if s.gemini_api_key:
        init_kwargs["api_key"] = s.gemini_api_key

    top_p = _pick(row, workflow_column(workflow, "top_p"), s.top_p)
    if top_p is not None:
        init_kwargs["top_p"] = top_p
    if s.top_k is not None:
        init_kwargs["top_k"] = s.top_k

    return init_chat_model(**init_kwargs)


async def build_model_for_user(
    supabase: AsyncClient,
    user_id: str,
    *,
    workflow: WorkflowName = "generate",
    **kwargs: Any,
):
    """Load DB overrides for ``user_id`` (if any), then build the chat model."""
    return build_model(
        await load_user_overrides(supabase, user_id),
        workflow=workflow,
        **kwargs,
    )


def resolved_context_chunks(
    overrides: dict[str, Any] | None = None,
    workflow: WorkflowName = "generate",
) -> int:
    """Notes retrieved for ``workflow``: DB value if set, else env default."""
    row = overrides or {}
    return int(_pick(row, workflow_column(workflow, "context_chunks"), get_settings().k))


def resolved_system_prompt(
    overrides: dict[str, Any] | None = None,
    workflow: WorkflowName = "generate",
) -> str | None:
    """User system prompt for ``workflow``, or ``None`` when unset."""
    row = overrides or {}
    value = row.get(workflow_column(workflow, "system_prompt"))
    return value if isinstance(value, str) and value else None


def resolved_frequency_penalty(
    overrides: dict[str, Any] | None = None,
    workflow: WorkflowName = "generate",
) -> float | None:
    """Repetition penalty for ``workflow``, or ``None`` when unset."""
    row = overrides or {}
    value = row.get(workflow_column(workflow, "frequency_penalty"))
    return None if value is None else float(value)


def resolved_k(
    overrides: dict[str, Any] | None = None,
    workflow: WorkflowName = "generate",
) -> int:
    """Alias of ``resolved_context_chunks``."""
    return resolved_context_chunks(overrides, workflow)


def build_default_model(
    overrides: dict[str, Any] | None = None,
    **kwargs: Any,
):
    """Gemini client for the shared RagLine.

    The user contributes ``model_name`` only. Temperature and the other
    sampling fields stay on the env defaults; Write and Review agents use
    ``build_model`` for their own workflow settings.
    """
    s = get_settings()
    row = overrides or {}
    init_kwargs: dict[str, Any] = {
        "model": _pick(row, "model_name", s.model_name),
        "model_provider": "google_genai",
        "temperature": s.temperature,
        "max_tokens": s.max_token,
        **kwargs,
    }
    if s.gemini_api_key:
        init_kwargs["api_key"] = s.gemini_api_key
    if s.top_p is not None:
        init_kwargs["top_p"] = s.top_p
    if s.top_k is not None:
        init_kwargs["top_k"] = s.top_k
    return init_chat_model(**init_kwargs)


