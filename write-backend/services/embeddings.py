"""
Embedding helpers for queries and document chunks.

Job of this module: turn text into dense float vectors that can be stored
in a vector index (e.g. Supabase pgvector) and compared by similarity.

Providers:
  - Gemini  (GoogleGenerativeAIEmbeddings) — preferred when GEMINI_API_KEY is set
  - OpenAI  (OpenAIEmbeddings)             — fallback when only OPENAI_API_KEY is set

All public embed methods are async so FastAPI routes never block the event loop.
"""

import asyncio
from functools import lru_cache
from typing import Annotated, Protocol, runtime_checkable

from fastapi import Depends
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings

from core.config import SettingsDep, get_settings
from utils.log import logger


class EmbeddingError(Exception):
    """Raised when an embedding provider fails to embed text or initialize.

    Callers catch this and map it to an HTTP error response.
    """


@runtime_checkable
class EmbeddingClient(Protocol):
    """Minimal interface every embedding backend must satisfy.

    Matches LangChain embedding clients:
      - sync:  embed_query / embed_documents
      - async: aembed_query / aembed_documents (optional — we fall back to threads)
    """

    def embed_query(self, text: str) -> list[float]: ...
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...


class EmbeddingService:
    """Thin async wrapper around any EmbeddingClient.

    If the underlying client has native async methods (``aembed_*``), we use
    them. Otherwise we run the sync methods in a worker thread via
    ``asyncio.to_thread`` so the FastAPI event loop stays free.
    """

    def __init__(self, client: EmbeddingClient) -> None:
        self.client = client
        logger.info(
            f"EmbeddingService initialized with client '{type(client).__name__}'"
        )

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single search / chat query string → one vector."""
        if not text or not text.strip():
            raise EmbeddingError("Query text cannot be empty.")

        logger.info("Embedding a user query.")
        try:
            # Prefer native async if the provider offers it.
            if hasattr(self.client, "aembed_query") and callable(self.client.aembed_query):
                return await self.client.aembed_query(text)
            # Sync fallback — off the event loop.
            return await asyncio.to_thread(self.client.embed_query, text)
        except Exception as e:
            logger.error(f"Error embedding query: {e}")
            raise EmbeddingError(f"Failed to embed query: {e}") from e

    async def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Embed many chunk strings → one vector per document (same order).

        Empty input returns ``[]`` immediately (no API call).
        """
        if not documents:
            return []

        logger.info(f"Embedding {len(documents)} document(s).")
        try:
            if hasattr(self.client, "aembed_documents") and callable(self.client.aembed_documents):
                return await self.client.aembed_documents(documents)
            return await asyncio.to_thread(self.client.embed_documents, documents)
        except Exception as e:
            logger.error(f"Error embedding {len(documents)} document(s): {e}")
            raise EmbeddingError(f"Failed to embed documents: {e}") from e


class GeminiEmbeddingService(EmbeddingService):
    """EmbeddingService backed by Google Generative AI (Gemini).

    Model name and output dimensions come from Settings unless overridden.
    ``output_dimensionality`` must match the vector column size in the DB
    (see ``settings.embedding_dim``, typically 768).
    """

    def __init__(self, model: str | None = None, dimensions: int | None = None) -> None:
        settings = get_settings()
        api_key = settings.gemini_api_key
        if not api_key:
            logger.error("Gemini API key is missing in Settings.")
            raise EmbeddingError("Gemini API key is not configured in Settings.")

        target_model = model or settings.gemini_embedding_model
        dim = dimensions or settings.embedding_dim

        try:
            client = GoogleGenerativeAIEmbeddings(
                model=target_model,
                google_api_key=api_key,
                output_dimensionality=dim,
            )
        except Exception as e:
            logger.error(f"Failed to initialize GeminiEmbeddingService: {e}")
            raise EmbeddingError(f"Could not initialize GeminiEmbeddingService: {e}") from e

        super().__init__(client=client)
        logger.info("GeminiEmbeddingService initialized.")


class OpenAIEmbeddingService(EmbeddingService):
    """EmbeddingService backed by OpenAI (e.g. text-embedding-3-small).

    ``dimensions`` must match the vector column size in the DB — same rule
    as Gemini; both providers should write vectors of ``settings.embedding_dim``.
    """

    def __init__(self, model: str | None = None, dimensions: int | None = None) -> None:
        settings = get_settings()
        api_key = settings.openai_api_key
        if not api_key:
            logger.error("OpenAI API key is missing in Settings.")
            raise EmbeddingError("OpenAI API key is not configured in Settings.")

        target_model = model or settings.openai_embedding_model
        dim = dimensions or settings.embedding_dim

        try:
            client = OpenAIEmbeddings(
                model=target_model,
                api_key=api_key,
                dimensions=dim,
            )
        except Exception as e:
            logger.error(f"Failed to initialize OpenAIEmbeddingService: {e}")
            raise EmbeddingError(f"Could not initialize OpenAIEmbeddingService: {e}") from e

        super().__init__(client=client)
        logger.info("OpenAIEmbeddingService initialized.")


# ---------------------------------------------------------------------------
# Factories + FastAPI dependencies
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def get_gemini_embedding_service() -> GeminiEmbeddingService:
    """Create GeminiEmbeddingService once; reuse for all requests."""
    return GeminiEmbeddingService()


@lru_cache(maxsize=1)
def get_openai_embedding_service() -> OpenAIEmbeddingService:
    """Create OpenAIEmbeddingService once; reuse for all requests."""
    return OpenAIEmbeddingService()


def get_embedding_service(settings: SettingsDep) -> EmbeddingService:
    """Pick the default provider for this deployment.

    Preference order:
      1. Gemini  — if GEMINI_API_KEY is set
      2. OpenAI  — if OPENAI_API_KEY is set
      3. Gemini  — last resort (will raise EmbeddingError if key is missing)
    """
    if settings.gemini_api_key:
        return get_gemini_embedding_service()
    if settings.openai_api_key:
        return get_openai_embedding_service()
    return get_gemini_embedding_service()


# Route signature helpers: ``service: EmbeddingServiceDep``.
EmbeddingServiceDep = Annotated[EmbeddingService, Depends(get_embedding_service)]
GeminiEmbeddingServiceDep = Annotated[GeminiEmbeddingService, Depends(get_gemini_embedding_service)]
OpenAIEmbeddingServiceDep = Annotated[OpenAIEmbeddingService, Depends(get_openai_embedding_service)]


async def embed_query(text: str) -> list[float]:
    """One-liner helper: embed a query with the default configured service."""
    service = get_embedding_service(get_settings())
    return await service.embed_query(text)


async def embed_documents(documents: list[str]) -> list[list[float]]:
    """One-liner helper: embed many texts with the default configured service."""
    service = get_embedding_service(get_settings())
    return await service.embed_documents(documents)
