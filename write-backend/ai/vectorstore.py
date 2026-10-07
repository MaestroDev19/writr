"""LangChain Supabase vector store for shared RagLine retrieval.

Wraps ``reference_chunks`` + ``match_documents`` with Writr's sync
Supabase client and EmbeddingService (same pattern as
``services.vetctor_store.WritrVectorStore.vectorstore``).
"""

from __future__ import annotations

from typing import Any

from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStoreRetriever
from supabase import Client
from functools import lru_cache
from core.config import get_settings
from services.embeddings import EmbeddingService, get_embedding_service
from services.supabase import get_supabase

CHUNK_TABLE = "reference_chunks"
MATCH_QUERY = "match_documents"
DEFAULT_K = 5


def _langchain_embeddings(embedding_service: EmbeddingService) -> Embeddings:
    """Unwrap EmbeddingService → raw LangChain Embeddings client."""
    client = getattr(embedding_service, "client", None)
    if client is None:
        raise ValueError("Embedding client is not configured.")
    if not isinstance(client, Embeddings):
        raise ValueError("Embedding client is not LangChain-compatible.")
    return client


def build_vectorstore(
    *,
    client: Client | None = None,
    embedding: Embeddings | None = None,
    embedding_service: EmbeddingService | None = None,
    table_name: str = CHUNK_TABLE,
    query_name: str = MATCH_QUERY,
) -> SupabaseVectorStore:
    """Build a ``SupabaseVectorStore`` with Writr defaults.

    Parameters match LangChain's constructor:
    ``SupabaseVectorStore(client, embedding, table_name, query_name=...)``.
    """
    sync_client = client or get_supabase()
    if embedding is None:
        service = embedding_service or get_embedding_service(get_settings())
        embedding = _langchain_embeddings(service)

    return SupabaseVectorStore(
        client=sync_client,
        embedding=embedding,
        table_name=table_name,
        query_name=query_name,
    )

@lru_cache(maxsize=1)
def get_retriever(
    *,
    k: int = DEFAULT_K,
    owner_id: str | None = None,
    vectorstore: SupabaseVectorStore | None = None,
    search_type: str = "similarity",
    **search_kwargs: Any,
) -> VectorStoreRetriever:
    """Return a LangChain retriever over ``reference_chunks``.

    When ``owner_id`` is set it is merged into ``filter`` for
    ``match_documents`` metadata containment. Prefer storing ``owner_id``
    inside chunk ``metadata`` at ingest (column-only filters need a custom RPC).
    """
    store = vectorstore or build_vectorstore()
    kwargs: dict[str, Any] = {"k": k, **search_kwargs}
    if owner_id:
        meta_filter = kwargs.get("filter") or {}
        if isinstance(meta_filter, dict):
            kwargs["filter"] = {**meta_filter, "owner_id": owner_id}
    return store.as_retriever(search_type=search_type, search_kwargs=kwargs)
