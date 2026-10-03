"""Upload routes: enqueue reference sources for background embedding."""

from __future__ import annotations

import base64
import hashlib
from pathlib import Path
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.limiter import limiter
from services.connector import ConnectorDep
from services.doc_loader import SUPPORTED_EXTENSIONS
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


def _enqueued(job: dict) -> EnqueuedJob:
    return EnqueuedJob(
        job_id=str(job.get("id") or ""),
        status=str(job.get("status") or ""),
    )


def _queue_http_error(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=detail,
    )


def _require_supported_filename(filename: str | None) -> str:
    name = (filename or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must include a filename.",
        )
    suffix = Path(name).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {suffix or '(none)'}. Supported: {supported}",
        )
    return Path(name).name


async def _read_upload(file: UploadFile) -> tuple[str, bytes, str]:
    """Return (safe_filename, raw_bytes, content_sha256)."""
    filename = _require_supported_filename(file.filename)
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Uploaded file is empty: {filename}",
        )
    digest = hashlib.sha256(data).hexdigest()
    return filename, data, digest


def _document_payload(filename: str, data: bytes) -> dict[str, str]:
    """Queue-safe upload dict; bytes are base64 so JSON storage stays valid."""
    return {
        "filename": filename,
        "data": base64.b64encode(data).decode("ascii"),
    }


def _normalize_http_url(url: str) -> str:
    cleaned = url.strip()
    parsed = urlparse(cleaned)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must be an absolute http(s) link.",
        )
    return cleaned


UploadRouter = APIRouter(prefix="/upload", tags=["upload"])


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
        raise _queue_http_error("Could not queue text for processing.") from exc
    bind(
        job_id=job.get("id"),
        job_status=job.get("status"),
        user_id=user_id,
    )
    return _enqueued(job)


@UploadRouter.post(
    "/document",
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
async def upload_document(
    request: Request,
    user_id: CurrentUserIdDep,
    connector: ConnectorDep,
    file: Annotated[UploadFile, File(description="One PDF, DOCX, TXT, or MD file.")],
) -> EnqueuedJob:
    """Accept one uploaded file and enqueue an embed job (202 + job id)."""
    filename, data, content_sha256 = await _read_upload(file)
    bind(
        operation="upload_document",
        user_id=user_id,
        content_sha256=content_sha256,
        content_bytes=len(data),
        source_type="document",
        job_type="embed_document",
        mime_hint=Path(filename).suffix.lstrip("."),
    )
    document = _document_payload(filename, data)
    try:
        job = await connector.enqueue_document(document, user_id)
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
        raise _queue_http_error(
            "Could not queue document for processing."
        ) from exc
    bind(
        job_id=job.get("id"),
        job_status=job.get("status"),
        user_id=user_id,
    )
    return _enqueued(job)


@UploadRouter.post(
    "/documents",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EnqueuedJob,
    responses={
        status.HTTP_409_CONFLICT: {
            "model": ActiveGenerationConflict,
            "description": "This owner already has a queued or running generation.",
        }
    },
)
@limiter.limit("10/minute")
async def upload_documents(
    request: Request,
    user_id: CurrentUserIdDep,
    connector: ConnectorDep,
    files: Annotated[
        list[UploadFile],
        File(description="One or more PDF, DOCX, TXT, or MD files."),
    ],
) -> EnqueuedJob:
    """Accept multiple files and enqueue one batch embed job (202 + job id)."""
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one file is required.",
        )

    documents: list[dict[str, str]] = []
    total_bytes = 0
    digests: list[str] = []
    for upload in files:
        filename, data, content_sha256 = await _read_upload(upload)
        documents.append(_document_payload(filename, data))
        total_bytes += len(data)
        digests.append(content_sha256)

    batch_digest = hashlib.sha256("".join(digests).encode("utf-8")).hexdigest()
    bind(
        operation="upload_documents",
        user_id=user_id,
        content_sha256=batch_digest,
        content_bytes=total_bytes,
        document_count=len(documents),
        source_type="documents",
        job_type="embed_document",
    )
    try:
        job = await connector.enqueue_documents(documents, user_id)
    except ActiveGenerationError:
        raise
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        bind(
            user_id=user_id,
            content_sha256=batch_digest,
            document_count=len(documents),
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise _queue_http_error(
            "Could not queue documents for processing."
        ) from exc
    bind(
        job_id=job.get("id"),
        job_status=job.get("status"),
        user_id=user_id,
        document_count=len(documents),
    )
    return _enqueued(job)


@UploadRouter.post(
    "/link",
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
async def upload_link(
    request: Request,
    user_id: CurrentUserIdDep,
    connector: ConnectorDep,
    url: Annotated[str, Form(min_length=1)],
) -> EnqueuedJob:
    """Accept a public http(s) URL and enqueue a fetch+embed job (202 + job id)."""
    normalized = _normalize_http_url(url)
    content_sha256 = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    bind(
        operation="upload_link",
        user_id=user_id,
        content_sha256=content_sha256,
        content_bytes=len(normalized.encode("utf-8")),
        source_type="document_from_url",
        job_type="embed_document",
    )
    try:
        job = await connector.enqueue_document_from_url(normalized, user_id)
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
        raise _queue_http_error("Could not queue link for processing.") from exc
    bind(
        job_id=job.get("id"),
        job_status=job.get("status"),
        user_id=user_id,
    )
    return _enqueued(job)


@UploadRouter.get("/status", response_model=EnqueuedJob)
async def get_upload_status(
    request: Request,
    user_id: CurrentUserIdDep,
    connector: ConnectorDep,
    job_id: str,
) -> EnqueuedJob:
    """Get the status of an upload job."""
    job = await connector.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found.",
        )
    return _enqueued(job)