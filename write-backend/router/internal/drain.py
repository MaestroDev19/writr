"""Serverless job drain: claim and run queued background work.

On Vercel the long-lived worker loop is disabled (see ``main.lifespan``).
Vercel Cron hits ``GET /internal/drain-jobs`` with ``Authorization: Bearer
$CRON_SECRET`` so queued rows still get processed.
"""

from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.config import SettingsDep
from services.connector import ConnectorDep
from utils.log import bind
from utils.worker import drain_jobs, make_worker_id

DrainRouter = APIRouter(
    prefix="/internal",
    tags=["internal"],
    include_in_schema=False,
)


class DrainResponse(BaseModel):
    processed: int = Field(description="How many jobs this invoke claimed and ran.")
    job_ids: list[str] = Field(description="Ids of jobs touched in this invoke.")
    idle: bool = Field(description="True when the queue had nothing to claim.")
    worker_id: str = Field(description="Lock identity used for this drain invoke.")


async def require_cron_secret(
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    """Reject unless ``Authorization`` matches ``Bearer <CRON_SECRET>``."""
    secret = (settings.cron_secret or "").strip()
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CRON_SECRET is not configured.",
        )

    expected = f"Bearer {secret}"
    provided = authorization or ""
    # Length check avoids compare_digest ValueError on unequal strings; still 401.
    if len(provided) != len(expected) or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )


@DrainRouter.get(
    "/drain-jobs",
    status_code=status.HTTP_200_OK,
    response_model=DrainResponse,
    dependencies=[Depends(require_cron_secret)],
)
async def drain_queued_jobs(
    connector: ConnectorDep,
    limit: Annotated[
        int,
        Query(ge=1, le=5, description="Max jobs to claim and run in this invoke."),
    ] = 1,
) -> DrainResponse:
    """Claim and run up to ``limit`` queued jobs (Vercel Cron entrypoint)."""
    # Distinct id per invoke so a timed-out function cannot complete another claim.
    worker_id = f"cron:{make_worker_id()}"
    bind(
        operation="drain_jobs",
        worker_id=worker_id,
        queue_result="drain_start",
    )

    processed = await drain_jobs(connector, worker_id, max_jobs=limit)
    job_ids = [str(job.get("id") or "") for job in processed if job.get("id")]

    bind(
        worker_id=worker_id,
        child_job_ids=job_ids,
        queue_result="drained" if processed else "idle",
    )
    return DrainResponse(
        processed=len(processed),
        job_ids=job_ids,
        idle=not processed,
        worker_id=worker_id,
    )
