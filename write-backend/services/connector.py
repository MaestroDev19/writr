"""Composition root for reference-ingest services.

Routes inject ``ConnectorDep`` once and get doc loading, chunking,
embeddings, the job queue, and the vector store through one object.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import uuid
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends

from services.chunking import Chunker, ChunkerDep
from services.doc_loader import DocLoader, DocLoaderDep, DocLoaderError, LoadedDocument
from services.embeddings import EmbeddingError, EmbeddingService, EmbeddingServiceDep
from services.queue import ActiveGenerationError, Queue, QueueDep
from services.vetctor_store import (
    VectorStoreError,
    WritrVectorStore,
    WritrVectorStoreDep,
    embedding_status_enum,
)
from utils.log import bind, note, scrub
from utils.wide_event import wide_event_scope

_HEARTBEAT_INTERVAL_SECONDS = 30
# job_type is constrained in DB; payload.source_type chooses the handler.
_INGEST_JOB_TYPE = "embed_document"
_RATE_LIMIT_WAIT_SECONDS = 60.0
# Hard caps for the notes library (enforced at enqueue; table is source of truth).
MAX_REFERENCE_DOCUMENTS_PER_USER = 5
MAX_DOCUMENTS_PER_UPLOAD = 3


class DocumentLimitError(Exception):
    """Owner would exceed the notes-library capacity. Nothing was inserted."""

    def __init__(self, message: str, *, current: int, incoming: int, limit: int) -> None:
        self.current = current
        self.incoming = incoming
        self.limit = limit
        super().__init__(message)


@asynccontextmanager
async def heartbeat(
    queue: Queue,
    job_id: str,
    worker_id: str,
    *,
    interval_seconds: float = _HEARTBEAT_INTERVAL_SECONDS,
) -> AsyncIterator[None]:
    """Keep ``locked_at`` fresh while the job body runs so cron does not reclaim it."""

    async def _pulse() -> None:
        while True:
            await asyncio.sleep(interval_seconds)
            owned = await queue.heartbeat(job_id=job_id, worker_id=worker_id)
            if not owned:
                bind(
                    job_id=job_id,
                    worker_id=worker_id,
                    lost_lock_job_id=job_id,
                    error_type="JobLockLost",
                )
                return

    task = asyncio.create_task(_pulse())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


def _decode_document_bytes(data: Any) -> bytes:
    """Decode queue payloads that store uploads as base64 strings."""
    if isinstance(data, bytes):
        return data
    if isinstance(data, str):
        return base64.b64decode(data)
    raise DocLoaderError("document data must be bytes or a base64 string")


def _is_rate_limited(error: Exception) -> bool:
    message = str(error).lower()
    return any(
        token in message
        for token in ("429", "rate limit", "quota", "too many requests")
    )


class Connector:
    """Façade over ingest/retrieve services used by routes and the worker."""

    def __init__(
        self,
        doc_loader: DocLoader,
        chunker: Chunker,
        embedding_service: EmbeddingService,
        queue: Queue,
        writr_vector_store: WritrVectorStore,
    ) -> None:
        self.doc_loader = doc_loader
        self.chunker = chunker
        self.embedding_service = embedding_service
        self.queue = queue
        self.writr_vector_store = writr_vector_store

    async def get_job(self, job_id: str, owner_id: str) -> dict | None:
        return await self.queue.get_job(job_id, owner_id)

    async def find_active_job(self, owner_id: str) -> dict | None:
        """In-flight embed job for this owner, if any."""
        return await self.queue.find_active_job(owner_id)

    async def list_reference_documents(self, owner_id: str) -> list[dict]:
        return await self.writr_vector_store.list_reference_documents(owner_id=owner_id)

    async def count_reference_documents(self, owner_id: str) -> int:
        return await self.writr_vector_store.count_reference_documents(owner_id=owner_id)

    async def delete_reference_document(self, document_id: str, owner_id: str) -> bool:
        return await self.writr_vector_store.delete_reference_document(
            document_id=document_id,
            owner_id=owner_id,
            raise_on_error=True,
        )

    async def _require_idle_owner(self, owner_id: str) -> None:
        """Stop before enqueue when this owner already has a queued or running job."""
        active = await self.queue.find_active_job(owner_id)
        if active is None:
            return
        bind(
            user_id=owner_id,
            job_id=active.get("id"),
            job_status=active.get("status"),
            queue_result="busy",
        )
        raise ActiveGenerationError(active)

    async def _require_document_capacity(
        self, owner_id: str, *, incoming: int
    ) -> None:
        """Refuse enqueue when ``reference_documents`` would exceed the per-user cap."""
        if incoming < 1:
            raise ValueError("incoming document count must be at least 1")
        current = await self.count_reference_documents(owner_id)
        limit = MAX_REFERENCE_DOCUMENTS_PER_USER
        if current + incoming > limit:
            remaining = max(0, limit - current)
            bind(
                user_id=owner_id,
                document_count=current,
                incoming_count=incoming,
                document_limit=limit,
                queue_result="capacity",
            )
            raise DocumentLimitError(
                (
                    f"Notes library is full ({current}/{limit}). "
                    f"You can add {remaining} more."
                    if remaining
                    else f"Notes library is full ({current}/{limit}). Remove a note to add another."
                ),
                current=current,
                incoming=incoming,
                limit=limit,
            )

    async def enqueue_text(self, text: str, owner_id: str) -> dict:
        await self._require_idle_owner(owner_id)
        await self._require_document_capacity(owner_id, incoming=1)
        return await self.queue.enqueue(
            job_type=_INGEST_JOB_TYPE,
            payload={"text": text, "source_type": "text"},
            owner_id=owner_id,
        )

    async def enqueue_document(self, document: Any, owner_id: str) -> dict:
        await self._require_idle_owner(owner_id)
        await self._require_document_capacity(owner_id, incoming=1)
        return await self.queue.enqueue(
            job_type=_INGEST_JOB_TYPE,
            payload={"document": document, "source_type": "document"},
            owner_id=owner_id,
        )

    async def enqueue_documents(
        self, documents: Sequence[Any], owner_id: str
    ) -> dict:
        """Queue one job for the whole batch. One owner, one in-flight generation."""
        if not documents:
            raise ValueError("documents list is empty")
        if len(documents) > MAX_DOCUMENTS_PER_UPLOAD:
            raise ValueError(
                f"You can upload at most {MAX_DOCUMENTS_PER_UPLOAD} files at a time."
            )

        await self._require_idle_owner(owner_id)
        await self._require_document_capacity(owner_id, incoming=len(documents))
        bind(user_id=owner_id, document_count=len(documents))
        return await self.queue.enqueue(
            job_type=_INGEST_JOB_TYPE,
            payload={"documents": list(documents), "source_type": "documents"},
            owner_id=owner_id,
        )

    async def enqueue_document_from_url(self, url: str, owner_id: str) -> dict:
        await self._require_idle_owner(owner_id)
        await self._require_document_capacity(owner_id, incoming=1)
        return await self.queue.enqueue(
            job_type=_INGEST_JOB_TYPE,
            payload={"url": url, "source_type": "document_from_url"},
            owner_id=owner_id,
        )

    async def _load_document(self, document: Any) -> LoadedDocument:
        """Load one queued document: filesystem path or ``{filename, data}`` upload."""
        if isinstance(document, (str, Path)):
            return await asyncio.to_thread(self.doc_loader.load, document)

        if isinstance(document, dict):
            filename = document.get("filename")
            raw = document.get("data")
            if raw is None:
                raw = document.get("content")
            if not filename or raw is None:
                raise DocLoaderError("document payload requires filename and data")
            return await self.doc_loader.aload_bytes(
                _decode_document_bytes(raw), filename=str(filename)
            )

        raise DocLoaderError(
            f"Unsupported document payload type: {type(document).__name__}"
        )

    async def _store_loaded(
        self, loaded: LoadedDocument, *, owner_id: str, default_name: str
    ) -> None:
        encoded = loaded.text.encode("utf-8")
        bind(
            user_id=owner_id,
            content_bytes=len(encoded),
            content_sha256=hashlib.sha256(encoded).hexdigest(),
            mime_hint=loaded.metadata.get("mime_hint"),
        )
        name = loaded.metadata.get("filename") or default_name
        chunks = self.chunker.chunk(loaded.text, doc_name=name)
        bind(chunk_count=len(chunks), user_id=owner_id)
        await self.writr_vector_store.add_documents(
            chunks, name=name, owner_id=owner_id
        )

    async def error_and_retry_handler(
        self,
        job_id: str,
        owner_id: str,
        worker_id: str,
        *,
        error: str,
        wait_seconds: float | None = None,
        document_id: str | None = None,
    ) -> bool:
        """Soft fail: drop partial note stub, optionally wait, then requeue.

        Use for transient errors (rate limits, temporary store failures).
        """
        if document_id:
            # CASCADE removes orphan chunks; the next claim creates a fresh parent.
            await self.writr_vector_store.delete_reference_document(
                document_id=document_id,
                owner_id=owner_id,
                raise_on_error=False,
            )

        if wait_seconds and wait_seconds > 0:
            await asyncio.sleep(wait_seconds)

        ok = await self.queue.fail_job(
            job_id=job_id,
            worker_id=worker_id,
            error=error,
            retry=True,
        )
        bind(
            job_id=job_id,
            user_id=owner_id,
            worker_id=worker_id,
            document_id=document_id,
            error_message=scrub(error),
            outcome="error",
        )
        return ok

    async def failed_job_handler(
        self,
        job_id: str,
        owner_id: str,
        worker_id: str,
        *,
        error: str,
        document_id: str | None = None,
    ) -> bool:
        """Hard fail: keep the note (status=failed) for the UI; mark the job dead."""
        if document_id:
            await self.writr_vector_store._set_embedding_status(
                document_id=document_id,
                status=embedding_status_enum["failed"],
                owner_id=owner_id,
                raise_on_error=False,
            )

        ok = await self.queue.fail_job(
            job_id=job_id,
            worker_id=worker_id,
            error=error,
            retry=False,
        )
        bind(
            job_id=job_id,
            user_id=owner_id,
            worker_id=worker_id,
            document_id=document_id,
            error_message=scrub(error),
            outcome="error",
        )
        return ok

    async def _handle_ingest_error(
        self,
        exc: BaseException,
        *,
        job_id: str,
        owner_id: str,
        worker_id: str,
    ) -> bool:
        """Choose hard vs soft failure based on error type and whether a parent exists."""
        document_id = getattr(exc, "document_id", None)
        if isinstance(exc, DocLoaderError):
            failure_stage = "load"
        elif isinstance(exc, EmbeddingError):
            failure_stage = "embed"
        elif isinstance(exc, VectorStoreError):
            failure_stage = "store"
        else:
            failure_stage = "ingest"
        bind(
            job_id=job_id,
            user_id=owner_id,
            worker_id=worker_id,
            document_id=document_id if isinstance(document_id, str) else None,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            failure_stage=failure_stage,
            rate_limited=isinstance(exc, Exception) and _is_rate_limited(exc),
            outcome="error",
        )
        if isinstance(exc, DocLoaderError):
            return await self.failed_job_handler(
                job_id, owner_id, worker_id, error=str(exc)
            )

        if isinstance(exc, EmbeddingError):
            wait = _RATE_LIMIT_WAIT_SECONDS if _is_rate_limited(exc) else None
            return await self.error_and_retry_handler(
                job_id,
                owner_id,
                worker_id,
                error=str(exc),
                wait_seconds=wait,
            )

        if isinstance(exc, VectorStoreError):
            # No parent yet and not rate-limited → permanent validation/create failure.
            if exc.document_id is None and not _is_rate_limited(exc):
                return await self.failed_job_handler(
                    job_id, owner_id, worker_id, error=str(exc)
                )
            wait = _RATE_LIMIT_WAIT_SECONDS if _is_rate_limited(exc) else None
            return await self.error_and_retry_handler(
                job_id,
                owner_id,
                worker_id,
                error=str(exc),
                wait_seconds=wait,
                document_id=exc.document_id,
            )

        return await self.error_and_retry_handler(
            job_id,
            owner_id,
            worker_id,
            error=str(exc),
            document_id=document_id if isinstance(document_id, str) else None,
        )

    async def load_and_process_document(
        self, document: Any, owner_id: str, job_id: str, worker_id: str
    ) -> bool:
        try:
            async with heartbeat(self.queue, job_id, worker_id):
                loaded = await self._load_document(document)
                await self._store_loaded(
                    loaded,
                    owner_id=owner_id,
                    default_name=f"untitled document {uuid.uuid4()}",
                )
            return await self.queue.complete_job(job_id=job_id, worker_id=worker_id)
        except Exception as e:
            return await self._handle_ingest_error(
                e,
                job_id=job_id,
                owner_id=owner_id,
                worker_id=worker_id,
            )

    async def split_documents_job(
        self,
        documents: Sequence[Any],
        owner_id: str,
        job_id: str,
        worker_id: str,
    ) -> bool:
        """Legacy batch payload: ingest every file on this row.

        A second job would be refused while this one is running, so the batch
        stays on the generation the owner already has.
        """
        try:
            if not documents:
                raise DocLoaderError("documents list is empty")
            async with heartbeat(self.queue, job_id, worker_id):
                for index, document in enumerate(documents):
                    loaded = await self._load_document(document)
                    await self._store_loaded(
                        loaded,
                        owner_id=owner_id,
                        default_name=f"untitled document {index} {uuid.uuid4()}",
                    )
            return await self.queue.complete_job(job_id=job_id, worker_id=worker_id)
        except Exception as e:
            return await self._handle_ingest_error(
                e,
                job_id=job_id,
                owner_id=owner_id,
                worker_id=worker_id,
            )

    async def load_and_process_document_from_url(
        self, url: str, owner_id: str, job_id: str, worker_id: str
    ) -> bool:
        try:
            async with heartbeat(self.queue, job_id, worker_id):
                loaded = await self.doc_loader.load_url_async(url)
                await self._store_loaded(
                    loaded,
                    owner_id=owner_id,
                    default_name=f"untitled url {uuid.uuid4()}",
                )
            return await self.queue.complete_job(job_id=job_id, worker_id=worker_id)
        except Exception as e:
            return await self._handle_ingest_error(
                e,
                job_id=job_id,
                owner_id=owner_id,
                worker_id=worker_id,
            )

    async def load_and_process_text(
        self, text: str, owner_id: str, job_id: str, worker_id: str
    ) -> bool:
        try:
            async with heartbeat(self.queue, job_id, worker_id):
                loaded = await asyncio.to_thread(self.doc_loader.load_text, text)
                await self._store_loaded(
                    loaded,
                    owner_id=owner_id,
                    default_name=f"untitled text {uuid.uuid4()}",
                )
            return await self.queue.complete_job(job_id=job_id, worker_id=worker_id)
        except Exception as e:
            return await self._handle_ingest_error(
                e,
                job_id=job_id,
                owner_id=owner_id,
                worker_id=worker_id,
            )

    async def run_next_job(self, worker_id: str) -> dict | None:
        try:
            job = await self.queue.claim_job(worker_id=worker_id)
        except Exception as exc:
            note(
                operation="claim_job",
                worker_id=worker_id,
                outcome="error",
                error_type=type(exc).__name__,
                error_message=scrub(str(exc)),
                queue_result="claim_failed",
            )
            return None
        if job is None:
            return None
        job_id = job["id"]
        payload = job["payload"] if isinstance(job.get("payload"), dict) else {}
        owner_id = job["owner_id"]
        request_id = payload.get("request_id") or str(uuid.uuid4())
        source_type = payload.get("source_type")
        operation = {
            "text": "process_text",
            "document": "process_document",
            "document_from_url": "process_url",
            "documents": "split_documents",
            " collection of documents": "split_documents",
        }.get(str(source_type), "process_unknown")
        try:
            with wide_event_scope(
                operation=operation,
                request_id=str(request_id),
                job_id=str(job_id),
                user_id=str(owner_id) if owner_id else None,
                worker_id=worker_id,
                job_status=job.get("status"),
                attempts=job.get("attempts"),
                job_type=job.get("job_type"),
                source_type=str(source_type) if source_type else None,
            ):
                if source_type == "text":
                    await self.load_and_process_text(
                        text=payload["text"],
                        owner_id=owner_id,
                        job_id=job_id,
                        worker_id=worker_id,
                    )
                elif source_type == "document":
                    await self.load_and_process_document(
                        document=payload["document"],
                        owner_id=owner_id,
                        job_id=job_id,
                        worker_id=worker_id,
                    )
                elif source_type in {"documents", " collection of documents"}:
                    # One row per owner while work is in flight, so the batch stays on this job.
                    await self.split_documents_job(
                        documents=payload["documents"],
                        owner_id=owner_id,
                        job_id=job_id,
                        worker_id=worker_id,
                    )
                elif source_type == "document_from_url":
                    await self.load_and_process_document_from_url(
                        url=payload["url"],
                        owner_id=owner_id,
                        job_id=job_id,
                        worker_id=worker_id,
                    )
                else:
                    bind(
                        failure_stage="unknown_source",
                        error_type="UnknownSource",
                        error_message=scrub(f"unknown source_type: {source_type}"),
                        outcome="error",
                    )
                    await self.failed_job_handler(
                        job_id,
                        owner_id,
                        worker_id,
                        error=f"unknown source_type: {source_type}",
                    )
        except Exception:
            # The job scope already emitted this failure.
            return job
        return job


def get_connector(
    doc_loader: DocLoaderDep,
    chunker: ChunkerDep,
    embedding_service: EmbeddingServiceDep,
    queue: QueueDep,
    writr_vector_store: WritrVectorStoreDep,
) -> Connector:
    """FastAPI dependency: assemble Connector from existing service deps."""
    return Connector(
        doc_loader=doc_loader,
        chunker=chunker,
        embedding_service=embedding_service,
        queue=queue,
        writr_vector_store=writr_vector_store,
    )


ConnectorDep = Annotated[Connector, Depends(get_connector)]
