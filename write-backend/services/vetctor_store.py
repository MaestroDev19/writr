"""Supabase-backed vector store for reference documents and chunks.

Two jobs:
  1. Ingest — async client: create parent doc, embed, insert chunks
  2. Retrieve — sync client: LangChain SupabaseVectorStore (sync-only API)

Both clients are required because LangChain's wrapper has no async path, while
ingest uses ``await`` on PostgREST.

Parent ``embedding_status`` moves: pending → processing → completed | failed.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone
from functools import cached_property
from typing import Annotated, Any, NoReturn

from fastapi import Depends
from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStoreRetriever
from postgrest.exceptions import APIError
from supabase import AsyncClient, Client

from services.embeddings import EmbeddingError, EmbeddingService, EmbeddingServiceDep
from services.supabase import AsyncServiceSupabaseDep, SupabaseDep
from utils.log import bind, current_event, note, scrub

# Table names in Supabase (public schema).
table_names = {
    "reference_documents": "reference_documents",
    "reference_chunks": "reference_chunks",
}

# Allowed values for reference_documents.embedding_status.
embedding_status_enum = {
    "pending": "pending",
    "processing": "processing",
    "completed": "completed",
    "failed": "failed",
}

# Client-facing messages — no schema or DB detail leaked to HTTP responses.
_CREATE_FAILED = "Could not create reference document."
_CREATE_EMPTY = "Could not create reference document (empty response)."
_ADD_FAILED = "Could not store reference chunks."
_ADD_EMPTY = "Could not store reference chunks (empty response)."
_EMBED_FAILED = "Could not embed reference chunks."
_STATUS_FAILED = "Could not update embedding status."


class VectorStoreError(Exception):
    """Raised when a vector-store DB operation fails.

    Callers catch this and map it to an HTTP error response.
    Message is client-safe; details belong in logs only.
    ``document_id`` is set when a parent note already exists (partial ingest).
    """

    def __init__(
        self, message: str, *, document_id: str | None = None
    ) -> None:
        super().__init__(message)
        self.document_id = document_id


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _chunk_content(document: Any) -> str:
    """Pull text from either a LangChain Document or our Chunk dataclass."""
    if hasattr(document, "page_content"):
        return str(document.page_content or "")
    if hasattr(document, "content"):
        return str(document.content or "")
    raise VectorStoreError("Each chunk must have content.")


def _chunk_index(document: Any, fallback: int) -> int:
    """Figure out this chunk's order: explicit index → metadata → loop position."""
    if hasattr(document, "chunk_index") and document.chunk_index is not None:
        return int(document.chunk_index)
    if hasattr(document, "index") and document.index is not None:
        return int(document.index)
    meta = getattr(document, "metadata", None)
    if isinstance(meta, dict) and meta.get("chunk_index") is not None:
        return int(meta["chunk_index"])
    return fallback


def _chunk_metadata(document: Any) -> dict[str, Any]:
    """Copy metadata dict if present; otherwise empty."""
    meta = getattr(document, "metadata", None)
    if isinstance(meta, dict):
        return dict(meta)
    return {}


# ---------------------------------------------------------------------------
# Main store
# ---------------------------------------------------------------------------

class WritrVectorStore:
    """Owns ingest + LangChain retrieval for Writr reference notes.

    Typical flow:
      store.add_documents(chunks, name=..., owner_id=...)  # async write
      store.vectorstore.as_retriever()                     # sync read / RAG
    """

    def __init__(
        self,
        supabase_client: AsyncClient,
        embedding_function: EmbeddingService,
        *,
        sync_client: Client | None = None,
        query: str = "match_documents",
    ) -> None:
        self.supabase_client = supabase_client  # async writes / status updates
        self.embedding_function = embedding_function
        self.sync_client = sync_client  # LangChain retrieval only (sync API)
        self.query = query  # Postgres RPC name for similarity search
        self.document_table_name = table_names["reference_documents"]
        self.chunk_table_name = table_names["reference_chunks"]

    # ------------------------------------------------------------------
    # Status updates on the parent document
    # ------------------------------------------------------------------

    async def _set_embedding_status(
        self,
        *,
        document_id: str,
        status: str,
        owner_id: str | None = None,
        raise_on_error: bool = True,
    ) -> None:
        """Write ``embedding_status`` on one parent row.

        ``raise_on_error=False`` on failure paths so the *original* error
        still surfaces if this status write itself fails.
        """
        if status not in embedding_status_enum.values():
            raise VectorStoreError("Invalid embedding status.")

        bind(document_id=document_id, user_id=owner_id)
        try:
            query = (
                self.supabase_client.table(self.document_table_name)
                .update({"embedding_status": status})
                .eq("id", document_id)
            )
            # Extra guard: never update another user's row when owner_id is known.
            if owner_id:
                query = query.eq("owner_id", owner_id)
            res = await query.execute()
        except APIError as e:
            bind(
                document_id=document_id,
                user_id=owner_id,
                db_code=e.code,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            if raise_on_error:
                raise VectorStoreError(_STATUS_FAILED) from e
            return
        except Exception as e:
            bind(
                document_id=document_id,
                user_id=owner_id,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            if raise_on_error:
                raise VectorStoreError(_STATUS_FAILED) from e
            return

        if not res.data:
            bind(
                document_id=document_id,
                user_id=owner_id,
                error_type="EmbeddingStatusMissed",
                lost_document_id=document_id,
            )
            if raise_on_error:
                raise VectorStoreError(_STATUS_FAILED)
            return

    async def count_reference_documents(self, *, owner_id: str) -> int:
        """How many notes this owner already has in ``reference_documents``."""
        if not owner_id or not str(owner_id).strip():
            raise VectorStoreError("Owner is required.")

        bind(user_id=owner_id)
        try:
            res = await (
                self.supabase_client.table(self.document_table_name)
                .select("id", count="exact")
                .eq("owner_id", owner_id)
                .execute()
            )
        except APIError as e:
            bind(
                user_id=owner_id,
                db_code=e.code,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            raise VectorStoreError("Could not count reference documents.") from e
        except Exception as e:
            bind(
                user_id=owner_id,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            raise VectorStoreError("Could not count reference documents.") from e

        if res.count is not None:
            return int(res.count)
        return len(res.data or [])

    async def list_reference_documents(self, *, owner_id: str) -> list[dict[str, Any]]:
        """List this owner's notes newest-first (no chunk bodies)."""
        if not owner_id or not str(owner_id).strip():
            raise VectorStoreError("Owner is required.")

        bind(user_id=owner_id)
        try:
            res = await (
                self.supabase_client.table(self.document_table_name)
                .select("id, name, chunk_count, embedding_status, created_at")
                .eq("owner_id", owner_id)
                .order("created_at", desc=True)
                .execute()
            )
        except APIError as e:
            bind(
                user_id=owner_id,
                db_code=e.code,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            raise VectorStoreError("Could not list reference documents.") from e
        except Exception as e:
            bind(
                user_id=owner_id,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            raise VectorStoreError("Could not list reference documents.") from e

        rows = res.data or []
        bind(user_id=owner_id, document_count=len(rows))
        return list(rows)

    async def delete_reference_document(
        self,
        *,
        document_id: str,
        owner_id: str,
        raise_on_error: bool = True,
    ) -> bool:
        """Delete parent note; ``ON DELETE CASCADE`` removes its chunks.

        Soft-retry cleanup: drop a failed/processing stub so the next attempt
        creates a fresh parent instead of leaving orphans.
        """
        if not document_id or not str(document_id).strip():
            raise VectorStoreError("Document id is required.")
        if not owner_id or not str(owner_id).strip():
            raise VectorStoreError("Owner is required.")

        bind(document_id=document_id, user_id=owner_id)
        try:
            res = await (
                self.supabase_client.table(self.document_table_name)
                .delete()
                .eq("id", document_id)
                .eq("owner_id", owner_id)
                .execute()
            )
        except APIError as e:
            bind(
                document_id=document_id,
                user_id=owner_id,
                db_code=e.code,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            if raise_on_error:
                raise VectorStoreError(
                    "Could not delete reference document.",
                    document_id=document_id,
                ) from e
            return False
        except Exception as e:
            bind(
                document_id=document_id,
                user_id=owner_id,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            if raise_on_error:
                raise VectorStoreError(
                    "Could not delete reference document.",
                    document_id=document_id,
                ) from e
            return False

        deleted = bool(res.data)
        if not deleted:
            bind(
                document_id=document_id,
                user_id=owner_id,
                error_type="DocumentDeleteMissed",
                lost_document_id=document_id,
            )
        return deleted

    # ------------------------------------------------------------------
    # Create parent document (starts as pending)
    # ------------------------------------------------------------------

    async def create_reference_document(
        self,
        *,
        name: str,
        owner_id: str,
        chunk_count: int,
    ) -> str:
        """Insert one reference_documents row; return its id."""
        if not name or not name.strip():
            raise VectorStoreError("Document name is required.")
        if not owner_id or not str(owner_id).strip():
            raise VectorStoreError("Owner is required.")
        if chunk_count < 0:
            raise VectorStoreError("Chunk count must be zero or greater.")

        bind(user_id=owner_id, chunk_count=chunk_count)
        row: dict[str, Any] = {
            "name": name.strip(),
            "owner_id": owner_id,
            "chunk_count": chunk_count,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "embedding_status": embedding_status_enum["pending"],
        }

        try:
            res = await (
                self.supabase_client.table(self.document_table_name)
                .upsert(row)
                .execute()
            )
        except APIError as e:
            # Keep PostgREST detail out of the raise; ids stay on the wide event.
            bind(
                user_id=owner_id,
                db_code=e.code,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            raise VectorStoreError(_CREATE_FAILED) from e
        except Exception as e:
            bind(
                user_id=owner_id,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            raise VectorStoreError(_CREATE_FAILED) from e

        if not res.data:
            bind(
                user_id=owner_id,
                error_type="DocumentInsertEmpty",
            )
            raise VectorStoreError(_CREATE_EMPTY)

        doc_id = res.data[0].get("id")
        if not doc_id:
            bind(
                user_id=owner_id,
                error_type="DocumentInsertMissingId",
            )
            raise VectorStoreError(_CREATE_EMPTY)

        bind(document_id=str(doc_id), user_id=owner_id, chunk_count=chunk_count)
        return doc_id

    # ------------------------------------------------------------------
    # Ingest: validate → create parent → embed → insert chunks
    # ------------------------------------------------------------------

    async def add_documents(
        self,
        documents: Sequence[Any],
        *,
        name: str,
        owner_id: str,
    ) -> list[str]:
        """Full ingest pipeline for one note.

        Steps:
          1. Validate / normalize each chunk
          2. Create parent doc (status=pending, chunk_count set)
          3. Mark processing
          4. Embed all texts in one batch
          5. Insert all chunk rows in one batch
          6. Mark completed — or failed if anything blew up

        Returns inserted chunk UUIDs in the same order as ``documents``.
        """
        if not name or not name.strip():
            raise VectorStoreError("Document name is required.")
        if not owner_id or not str(owner_id).strip():
            raise VectorStoreError("Owner is required.")
        if not documents:
            return []

        bind(user_id=owner_id)
        now = datetime.now(timezone.utc).isoformat()

        # 1. Normalize each chunk (content / index / metadata).
        texts: list[str] = []
        indexes: list[int] = []
        metadatas: list[dict[str, Any]] = []
        for _i, document in enumerate(documents):
            content = _chunk_content(document).strip()
            if not content:
                bind(
                    user_id=owner_id,
                    error_type="EmptyChunk",
                    error_message="Chunk content cannot be empty.",
                )
                raise VectorStoreError("Chunk content cannot be empty.")
            texts.append(content)
            indexes.append(_chunk_index(document, _i))
            metadatas.append(_chunk_metadata(document))

        chunk_count = len(texts)

        # 2. Parent row starts as pending.
        document_id = await self.create_reference_document(
            name=name.strip(),
            owner_id=owner_id,
            chunk_count=chunk_count,
        )
        bind(document_id=str(document_id), user_id=owner_id, chunk_count=chunk_count)

        async def _fail_and_raise(exc: BaseException, client_message: str) -> NoReturn:
            # Leave parent as failed before re-raising so the UI can show status.
            await self._set_embedding_status(
                document_id=document_id,
                status=embedding_status_enum["failed"],
                owner_id=owner_id,
                raise_on_error=False,
            )
            if isinstance(exc, VectorStoreError):
                if exc.document_id is None:
                    exc.document_id = document_id
                raise exc
            raise VectorStoreError(
                client_message, document_id=document_id
            ) from exc

        try:
            # 3. pending → processing (signals work in flight).
            await self._set_embedding_status(
                document_id=document_id,
                status=embedding_status_enum["processing"],
                owner_id=owner_id,
            )

            # 4. One embedding API call for the whole batch.
            client_id = getattr(self.embedding_function, "embedding_client_id", None)
            bind(
                document_id=str(document_id),
                user_id=owner_id,
                embedding_client_id=client_id,
                chunk_count=chunk_count,
            )
            embeddings = await self.embedding_function.embed_documents(texts)

            if len(embeddings) != chunk_count:
                bind(
                    document_id=str(document_id),
                    user_id=owner_id,
                    chunk_count=chunk_count,
                    embedding_count=len(embeddings),
                    error_type="EmbeddingCountMismatch",
                )
                raise VectorStoreError(_EMBED_FAILED)

            # 5. Insert all chunk rows in one batch.
            rows: list[dict[str, Any]] = [
                {
                    "document_id": document_id,
                    "owner_id": owner_id,
                    "chunk_index": indexes[i],
                    "content": texts[i],
                    "embedding": embeddings[i],
                    "metadata": metadatas[i],
                    "created_at": now,
                }
                for i in range(chunk_count)
            ]

            res = await (
                self.supabase_client.table(self.chunk_table_name)
                .upsert(rows)
                .execute()
            )

            if not res.data:
                bind(
                    document_id=str(document_id),
                    user_id=owner_id,
                    chunk_count=chunk_count,
                    error_type="ChunkInsertEmpty",
                )
                raise VectorStoreError(_ADD_EMPTY)

            if len(res.data) != chunk_count:
                bind(
                    document_id=str(document_id),
                    user_id=owner_id,
                    chunk_count=chunk_count,
                    inserted_count=len(res.data),
                    error_type="ChunkInsertCountMismatch",
                )
                raise VectorStoreError(_ADD_EMPTY)

            chunk_ids: list[str] = []
            for row in res.data:
                chunk_id = row.get("id")
                if not chunk_id:
                    bind(
                        document_id=str(document_id),
                        user_id=owner_id,
                        error_type="ChunkInsertMissingId",
                    )
                    raise VectorStoreError(_ADD_EMPTY)
                chunk_ids.append(str(chunk_id))

            # 6. processing → completed.
            await self._set_embedding_status(
                document_id=document_id,
                status=embedding_status_enum["completed"],
                owner_id=owner_id,
            )

            bind(
                document_id=str(document_id),
                user_id=owner_id,
                chunk_id=chunk_ids[0],
                chunk_ids=chunk_ids,
                chunk_count=len(chunk_ids),
            )
            return chunk_ids

        except EmbeddingError as e:
            bind(
                document_id=str(document_id),
                user_id=owner_id,
                chunk_count=chunk_count,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            await _fail_and_raise(e, _EMBED_FAILED)
        except APIError as e:
            bind(
                document_id=str(document_id),
                user_id=owner_id,
                chunk_count=chunk_count,
                db_code=e.code,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            await _fail_and_raise(e, _ADD_FAILED)
        except VectorStoreError as e:
            bind(
                document_id=str(document_id),
                user_id=owner_id,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            await _fail_and_raise(e, str(e) or _ADD_FAILED)
        except Exception as e:
            bind(
                document_id=str(document_id),
                user_id=owner_id,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
            )
            await _fail_and_raise(e, _ADD_FAILED)

    # ------------------------------------------------------------------
    # LangChain retrieval helpers
    # ------------------------------------------------------------------

    def _langchain_embeddings(self) -> Embeddings:
        """Unwrap EmbeddingService → the raw LangChain Embeddings client."""
        client = getattr(self.embedding_function, "client", None)
        if client is None:
            raise VectorStoreError("Embedding client is not configured.")
        if not isinstance(client, Embeddings):
            raise VectorStoreError("Embedding client is not LangChain-compatible.")
        return client

    @cached_property
    def vectorstore(self) -> SupabaseVectorStore:
        """LangChain store over reference_chunks + match_documents.

        Built once per WritrVectorStore instance. Uses ``sync_client`` because
        LangChain's Supabase wrapper has no async API.
        """
        client = self.sync_client
        if client is None:
            raise VectorStoreError(
                "Sync Supabase client is required for LangChain retrieval."
            )
        if isinstance(client, AsyncClient):
            raise VectorStoreError(
                "LangChain vector store requires a sync Supabase client."
            )
        if not isinstance(client, Client):
            raise VectorStoreError("Supabase client is not configured.")

        try:
            return SupabaseVectorStore(
                client=client,
                embedding=self._langchain_embeddings(),
                table_name=self.chunk_table_name,
                query_name=self.query,
            )
        except VectorStoreError:
            raise
        except Exception as e:
            fields = {
                "operation": "vector_store_init",
                "error_type": type(e).__name__,
                "error_message": scrub(str(e)),
                "outcome": "error",
            }
            embedding = self.embedding_function
            client_id = getattr(embedding, "embedding_client_id", None)
            if client_id:
                fields["embedding_client_id"] = client_id
            if current_event() is None:
                note(**fields)
            else:
                bind(**fields)
            raise VectorStoreError("Could not create vector store.") from e

    def as_retriever(self, **kwargs: Any) -> VectorStoreRetriever:
        """LangChain retriever for Write/Review RAG (uses cached vectorstore)."""
        return self.vectorstore.as_retriever(**kwargs)


def get_writr_vector_store(
    async_client: AsyncServiceSupabaseDep,
    sync_client: SupabaseDep,
    embedding_function: EmbeddingServiceDep,
) -> WritrVectorStore:
    """FastAPI dependency: async client for ingest, sync client for retrieval."""
    return WritrVectorStore(
        async_client,
        embedding_function,
        sync_client=sync_client,
    )


WritrVectorStoreDep = Annotated[WritrVectorStore, Depends(get_writr_vector_store)]
