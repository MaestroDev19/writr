"""LangChain Supabase vector store for shared RagLine retrieval.

Text search calls ``hybrid_search``: english full-text rank fused with
halfvec cosine search. ``match_documents`` remains the vector-only RPC.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from langchain_community.vectorstores import SupabaseVectorStore
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStoreRetriever
from supabase import Client

from core.config import get_settings
from services.embeddings import EmbeddingService, get_embedding_service
from services.supabase import get_service_supabase

CHUNK_TABLE = "reference_chunks"
MATCH_QUERY = "match_documents"
HYBRID_QUERY = "hybrid_search"
DEFAULT_K = 5


class HybridSupabaseVectorStore(SupabaseVectorStore):
    """Note search that sends the query text and its embedding together.

    LangChain's default path embeds the string and drops it, so keyword
    match never runs. This override calls ``hybrid_search`` instead.
    """

    def similarity_search_with_relevance_scores(
        self,
        query: str,
        k: int = 4,
        filter: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> list[tuple[Document, float]]:
        vector = self._embedding.embed_query(query)
        params: dict[str, Any] = {
            "query_text": query,
            "query_embedding": vector,
            "match_count": k,
        }
        if filter:
            params["filter"] = filter
        response = self._client.rpc(HYBRID_QUERY, params).execute()
        scored: list[tuple[Document, float]] = []
        for row in response.data or []:
            content = row.get("content")
            if not content:
                continue
            scored.append(
                (
                    Document(
                        metadata=row.get("metadata") or {},
                        page_content=content,
                    ),
                    float(row.get("similarity") or 0.0),
                )
            )
        threshold = kwargs.get("score_threshold")
        if threshold is not None:
            scored = [
                (doc, score) for doc, score in scored if score >= threshold
            ]
        return scored

    def similarity_search(
        self,
        query: str,
        k: int = 4,
        filter: dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> list[Document]:
        scored = self.similarity_search_with_relevance_scores(
            query, k=k, filter=filter, **kwargs
        )
        return [doc for doc, _score in scored]


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
) -> HybridSupabaseVectorStore:
    """Build a hybrid note store with Writr defaults.

    ``query_name`` is the vector-only RPC (``match_documents``). Text
    search goes through ``hybrid_search``.
    """
    sync_client = client or get_service_supabase()
    if embedding is None:
        service = embedding_service or get_embedding_service(get_settings())
        embedding = _langchain_embeddings(service)

    return HybridSupabaseVectorStore(
        client=sync_client,
        embedding=embedding,
        table_name=table_name,
        query_name=query_name,
    )

@lru_cache(maxsize=1)
def get_vectorstore():
    return build_vectorstore()

def get_retriever(
    *,
    k: int = DEFAULT_K,
    owner_id: str | None = None,
    vectorstore: SupabaseVectorStore | None = None,
    search_type: str = "similarity",
    **search_kwargs: Any,
) -> VectorStoreRetriever:
    """Return a hybrid retriever over ``reference_chunks``.

    When ``owner_id`` is set it is merged into ``filter``. ``hybrid_search``
    applies that owner and any other metadata keys before ranking.
    """
    store = vectorstore or get_vectorstore()
    kwargs: dict[str, Any] = {"k": k, **search_kwargs}
    if owner_id:
        meta_filter = kwargs.get("filter") or {}
        if isinstance(meta_filter, dict):
            kwargs["filter"] = {**meta_filter, "owner_id": owner_id}
    return store.as_retriever(search_type=search_type, search_kwargs=kwargs)
