"""Per-user settings.

``GET /mySetting`` reads the shared model plus both workflows.
``POST /mySetting/generate`` writes Write settings.
``POST /mySetting/critique`` writes Review settings.

The caller's JWT is forwarded so Row Level Security applies. ``user_id`` is
taken from that token, never from the body.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, status
from postgrest.exceptions import APIError
from pydantic import BaseModel, Field

from core.user_settings import (
    ALLOWED_MODEL_NAMES,
    WORKFLOW_FIELDS,
    WorkflowName,
    settings_columns,
    workflow_column,
)
from services.supabase import AsyncUserSupabaseDep, CurrentUserIdDep
from utils.log import bind, scrub

MySettingRouter = APIRouter(prefix="/mySetting", tags=["mySetting"])

_SELECT = "id,user_id,updated_at," + ",".join(settings_columns())
ModelName = Literal[
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
]


class WorkflowSetting(BaseModel):
    """One workflow's prompt and inference controls. Omitted fields stay unchanged."""

    system_prompt: str | None = Field(default=None, max_length=8000)
    temperature: float | None = Field(default=None, ge=0, le=1.5)
    max_tokens: int | None = Field(default=None, ge=256, le=4096)
    top_p: float | None = Field(default=None, ge=0.1, le=1)
    frequency_penalty: float | None = Field(default=None, ge=1, le=1.5)
    context_chunks: int | None = Field(default=None, ge=1, le=10)


class WorkflowSettingUpdate(WorkflowSetting):
    """Workflow fields plus the shared model, which either endpoint may set."""

    model_name: ModelName | None = None


class WorkflowSettingOut(WorkflowSetting):
    model_name: str | None = None


class MySettings(BaseModel):
    user_id: str
    model_name: str | None = None
    generate: WorkflowSetting
    critique: WorkflowSetting
    updated_at: str | None = None


def _workflow_from_row(row: dict[str, Any], workflow: WorkflowName) -> WorkflowSetting:
    return WorkflowSetting(
        **{field: row.get(workflow_column(workflow, field)) for field in WORKFLOW_FIELDS}
    )


def _settings_from_row(row: dict[str, Any]) -> MySettings:
    updated = row.get("updated_at")
    return MySettings(
        user_id=str(row["user_id"]),
        model_name=row.get("model_name"),
        generate=_workflow_from_row(row, "generate"),
        critique=_workflow_from_row(row, "critique"),
        updated_at=None if updated is None else str(updated),
    )


def _empty_settings(user_id: str) -> MySettings:
    return MySettings(
        user_id=user_id,
        generate=WorkflowSetting(),
        critique=WorkflowSetting(),
    )


def _payload(workflow: WorkflowName, body: WorkflowSettingUpdate) -> dict[str, Any]:
    sent = body.model_dump(exclude_unset=True)
    payload: dict[str, Any] = {}
    if "model_name" in sent:
        payload["model_name"] = sent["model_name"]
    for field in WORKFLOW_FIELDS:
        if field in sent:
            payload[workflow_column(workflow, field)] = sent[field]
    return payload


async def _upsert(
    supabase: AsyncUserSupabaseDep,
    user_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    payload["user_id"] = user_id
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = await (
            supabase.table("user_settings")
            .upsert(payload, on_conflict="user_id")
            .select(_SELECT)
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
    return result.data[0]


async def _save_workflow(
    workflow: WorkflowName,
    body: WorkflowSettingUpdate,
    user_id: str,
    supabase: AsyncUserSupabaseDep,
) -> WorkflowSettingOut:
    bind(operation=f"update_my_setting_{workflow}", user_id=user_id)
    payload = _payload(workflow, body)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one setting field to update.",
        )
    row = await _upsert(supabase, user_id, payload)
    bind(user_id=user_id, settings_id=row.get("id"), outcome="success")
    saved = _workflow_from_row(row, workflow)
    return WorkflowSettingOut(model_name=row.get("model_name"), **saved.model_dump())


@MySettingRouter.get("/", response_model=MySettings)
async def get_my_setting(
    user_id: CurrentUserIdDep,
    supabase: AsyncUserSupabaseDep,
) -> MySettings:
    """Return this user's settings. Missing row yields empty fields, not an insert."""
    bind(operation="get_my_setting", user_id=user_id)
    try:
        result = await (
            supabase.table("user_settings")
            .select(_SELECT)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        bind(
            user_id=user_id,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load settings.",
        ) from exc

    rows = result.data or []
    if not rows:
        bind(user_id=user_id, outcome="empty")
        return _empty_settings(user_id)
    bind(user_id=user_id, outcome="success")
    return _settings_from_row(rows[0])


@MySettingRouter.post(
    "/generate",
    status_code=status.HTTP_200_OK,
    response_model=WorkflowSettingOut,
)
async def update_generate_setting(
    body: WorkflowSettingUpdate,
    user_id: CurrentUserIdDep,
    supabase: AsyncUserSupabaseDep,
) -> WorkflowSettingOut:
    """Upsert Write settings. Omitted fields on an existing row are left as-is."""
    return await _save_workflow("generate", body, user_id, supabase)


@MySettingRouter.post(
    "/critique",
    status_code=status.HTTP_200_OK,
    response_model=WorkflowSettingOut,
)
async def update_critique_setting(
    body: WorkflowSettingUpdate,
    user_id: CurrentUserIdDep,
    supabase: AsyncUserSupabaseDep,
) -> WorkflowSettingOut:
    """Upsert Review settings. Omitted fields on an existing row are left as-is."""
    return await _save_workflow("critique", body, user_id, supabase)


# Keep the tuple import used so a typo in the Literal fails a quick equality check.
assert set(ALLOWED_MODEL_NAMES) == set(ModelName.__args__)
