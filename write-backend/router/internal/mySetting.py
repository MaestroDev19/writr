"""User settings: create-or-update via upsert on ``user_id``."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, status
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from services.supabase import AsyncServiceSupabaseDep, CurrentUserIdDep
from utils.log import bind, scrub

MySettingRouter = APIRouter(prefix="/mySetting", tags=["mySetting"])

# Only these columns are writable; anything else is ignored.
_WRITABLE = (
    "model_name",
    "temperature",
    "k",
    "max_token",
    "top_p",
    "top_k",
)


class MySettingUpdate(BaseModel):
    """Partial settings. Send any subset; omitted fields stay as-is / null."""

    model_name: str | None = None
    temperature: float | None = Field(default=None, ge=0, le=2)
    k: int | None = Field(default=None, ge=1)
    max_token: int | None = Field(default=None, ge=1)
    top_p: float | None = Field(default=None, ge=0, le=1)
    top_k: int | None = Field(default=None, ge=0)


class MySetting(MySettingUpdate):
    user_id: str
    id: str | None = None
    updated_at: str | None = None


@MySettingRouter.post(
    "/",
    status_code=status.HTTP_200_OK,
    response_model=MySetting,
)
async def update_my_setting(
    body: MySettingUpdate,
    user_id: CurrentUserIdDep,
    supabase: AsyncServiceSupabaseDep,
) -> MySetting:
    """Insert on first save, or update existing row (upsert on ``user_id``)."""
    bind(operation="update_my_setting", user_id=user_id)

    payload: dict[str, Any] = {
        key: value
        for key, value in body.model_dump(exclude_unset=True).items()
        if key in _WRITABLE
    }
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one setting field to update.",
        )

    payload["user_id"] = user_id
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        result = await (
            supabase.table("user_settings")
            .upsert(payload, on_conflict="user_id")
            .select("id,user_id,updated_at," + ",".join(_WRITABLE))
            .execute()
        )
    except APIError as exc:
        bind(
            user_id=user_id,
            db_code=exc.code,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save settings.",
        ) from exc
    except Exception as exc:
        bind(
            user_id=user_id,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save settings.",
        ) from exc

    if not result.data:
        bind(user_id=user_id, error_type="SettingsUpsertEmpty", outcome="error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save settings.",
        )

    row = result.data[0]
    bind(user_id=user_id, settings_id=row.get("id"), outcome="success")
    return MySetting.model_validate(row)
