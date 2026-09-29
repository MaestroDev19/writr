"""Composition root for reference-ingest services.

Routes inject ``ConnectorDep`` once and get doc loading, chunking,
embeddings, the job queue, and the vector store through a single object.
"""

from __future__ import annotations

import asyncio
import base64
import uuid
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Any

from fastapi import Depends

from services.chunking import Chunker, ChunkerDep
from services.doc_loader import DocLoader, DocLoaderDep, DocLoaderError, LoadedDocument
from services.embeddings import EmbeddingError, EmbeddingService, EmbeddingServiceDep
from services.queue import Queue, QueueDep
from services.vetctor_store import (
    VectorStoreError,
    WritrVectorStore,
    WritrVectorStoreDep,
    embedding_status_enum,
)
from utils.log import logger

_HEARTBEAT_INTERVAL_SECONDS = 30
# background_jobs.job_type has a CHECK constraint; routing uses payload.source_type.
_INGEST_JOB_TYPE = "embed_document"
_RATE_LIMIT_WAIT_SECONDS = 60.0


@asynccontextmanager
async def heartbeat(
    queue: Queue,
    job_id: str,
    worker_id: str,
    *,
    interval_seconds: float = _HEARTBEAT_INTERVAL_SECONDS,
) -> AsyncIterator[None]:
    """Pulse ``queue.heartbeat`` while the job body runs so locks stay fresh."""

    async def _pulse() -> None:
        while True:
            await asyncio.sleep(interval_seconds)
            owned = await queue.heartbeat(job_id=job_id, worker_id=worker_id)
            if not owned:
                logger.warning(
                    "Lost job lock during heartbeat job_id=%s worker_id=%s",
                    job_id,
                    worker_id,
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
    """Accept raw bytes or a base64 string (JSON-safe queue payloads)."""
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


def _resolve_idempotency_key(idempotency_key: str | None) -> str:
    if idempotency_key and str(idempotency_key).strip():
        return str(idempotency_key).strip()
    return str(uuid.uuid4())


def _document_idempotency_suffix(document: Any, index: int) -> str:
    """Stable-ish per-file suffix for fan-out idempotency keys."""
    if isinstance(document, dict) and document.get("filename"):
        return f"{index}:{Path(str(document['filename'])).name}"
    if isinstance(document, (str, Path)):
        return f"{index}:{Path(document).name}"
    return str(index)


class Connector:
    """Façade over the services used to ingest and retrieve reference docs."""

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

    async def enqueue_text(
        self, text: str, owner_id: str, *, idempotency_key: str | None = None
    ) -> dict:
        return await self.queue.enqueue(
            job_type=_INGEST_JOB_TYPE,
            payload={"text": text, "source_type": "text"},
            owner_id=owner_id,
            idempotency_key=_resolve_idempotency_key(idempotency_key),
        )

    async def enqueue_document(
        self, document: Any, owner_id: str, *, idempotency_key: str | None = None
    ) -> dict:
        return await self.queue.enqueue(
            job_type=_INGEST_JOB_TYPE,
            payload={"document": document, "source_type": "document"},
            owner_id=owner_id,
            idempotency_key=_resolve_idempotency_key(idempotency_key),
        )

    async def enqueue_documents(
        self,
        documents: Sequence[Any],
        owner_id: str,
        *,
        idempotency_key: str | None = None,
    ) -> list[dict]:
        """Enqueue one job per file so retries never re-ingest completed siblings."""
        if not documents:
            raise ValueError("documents list is empty")

        base = _resolve_idempotency_key(idempotency_key)
        jobs: list[dict] = []
        for index, document in enumerate(documents):
            key = f"{base}:{_document_idempotency_suffix(document, index)}"
            jobs.append(
                await self.enqueue_document(
                    document, owner_id, idempotency_key=key
                )
            )
        logger.info(
            "Enqueued %s document job(s) owner_ref=%s base_key=%s",
            len(jobs),
            owner_id[:8] if owner_id else "-",
            base[:12],
        )
        return jobs

    async def enqueue_document_from_url(
        self, url: str, owner_id: str, *, idempotency_key: str | None = None
    ) -> dict:
        return await self.queue.enqueue(
            job_type=_INGEST_JOB_TYPE,
            payload={"url": url, "source_type": "document_from_url"},
            owner_id=owner_id,
            idempotency_key=_resolve_idempotency_key(idempotency_key),
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
        name = loaded.metadata.get("filename") or default_name
        chunks = self.chunker.chunk(loaded.text, doc_name=name)
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
        """Soft fail: drop partial note stub, optional wait, requeue."""
        if document_id:
            # CASCADE deletes any orphan chunks; next claim creates a fresh parent.
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
        logger.warning(
            "Retry scheduled job_id=%s owner_ref=%s doc_ref=%s ok=%s error=%s",
            job_id,
            owner_id[:8] if owner_id else "-",
            document_id[:8] if document_id else "-",
            ok,
            error[:200],
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
        """Hard fail: mark note failed (keep for UI), mark job dead."""
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
        logger.error(
            "Job dead job_id=%s owner_id=%s document_id=%s error=%s",
            job_id,
            owner_id,
            document_id,
            error[:200],
        )
        return ok

    async def _handle_ingest_error(
        self,
        exc: BaseException,
        *,
        job_id: str,
        owner_id: str,
        worker_id: str,
        context: str,
    ) -> bool:
        """Route load/store failures to hard vs soft handlers."""
        if isinstance(exc, DocLoaderError):
            logger.error("%s load failed job_id=%s: %s", context, job_id, exc)
            return await self.failed_job_handler(
                job_id, owner_id, worker_id, error=str(exc)
            )

        if isinstance(exc, EmbeddingError):
            wait = _RATE_LIMIT_WAIT_SECONDS if _is_rate_limited(exc) else None
            logger.exception("%s embedding failed job_id=%s", context, job_id)
            return await self.error_and_retry_handler(
                job_id,
                owner_id,
                worker_id,
                error=str(exc),
                wait_seconds=wait,
            )

        if isinstance(exc, VectorStoreError):
            # No parent yet → permanent validation / create failure.
            if exc.document_id is None and not _is_rate_limited(exc):
                logger.error("%s store failed job_id=%s: %s", context, job_id, exc)
                return await self.failed_job_handler(
                    job_id, owner_id, worker_id, error=str(exc)
                )
            wait = _RATE_LIMIT_WAIT_SECONDS if _is_rate_limited(exc) else None
            logger.exception("%s store failed job_id=%s", context, job_id)
            return await self.error_and_retry_handler(
                job_id,
                owner_id,
                worker_id,
                error=str(exc),
                wait_seconds=wait,
                document_id=exc.document_id,
            )

        logger.exception("%s ingest failed job_id=%s", context, job_id)
        document_id = getattr(exc, "document_id", None)
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
                context="Document",
            )

    async def split_documents_job(
        self,
        documents: Sequence[Any],
        owner_id: str,
        job_id: str,
        worker_id: str,
    ) -> bool:
        """Legacy batch payload → one queued job per file, then complete wrapper."""
        try:
            if not documents:
                raise DocLoaderError("documents list is empty")
            await self.enqueue_documents(
                documents,
                owner_id,
                idempotency_key=f"split:{job_id}",
            )
            return await self.queue.complete_job(job_id=job_id, worker_id=worker_id)
        except Exception as e:
            return await self._handle_ingest_error(
                e,
                job_id=job_id,
                owner_id=owner_id,
                worker_id=worker_id,
                context="Documents split",
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
                context="URL",
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
                context="Text",
            )

    async def run_next_job(self, worker_id: str) -> dict | None:
        job = await self.queue.claim_job(worker_id=worker_id)
        if job is None:
            return None
        job_id = job["id"]
        payload = job["payload"]
        owner_id = job["owner_id"]
        source_type = payload.get("source_type")
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
            # Legacy batch jobs: fan out, never ingest the batch in one lock.
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
            await self.failed_job_handler(
                job_id,
                owner_id,
                worker_id,
                error=f"unknown source_type: {source_type}",
            )
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
