"""Column layout for ``public.user_settings``.

One row per user. ``model_name`` is shared. Write (``generate_*``) and Review
(``critique_*``) each have their own prompt and inference columns, matching
the Settings form.
"""

from __future__ import annotations

from typing import Literal

WorkflowName = Literal["generate", "critique"]

WORKFLOWS: tuple[WorkflowName, ...] = ("generate", "critique")

# Frontend allow-list: write/src/lib/model-providers.ts GEMINI_FREE_MODELS.
ALLOWED_MODEL_NAMES: tuple[str, ...] = (
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
)

WORKFLOW_FIELDS: tuple[str, ...] = (
    "system_prompt",
    "temperature",
    "max_tokens",
    "top_p",
    "frequency_penalty",
    "context_chunks",
)


def workflow_column(workflow: WorkflowName, field: str) -> str:
    return f"{workflow}_{field}"


def settings_columns() -> tuple[str, ...]:
    return (
        "model_name",
        *(workflow_column(workflow, field) for workflow in WORKFLOWS for field in WORKFLOW_FIELDS),
    )
