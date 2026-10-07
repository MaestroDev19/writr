"""Per-user chat params: nullable DB columns overlaid on env ``Settings``.

``get_settings()`` stays process-wide (env only). Inject
``EffectiveChatSettingsDep`` when a route needs the authenticated user's
overrides. NULL / missing columns fall back to ``Settings`` defaults.

Overridable columns only:
  model_name, temperature, k, max_token, top_p, top_k
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field
from supabase import AsyncClient

from core.config import Settings, get_settings
from services.supabase import AsyncServiceSupabaseDep, CurrentUserIdDep
from utils.log import bind, scrub

USER_SETTINGS_TABLE = "user_settings"

# DB columns that may override env defaults when non-NULL.
_OVERRIDE_FIELDS = (
    "model_name",
    "temperature",
    "k",
    "max_token",
    "top_p",
    "top_k",
)


class EffectiveChatSettings(BaseModel):
    """Resolved chat params for one request: DB value if set, else env default."""

    user_id: str
    model_name: str
    temperature: float
    k: int = Field(ge=1)
    max_token: int = Field(ge=1)
    top_p: float | None = None
    top_k: int | None = None
    from_db: bool = False


def _pick(db_value: Any, default: Any) -> Any:
    return default if db_value is None else db_value


def merge_user_settings_row(
    user_id: str,
    row: dict[str, Any] | None,
    defaults: Settings | None = None,
) -> EffectiveChatSettings:
    """Merge one ``user_settings`` row onto env defaults (no I/O)."""
    settings = defaults or get_settings()
    data = row or {}
    return EffectiveChatSettings(
        user_id=user_id,
        from_db=row is not None,
        model_name=_pick(data.get("model_name"), settings.model_name),
        temperature=_pick(data.get("temperature"), settings.temperature),
        k=_pick(data.get("k"), settings.k),
        max_token=_pick(data.get("max_token"), settings.max_token),
        top_p=_pick(data.get("top_p"), settings.top_p),
        top_k=_pick(data.get("top_k"), settings.top_k),
    )


async def fetch_user_settings_row(
    supabase: AsyncClient,
    user_id: str,
) -> dict[str, Any] | None:
    """Return the user's settings row, or ``None`` if they have never saved."""
    cols = ",".join(("user_id", *_OVERRIDE_FIELDS))
    result = await (
        supabase.table(USER_SETTINGS_TABLE)
        .select(cols)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


async def resolve_effective_chat_settings(
    user_id: str,
    supabase: AsyncClient,
    defaults: Settings | None = None,
) -> EffectiveChatSettings:
    """Load ``user_settings`` and overlay non-null columns onto env defaults."""
    bind(operation="resolve_effective_chat_settings", user_id=user_id)
    settings = defaults or get_settings()

    try:
        row = await fetch_user_settings_row(supabase, user_id)
    except APIError as exc:
        bind(
            user_id=user_id,
            db_code=exc.code,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        return merge_user_settings_row(user_id, None, settings)
    except Exception as exc:
        bind(
            user_id=user_id,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        return merge_user_settings_row(user_id, None, settings)

    effective = merge_user_settings_row(user_id, row, settings)
    bind(
        user_id=user_id,
        from_db=effective.from_db,
        model_name=effective.model_name,
        outcome="success",
    )
    return effective


async def get_effective_chat_settings(
    user_id: CurrentUserIdDep,
    supabase: AsyncServiceSupabaseDep,
) -> EffectiveChatSettings:
    """FastAPI dependency: authenticated user's effective chat settings."""
    return await resolve_effective_chat_settings(user_id, supabase)


EffectiveChatSettingsDep = Annotated[
    EffectiveChatSettings,
    Depends(get_effective_chat_settings),
]

__all__ = [
    "USER_SETTINGS_TABLE",
    "EffectiveChatSettings",
    "EffectiveChatSettingsDep",
    "fetch_user_settings_row",
    "get_effective_chat_settings",
    "merge_user_settings_row",
    "resolve_effective_chat_settings",
]
