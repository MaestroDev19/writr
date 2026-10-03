"""Chat LLM helpers for generate / critique.

Providers:
  - Gemini — caller's key when provided; otherwise the app default
    (``GEMINI_API_KEY``). This is the Writr-hosted chat model.
  - OpenAI / Groq / OpenRouter — caller's key only (no app default)

Default path (no frontend key): Gemini + ``settings.gemini_chat_model``.
"""

from __future__ import annotations

import uuid
from functools import lru_cache
from typing import Annotated, Any, Literal

from fastapi import Depends, Header
from langchain_google_genai import ChatGoogleGenerativeAI

from core.config import SettingsDep, get_settings
from utils.log import bind, note, scrub

ChatProvider = Literal["gemini", "openai", "groq", "openrouter"]

_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def _normalize_api_key(api_key: str | None) -> str | None:
    """Strip whitespace; treat blank strings as missing."""
    if api_key is None:
        return None
    stripped = api_key.strip()
    return stripped or None


class LLMError(Exception):
    """Provider failed to initialize a chat model.

    Callers catch this and map it to an HTTP error response.
    """


class ChatService:
    """Thin wrapper around a LangChain chat model with identity metadata."""

    def __init__(
        self,
        client: Any,
        *,
        chat_client_id: str | None = None,
        model_name: str | None = None,
        chat_provider: str | None = None,
    ) -> None:
        self.client = client
        self.chat_client_id = chat_client_id or str(uuid.uuid4())
        self.model_name = model_name
        self.chat_provider = chat_provider
        bind(
            chat_client_id=self.chat_client_id,
            model_name=model_name,
            chat_provider=chat_provider,
        )


class GeminiChatService(ChatService):
    """Gemini-backed chat client.

    Pass the caller's ``api_key`` to override, otherwise use
    ``GEMINI_API_KEY`` from Settings (Writr-hosted default).
    """

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        *,
        use_app_default: bool = True,
        **model_kwargs: Any,
    ) -> None:
        settings = get_settings()
        user_key = _normalize_api_key(api_key)
        if user_key:
            resolved_key = user_key
        elif use_app_default:
            resolved_key = _normalize_api_key(settings.gemini_api_key)
            if not resolved_key:
                note(
                    operation="chat_client_init",
                    chat_client_id=str(uuid.uuid4()),
                    chat_provider="gemini",
                    error_type="LLMError",
                    error_message="App default Gemini API key is not configured.",
                    outcome="error",
                )
                raise LLMError(
                    "App default Gemini API key is not configured. "
                    "Set GEMINI_API_KEY or pass your own key."
                )
        else:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="gemini",
                error_type="LLMError",
                error_message="Gemini chat request is missing a user API key.",
                outcome="error",
            )
            raise LLMError(
                "A Gemini API key is required. Pass your own key, "
                "or leave use_app_default=True to use the app key."
            )

        target_model = model or settings.gemini_chat_model
        try:
            client = ChatGoogleGenerativeAI(
                model=target_model,
                google_api_key=resolved_key,
                **model_kwargs,
            )
        except Exception as e:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="gemini",
                model_name=target_model,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise LLMError(f"Could not initialize GeminiChatService: {e}") from e

        super().__init__(
            client=client,
            model_name=target_model,
            chat_provider="gemini",
        )


class OpenAIChatService(ChatService):
    """OpenAI-backed chat client. Requires the caller's own key."""

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        **model_kwargs: Any,
    ) -> None:
        user_key = _normalize_api_key(api_key)
        if not user_key:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="openai",
                error_type="LLMError",
                error_message="OpenAI chat request is missing a user API key.",
                outcome="error",
            )
            raise LLMError("OpenAI chat requires your own API key.")

        target_model = model or "gpt-4o-mini"
        try:
            from langchain_openai import ChatOpenAI

            client = ChatOpenAI(
                model=target_model,
                api_key=user_key,
                **model_kwargs,
            )
        except Exception as e:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="openai",
                model_name=target_model,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise LLMError(f"Could not initialize OpenAIChatService: {e}") from e

        super().__init__(
            client=client,
            model_name=target_model,
            chat_provider="openai",
        )


class GroqChatService(ChatService):
    """Groq-backed chat client. Requires the caller's own key."""

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        **model_kwargs: Any,
    ) -> None:
        user_key = _normalize_api_key(api_key)
        if not user_key:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="groq",
                error_type="LLMError",
                error_message="Groq chat request is missing a user API key.",
                outcome="error",
            )
            raise LLMError("Groq chat requires your own API key.")

        target_model = model or "llama-3.3-70b-versatile"
        try:
            from langchain_groq import ChatGroq

            client = ChatGroq(
                model=target_model,
                api_key=user_key,
                **model_kwargs,
            )
        except Exception as e:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="groq",
                model_name=target_model,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise LLMError(f"Could not initialize GroqChatService: {e}") from e

        super().__init__(
            client=client,
            model_name=target_model,
            chat_provider="groq",
        )


class OpenRouterChatService(ChatService):
    """OpenRouter-backed chat client (OpenAI-compatible). Requires caller's key."""

    def __init__(
        self,
        api_key: str,
        model: str | None = None,
        **model_kwargs: Any,
    ) -> None:
        user_key = _normalize_api_key(api_key)
        if not user_key:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="openrouter",
                error_type="LLMError",
                error_message="OpenRouter chat request is missing a user API key.",
                outcome="error",
            )
            raise LLMError("OpenRouter chat requires your own API key.")

        target_model = model or "openrouter/auto"
        try:
            from langchain_openai import ChatOpenAI

            client = ChatOpenAI(
                model=target_model,
                api_key=user_key,
                base_url=_OPENROUTER_BASE_URL,
                **model_kwargs,
            )
        except Exception as e:
            note(
                operation="chat_client_init",
                chat_client_id=str(uuid.uuid4()),
                chat_provider="openrouter",
                model_name=target_model,
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise LLMError(f"Could not initialize OpenRouterChatService: {e}") from e

        super().__init__(
            client=client,
            model_name=target_model,
            chat_provider="openrouter",
        )


@lru_cache(maxsize=1)
def _app_default_gemini_chat_service() -> GeminiChatService:
    """Cached app-default Gemini chat client (one instance process-wide)."""
    return GeminiChatService(use_app_default=True)


def get_gemini_chat_service(api_key: str | None = None) -> GeminiChatService:
    """Gemini for a user key, or the cached app-default when the key is omitted."""
    if _normalize_api_key(api_key):
        return GeminiChatService(api_key=api_key)
    return _app_default_gemini_chat_service()


def create_chat_service(
    provider: ChatProvider = "gemini",
    api_key: str | None = None,
    *,
    use_app_default: bool = True,
    model: str | None = None,
    **model_kwargs: Any,
) -> ChatService:
    """Build a chat client for one caller.

    Default provider is Gemini. With no caller key, Gemini uses
    ``GEMINI_API_KEY``. Other providers always need the caller's own key.
    """
    if provider == "gemini":
        return GeminiChatService(
            api_key=api_key,
            model=model,
            use_app_default=use_app_default,
            **model_kwargs,
        )
    if provider == "openai":
        if use_app_default and not _normalize_api_key(api_key):
            raise LLMError(
                "The app default chat key is available for Gemini only. "
                "Pass your own OpenAI API key."
            )
        return OpenAIChatService(api_key=api_key or "", model=model, **model_kwargs)
    if provider == "groq":
        if use_app_default and not _normalize_api_key(api_key):
            raise LLMError(
                "The app default chat key is available for Gemini only. "
                "Pass your own Groq API key."
            )
        return GroqChatService(api_key=api_key or "", model=model, **model_kwargs)
    if provider == "openrouter":
        if use_app_default and not _normalize_api_key(api_key):
            raise LLMError(
                "The app default chat key is available for Gemini only. "
                "Pass your own OpenRouter API key."
            )
        return OpenRouterChatService(
            api_key=api_key or "", model=model, **model_kwargs
        )
    raise LLMError(f"Unsupported chat provider '{provider}'.")


def get_chat_service(settings: SettingsDep) -> ChatService:
    """Shared Gemini chat client using the app's ``GEMINI_API_KEY``."""
    if not _normalize_api_key(settings.gemini_api_key):
        note(
            operation="chat_client_init",
            chat_client_id=str(uuid.uuid4()),
            chat_provider="gemini",
            error_type="LLMError",
            error_message="App default Gemini API key is not configured.",
            outcome="error",
        )
        raise LLMError(
            "App default Gemini API key is not configured. Set GEMINI_API_KEY."
        )
    return get_gemini_chat_service()


def _gemini_chat_service_from_request(
    api_key: Annotated[str | None, Header(alias="X-Gemini-Api-Key")] = None,
) -> GeminiChatService:
    """Route dependency: ``X-Gemini-Api-Key`` when present, else app default."""
    return get_gemini_chat_service(api_key)


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]
GeminiChatServiceDep = Annotated[
    GeminiChatService, Depends(_gemini_chat_service_from_request)
]
