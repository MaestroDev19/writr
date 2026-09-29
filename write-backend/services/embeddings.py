"""
Embedding helpers for queries and document chunks.

Job of this module: turn text into dense float vectors that can be stored
in a vector index (e.g. Supabase pgvector) and compared by similarity.

Providers:
  - Gemini  (GoogleGenerativeAIEmbeddings) — the caller's own key, or the
    app default (``GEMINI_API_KEY``) when ``use_app_default`` is set
  - OpenAI  (OpenAIEmbeddings) — the caller's own key only

The process-wide client used by the worker is the Gemini app default.
Per-request keys go through ``create_embedding_service``.

All public embed methods are async so FastAPI routes never block the event loop.
"""

import asyncio
from functools import lru_cache
from typing import Annotated, Literal, Protocol, runtime_checkable

from fastapi import Depends, Header
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings

from core.config import SettingsDep, get_settings
from utils.log import logger

EmbeddingProvider = Literal["gemini", "openai"]


def _normalize_api_key(api_key: str | None) -> str | None:
    """Return a stripped key, or None when the value is missing or blank."""
    if api_key is None:
        return None
    stripped = api_key.strip()
    return stripped or None


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

    Pass the caller's own ``api_key``, or set ``use_app_default=True`` to use
    ``GEMINI_API_KEY`` from Settings. A caller key wins when both are present.

    Model name and output dimensions come from Settings unless overridden.
    ``output_dimensionality`` must match the vector column size in the DB
    (see ``settings.embedding_dim``, typically 768).
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        dimensions: int | None = None,
        *,
        use_app_default: bool = False,
    ) -> None:
        settings = get_settings()
        user_key = _normalize_api_key(api_key)
        if user_key:
            resolved_key = user_key
            key_source = "user"
        elif use_app_default:
            resolved_key = _normalize_api_key(settings.gemini_api_key)
            key_source = "app default"
            if not resolved_key:
                logger.error("App default Gemini API key is missing in Settings.")
                raise EmbeddingError(
                    "App default Gemini API key is not configured. "
                    "Set GEMINI_API_KEY or pass your own key."
                )
        else:
            logger.error("Gemini embedding request is missing a user API key.")
            raise EmbeddingError(
                "A Gemini API key is required. Pass your own key, "
                "or set use_app_default=True to use the app key."
            )

        target_model = model or settings.gemini_embedding_model
        dim = dimensions or settings.embedding_dim

        try:
            client = GoogleGenerativeAIEmbeddings(
                model=target_model,
                google_api_key=resolved_key,
                output_dimensionality=dim,
            )
        except Exception as e:
            logger.error(f"Failed to initialize GeminiEmbeddingService: {e}")
            raise EmbeddingError(f"Could not initialize GeminiEmbeddingService: {e}") from e

        super().__init__(client=client)
        logger.info(f"GeminiEmbeddingService initialized with {key_source} API key.")


class OpenAIEmbeddingService(EmbeddingService):
    """EmbeddingService backed by OpenAI (e.g. text-embedding-3-small).

    ``api_key`` must be the caller's own OpenAI key.

    ``dimensions`` must match the vector column size in the DB — same rule
    as Gemini; both providers should write vectors of ``settings.embedding_dim``.
    """

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        dimensions: int | None = None,
    ) -> None:
        user_key = _normalize_api_key(api_key)
        if not user_key:
            logger.error("OpenAI embedding request is missing a user API key.")
            raise EmbeddingError("OpenAI embeddings require your own API key.")

        settings = get_settings()
        target_model = model or settings.openai_embedding_model
        dim = dimensions or settings.embedding_dim

        try:
            client = OpenAIEmbeddings(
                model=target_model,
                api_key=user_key,
                dimensions=dim,
            )
        except Exception as e:
            logger.error(f"Failed to initialize OpenAIEmbeddingService: {e}")
            raise EmbeddingError(f"Could not initialize OpenAIEmbeddingService: {e}") from e

        super().__init__(client=client)
        logger.info("OpenAIEmbeddingService initialized with user API key.")


# ---------------------------------------------------------------------------
# Factories + FastAPI dependencies
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _app_default_gemini_embedding_service() -> GeminiEmbeddingService:
    """Create the app-default Gemini client once; reuse for every request that opts in."""
    return GeminiEmbeddingService(use_app_default=True)


def get_gemini_embedding_service(api_key: str | None = None) -> GeminiEmbeddingService:
    """Gemini client for a user key, or the cached app-default client when omitted."""
    if _normalize_api_key(api_key):
        return GeminiEmbeddingService(api_key=api_key)
    return _app_default_gemini_embedding_service()


def get_openai_embedding_service(api_key: str) -> OpenAIEmbeddingService:
    """OpenAI client for the caller's own key. Not cached — keys differ per caller."""
    return OpenAIEmbeddingService(api_key=api_key)


def create_embedding_service(
    provider: EmbeddingProvider,
    api_key: str | None = None,
    *,
    use_app_default: bool = False,
    model: str | None = None,
    dimensions: int | None = None,
) -> EmbeddingService:
    """Build an embedding client for one caller.

    ``api_key`` is the caller's own key for Gemini or OpenAI. A user key
    wins over the app default. ``use_app_default`` reads ``GEMINI_API_KEY``
    and is valid for Gemini only.
    """
    if provider == "gemini":
        return GeminiEmbeddingService(
            api_key=api_key,
            model=model,
            dimensions=dimensions,
            use_app_default=use_app_default,
        )
    if provider == "openai":
        if use_app_default and not _normalize_api_key(api_key):
            raise EmbeddingError(
                "The app default embedding key is available for Gemini only. "
                "Pass your own OpenAI API key."
            )
        return OpenAIEmbeddingService(
            api_key=api_key or "",
            model=model,
            dimensions=dimensions,
        )
    raise EmbeddingError(f"Unsupported embedding provider '{provider}'.")


def get_embedding_service(settings: SettingsDep) -> EmbeddingService:
    """Return the shared Gemini client that uses the app's GEMINI_API_KEY.

    Per-caller keys belong in ``create_embedding_service``. OpenAI is not
    selected here because it always needs the caller's own key.
    """
    if not _normalize_api_key(settings.gemini_api_key):
        logger.error("App default Gemini API key is missing in Settings.")
        raise EmbeddingError(
            "App default Gemini API key is not configured. Set GEMINI_API_KEY."
        )
    return get_gemini_embedding_service()


def _gemini_embedding_service_from_request(
    api_key: Annotated[str | None, Header(alias="X-Gemini-Api-Key")] = None,
) -> GeminiEmbeddingService:
    """Route dependency: user Gemini key, otherwise the app default."""
    return get_gemini_embedding_service(api_key)


def _openai_embedding_service_from_request(
    api_key: Annotated[str, Header(alias="X-OpenAI-Api-Key")],
) -> OpenAIEmbeddingService:
    """Route dependency: the caller's own OpenAI key from ``X-OpenAI-Api-Key``."""
    return get_openai_embedding_service(api_key)


# Route signature helpers: ``service: EmbeddingServiceDep``.
EmbeddingServiceDep = Annotated[EmbeddingService, Depends(get_embedding_service)]
GeminiEmbeddingServiceDep = Annotated[
    GeminiEmbeddingService, Depends(_gemini_embedding_service_from_request)
]
OpenAIEmbeddingServiceDep = Annotated[
    OpenAIEmbeddingService, Depends(_openai_embedding_service_from_request)
]


async def embed_query(text: str) -> list[float]:
    """One-liner helper: embed a query with the default configured service."""
    service = get_embedding_service(get_settings())
    return await service.embed_query(text)


async def embed_documents(documents: list[str]) -> list[list[float]]:
    """One-liner helper: embed many texts with the default configured service."""
    service = get_embedding_service(get_settings())
    return await service.embed_documents(documents)
