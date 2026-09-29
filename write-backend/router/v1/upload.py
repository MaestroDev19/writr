"""Upload routes: enqueue reference text for background embedding."""

import hashlib
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.limiter import limiter
from services.connector import ConnectorDep
from services.queue import ActiveGenerationError
from services.supabase import CurrentUserIdDep
from utils.log import bind, scrub


class EnqueuedJob(BaseModel):
    job_id: str
    status: str


class ActiveGenerationConflict(BaseModel):
    message: str
    job_id: str
    status: str


def _conflict_body(exc: ActiveGenerationError) -> ActiveGenerationConflict:
    job = exc.job
    return ActiveGenerationConflict(
        message="A generation is already in progress for this account.",
        job_id=str(job.get("id") or ""),
        status=str(job.get("status") or ""),
    )


async def active_generation_handler(
    request: Request, exc: ActiveGenerationError
) -> JSONResponse:
    """409 when this owner already has a queued or running job. No new row."""
    body = _conflict_body(exc)
    bind(
        job_id=body.job_id,
        job_status=body.status,
        queue_result="busy",
        outcome="rejected",
    )
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content=body.model_dump(),
    )


UploadRouter = APIRouter(prefix="/v1", tags=["upload"])


@UploadRouter.post(
    "/text",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EnqueuedJob,
    responses={
        status.HTTP_409_CONFLICT: {
            "model": ActiveGenerationConflict,
            "description": "This owner already has a queued or running generation.",
        }
    },
)
@limiter.limit("20/minute")
async def upload_text(
    request: Request,
    user_id: CurrentUserIdDep,
    connector: ConnectorDep,
    text: Annotated[str, Form(min_length=1)],
) -> EnqueuedJob:
    """Accept pasted text and enqueue an embed job (202 + job id).

    A second call is refused while this owner still has a queued or running job.
    """
    encoded = text.encode("utf-8")
    content_sha256 = hashlib.sha256(encoded).hexdigest()
    bind(
        operation="upload_text",
        user_id=user_id,
        content_sha256=content_sha256,
        content_bytes=len(encoded),
        source_type="text",
        job_type="embed_document",
    )
    try:
        job = await connector.enqueue_text(text, user_id)
    except ActiveGenerationError:
        raise
    except Exception as exc:
        bind(
            user_id=user_id,
            content_sha256=content_sha256,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not queue text for processing.",
        ) from exc
    bind(
        job_id=job.get("id"),
        job_status=job.get("status"),
        user_id=user_id,
    )
    return EnqueuedJob(job_id=str(job.get("id") or ""), status=str(job.get("status") or ""))
