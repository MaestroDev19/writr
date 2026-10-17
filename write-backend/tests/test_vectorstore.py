"""Tests for vectorstore and service Supabase client configuration."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from langchain_core.embeddings import Embeddings

from ai.vectorstore import HybridSupabaseVectorStore, build_vectorstore, get_retriever
from services.supabase import get_service_supabase


class DummyEmbeddings(Embeddings):
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [[0.1] * 768 for _ in texts]

    def embed_query(self, text: str) -> list[float]:
        return [0.1] * 768


def test_build_vectorstore_defaults_to_service_client():
    fake_client = MagicMock()
    with patch("ai.vectorstore.get_service_supabase", return_value=fake_client):
        store = build_vectorstore(embedding=DummyEmbeddings())
        assert isinstance(store, HybridSupabaseVectorStore)
        assert store._client is fake_client


def test_get_retriever_injects_owner_filter():
    fake_client = MagicMock()
    fake_rpc = MagicMock()
    fake_rpc.execute.return_value = MagicMock(data=[
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "content": "Note excerpt about characters",
            "metadata": {"document_id": "doc-1", "name": "Story Bible"},
            "similarity": 0.85,
        }
    ])
    fake_client.rpc.return_value = fake_rpc

    store = build_vectorstore(client=fake_client, embedding=DummyEmbeddings())
    retriever = get_retriever(
        k=3,
        owner_id="7869fc7d-13ef-44f7-a3f4-2e6bf18abcd1",
        vectorstore=store,
    )

    docs = retriever.invoke("protagonist personality")
    assert len(docs) == 1
    assert docs[0].page_content == "Note excerpt about characters"
    assert docs[0].metadata["name"] == "Story Bible"

    # Verify rpc was called with hybrid_search and owner_id filter
    fake_client.rpc.assert_called_once()
    call_args = fake_client.rpc.call_args
    assert call_args[0][0] == "hybrid_search"
    params = call_args[0][1]
    assert params["query_text"] == "protagonist personality"
    assert params["match_count"] == 3
    assert params["filter"] == {"owner_id": "7869fc7d-13ef-44f7-a3f4-2e6bf18abcd1"}
