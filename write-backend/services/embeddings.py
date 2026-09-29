"""Embedding helpers for queries and document chunks.

Turns text into dense float vectors for storage in a vector index
(e.g. Supabase pgvector) and similarity search.

Providers:
  - Gemini — caller's key, or the app default (``GEMINI_API_KEY``) when
    ``use_app_default`` is set
  - OpenAI — caller's key only (no app default)

The worker uses the process-wide Gemini app-default client.
Per-request keys go through ``create_embedding_service``.

Public embed methods are async so FastAPI routes never block the event loop.
"""

import asyncio
import hashlib
import uuid
from functools import lru_cache
from typing import Annotated, Literal, Protocol, runtime_checkable

from fastapi import Depends, Header
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_openai import OpenAIEmbeddings

from core.config import SettingsDep, get_settings
from utils.log import bind, note, scrub

EmbeddingProvider = Literal["gemini", "openai"]


def _normalize_api_key(api_key: str | None) -> str | None:
    """Strip whitespace; treat blank strings as missing."""
    if api_key is None:
        return None
    stripped = api_key.strip()
    return stripped or None


class EmbeddingError(Exception):
    """Provider failed to embed text or initialize.

    Callers catch this and map it to an HTTP error response.
    """


@runtime_checkable
class EmbeddingClient(Protocol):
    """Minimal interface every embedding backend must satisfy.

    Matches LangChain clients:
      - sync:  embed_query / embed_documents
      - async: aembed_query / aembed_documents (optional — we fall back to threads)
    """

    def embed_query(self, text: str) -> list[float]: ...
    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...


class EmbeddingService:
    """Async wrapper around any EmbeddingClient.

    Prefers native ``aembed_*`` when available; otherwise runs sync methods
    via ``asyncio.to_thread`` so the FastAPI event loop stays free.
    """

    def __init__(
        self,
        client: EmbeddingClient,
        *,
        embedding_client_id: str | None = None,
        model_name: str | None = None,
        embedding_provider: str | None = None,
        embedding_dim: int | None = None,
    ) -> None:
        self.client = client
        self.embedding_client_id = embedding_client_id or str(uuid.uuid4())
        self.model_name = model_name
        self.embedding_provider = embedding_provider
        self.embedding_dim = embedding_dim
        # Enrich the open hop only — never emit a standalone success line for init.
        bind(
            embedding_client_id=self.embedding_client_id,
            model_name=model_name,
            embedding_provider=embedding_provider,
            embedding_dim=embedding_dim,
        )

    def _model_fields(self) -> dict[str, object]:
        return {
            "embedding_client_id": self.embedding_client_id,
            "model_name": self.model_name,
            "embedding_provider": self.embedding_provider,
            "embedding_dim": self.embedding_dim,
        }

    async def embed_query(self, text: str) -> list[float]:
        """Embed one search/chat query into a single vector.

        Raises EmbeddingError if ``text`` is empty or the provider fails.
        """
        if not text or not text.strip():
            raise EmbeddingError("Query text cannot be empty.")

        encoded = text.encode("utf-8")
        query_sha256 = hashlib.sha256(encoded).hexdigest()
        bind(
            **self._model_fields(),
            query_sha256=query_sha256,
            content_bytes=len(encoded),
        )
        try:
            # Prefer native async so we do not occupy a thread per call.
            if hasattr(self.client, "aembed_query") and callable(self.client.aembed_query):
                return await self.client.aembed_query(text)
            # Sync providers: move work off the event loop.
            return await asyncio.to_thread(self.client.embed_query, text)
        except Exception as e:
            note(
                **self._model_fields(),
                query_sha256=query_sha256,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise EmbeddingError(f"Failed to embed query: {e}") from e

    async def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Embed many chunks into one vector each (same order as input).

        Empty input returns ``[]`` with no API call.
        """
        if not documents:
            return []

        batch_sha256 = hashlib.sha256(
            "\n".join(documents).encode("utf-8")
        ).hexdigest()
        bind(
            **self._model_fields(),
            embedding_batch_sha256=batch_sha256,
            chunk_count=len(documents),
            content_bytes=sum(len(document) for document in documents),
        )
        try:
            if hasattr(self.client, "aembed_documents") and callable(self.client.aembed_documents):
                return await self.client.aembed_documents(documents)
            return await asyncio.to_thread(self.client.embed_documents, documents)
        except Exception as e:
            note(
                **self._model_fields(),
                embedding_batch_sha256=batch_sha256,
                chunk_count=len(documents),
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise EmbeddingError(f"Failed to embed documents: {e}") from e


class GeminiEmbeddingService(EmbeddingService):
    """Gemini-backed EmbeddingService.

    Pass the caller's ``api_key``, or set ``use_app_default=True`` to use
    ``GEMINI_API_KEY`` from Settings. A caller key wins when both are present.

    Model and output dimensions come from Settings unless overridden.
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
        elif use_app_default:
            resolved_key = _normalize_api_key(settings.gemini_api_key)
            if not resolved_key:
                note(
                    operation="embedding_client_init",
                    embedding_client_id=str(uuid.uuid4()),
                    embedding_provider="gemini",
                    error_type="EmbeddingError",
                    error_message="App default Gemini API key is not configured.",
                    outcome="error",
                )
                raise EmbeddingError(
                    "App default Gemini API key is not configured. "
                    "Set GEMINI_API_KEY or pass your own key."
                )
        else:
            note(
                operation="embedding_client_init",
                embedding_client_id=str(uuid.uuid4()),
                embedding_provider="gemini",
                error_type="EmbeddingError",
                error_message="Gemini embedding request is missing a user API key.",
                outcome="error",
            )
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
            note(
                operation="embedding_client_init",
                embedding_client_id=str(uuid.uuid4()),
                embedding_provider="gemini",
                model_name=target_model,
                embedding_dim=dim,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise EmbeddingError(f"Could not initialize GeminiEmbeddingService: {e}") from e

        super().__init__(
            client=client,
            model_name=target_model,
            embedding_provider="gemini",
            embedding_dim=dim,
        )


class OpenAIEmbeddingService(EmbeddingService):
    """OpenAI-backed EmbeddingService (e.g. text-embedding-3-small).

    Requires the caller's own OpenAI key — there is no app default.

    ``dimensions`` must match the vector column size in the DB (same rule
    as Gemini: both providers write vectors of ``settings.embedding_dim``).
    """

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        dimensions: int | None = None,
    ) -> None:
        user_key = _normalize_api_key(api_key)
        if not user_key:
            note(
                operation="embedding_client_init",
                embedding_client_id=str(uuid.uuid4()),
                embedding_provider="openai",
                error_type="EmbeddingError",
                error_message="OpenAI embedding request is missing a user API key.",
                outcome="error",
            )
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
            note(
                operation="embedding_client_init",
                embedding_client_id=str(uuid.uuid4()),
                embedding_provider="openai",
                model_name=target_model,
                embedding_dim=dim,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise EmbeddingError(f"Could not initialize OpenAIEmbeddingService: {e}") from e

        super().__init__(
            client=client,
            model_name=target_model,
            embedding_provider="openai",
            embedding_dim=dim,
        )


# ---------------------------------------------------------------------------
# Factories + FastAPI dependencies
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _app_default_gemini_embedding_service() -> GeminiEmbeddingService:
    """Cached app-default Gemini client (one instance process-wide)."""
    return GeminiEmbeddingService(use_app_default=True)


def get_gemini_embedding_service(api_key: str | None = None) -> GeminiEmbeddingService:
    """Gemini for a user key, or the cached app-default when the key is omitted."""
    if _normalize_api_key(api_key):
        return GeminiEmbeddingService(api_key=api_key)
    return _app_default_gemini_embedding_service()


def get_openai_embedding_service(api_key: str) -> OpenAIEmbeddingService:
    """OpenAI for the caller's key. Not cached — keys differ per caller."""
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

    ``api_key`` is the caller's own key. A user key wins over the app default.
    ``use_app_default`` reads ``GEMINI_API_KEY`` and is valid for Gemini only.
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
    """Shared Gemini client using the app's ``GEMINI_API_KEY``.

    Per-caller keys belong in ``create_embedding_service``. OpenAI is not
    selected here because it always needs the caller's own key.
    """
    if not _normalize_api_key(settings.gemini_api_key):
        note(
            operation="embedding_client_init",
            embedding_client_id=str(uuid.uuid4()),
            embedding_provider="gemini",
            error_type="EmbeddingError",
            error_message="App default Gemini API key is not configured.",
            outcome="error",
        )
        raise EmbeddingError(
            "App default Gemini API key is not configured. Set GEMINI_API_KEY."
        )
    return get_gemini_embedding_service()


def _gemini_embedding_service_from_request(
    api_key: Annotated[str | None, Header(alias="X-Gemini-Api-Key")] = None,
) -> GeminiEmbeddingService:
    """Route dependency: ``X-Gemini-Api-Key`` when present, else app default."""
    return get_gemini_embedding_service(api_key)


def _openai_embedding_service_from_request(
    api_key: Annotated[str, Header(alias="X-OpenAI-Api-Key")],
) -> OpenAIEmbeddingService:
    """Route dependency: caller's OpenAI key from ``X-OpenAI-Api-Key``."""
    return get_openai_embedding_service(api_key)


# Convenience aliases for route signatures: ``service: EmbeddingServiceDep``.
EmbeddingServiceDep = Annotated[EmbeddingService, Depends(get_embedding_service)]
GeminiEmbeddingServiceDep = Annotated[
    GeminiEmbeddingService, Depends(_gemini_embedding_service_from_request)
]
OpenAIEmbeddingServiceDep = Annotated[
    OpenAIEmbeddingService, Depends(_openai_embedding_service_from_request)
]


async def embed_query(text: str) -> list[float]:
    """Embed a query with the shared app-default Gemini service."""
    service = get_embedding_service(get_settings())
    return await service.embed_query(text)


async def embed_documents(documents: list[str]) -> list[list[float]]:
    """Embed many texts with the shared app-default Gemini service."""
    service = get_embedding_service(get_settings())
    return await service.embed_documents(documents)
