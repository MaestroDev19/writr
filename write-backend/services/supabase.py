"""Supabase clients and auth helpers for the FastAPI app.

Provides:
  1. Sync / async clients with the publishable (anon) key
  2. A trusted service async client with the secret key (bypasses RLS)
  3. A per-request user async client that forwards the caller's JWT (RLS applies)
  4. ``get_current_user`` / ``get_current_user_id`` — validate Bearer JWT

Rule of thumb:
  - User-facing reads/writes that should respect RLS → AsyncUserSupabaseDep
  - Trusted backend writes after you already checked auth → AsyncServiceSupabaseDep
    (always filter by owner yourself when using the service client)
"""

import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import AsyncClient, AsyncClientOptions, Client, create_async_client, create_client
from supabase_auth.errors import AuthApiError
from supabase_auth.types import User

from core.config import get_settings
from utils.log import bind, note, scrub

settings = get_settings()


def _get_supabase_credentials(role: str = "publishable") -> tuple[str, str]:
    """Return ``(url, key)``; ``role="admin"`` selects the secret key."""
    url = settings.supabase_url
    key = settings.supabase_admin_key if role == "admin" else settings.supabase_api_key
    if not url or not key:
        raise ValueError(f"Supabase URL and {role} key must be set in environment variables.")
    return url, key


# ---------------------------------------------------------------------------
# Module-level singletons (created once, reused across requests)
# ---------------------------------------------------------------------------

_supabase_client: Client | None = None
_async_supabase_client: AsyncClient | None = None
_async_service_supabase_client: AsyncClient | None = None

# Eager sync client when credentials exist at import; otherwise lazy init later.
try:
    _url, _key = _get_supabase_credentials()
    _supabase_client = create_client(_url, _key)
    bind(
        supabase_client_id=str(uuid.uuid4()),
        client_kind="sync_publishable",
    )
except Exception as _e:
    note(
        operation="supabase_client_init",
        supabase_client_id=str(uuid.uuid4()),
        client_kind="sync_publishable",
        error_type=type(_e).__name__,
        error_message=scrub(str(_e)),
        outcome="error",
    )

# Scripts/notebooks: ``from services.supabase import supabase``.
supabase: Client | None = _supabase_client


# ---------------------------------------------------------------------------
# Publishable-key clients (anon / frontend-equivalent privileges)
# ---------------------------------------------------------------------------

def get_supabase() -> Client:
    """FastAPI dependency: synchronous Supabase client (publishable key).

    Usage:
        @router.get("/items")
        def read_items(supabase: SupabaseDep):
            ...
    """
    global _supabase_client
    if _supabase_client is None:
        # Credentials may arrive after import (late .env load).
        try:
            url, key = _get_supabase_credentials()
            _supabase_client = create_client(url, key)
            bind(
                supabase_client_id=str(uuid.uuid4()),
                client_kind="sync_publishable",
            )
        except Exception as e:
            note(
                operation="supabase_client_init",
                supabase_client_id=str(uuid.uuid4()),
                client_kind="sync_publishable",
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase client not initialized: {e}",
            ) from e
    return _supabase_client


async def get_async_supabase() -> AsyncClient:
    """FastAPI dependency: asynchronous Supabase client (publishable key).

    Prefer this over the sync client inside ``async def`` routes so DB/auth
    calls do not block the event loop.

    Usage:
        @router.get("/items")
        async def read_items(supabase: AsyncSupabaseDep):
            ...
    """
    global _async_supabase_client
    if _async_supabase_client is None:
        try:
            url, key = _get_supabase_credentials()
            _async_supabase_client = await create_async_client(url, key)
            bind(
                supabase_client_id=str(uuid.uuid4()),
                client_kind="async_publishable",
            )
        except Exception as e:
            note(
                operation="supabase_client_init",
                supabase_client_id=str(uuid.uuid4()),
                client_kind="async_publishable",
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase async client not initialized: {e}",
            ) from e
    return _async_supabase_client


# Route signature helpers: ``client: SupabaseDep``.
SupabaseDep = Annotated[Client, Depends(get_supabase)]
SupabaseClient = SupabaseDep  # alias kept for older imports

AsyncSupabaseDep = Annotated[AsyncClient, Depends(get_async_supabase)]
AsyncSupabaseClient = AsyncSupabaseDep

# auto_error=False so we raise our own 401 with a clearer message.
_bearer_security = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Auth: turn Bearer JWT into a Supabase User
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_security)],
    client: SupabaseDep,
) -> User:
    """Validate the request's Bearer JWT and return the authenticated User.

    Flow:
      1. Require an Authorization header with a token.
      2. Ask Supabase Auth to resolve that token to a user.
      3. Map auth failures → HTTP 401.

    Usage:
        @router.get("/profile")
        def get_profile(user: CurrentUserDep):
            return {"user_id": user.id, "email": user.email}
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        user_response = client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        bind(user_id=str(user_response.user.id) if user_response.user.id else None)
        return user_response.user
    except AuthApiError as e:
        # Never log the token; scrub provider text in case it echoes credentials.
        bind(
            operation="auth_get_user",
            error_type=type(e).__name__,
            error_message=scrub(getattr(e, "message", None) or str(e)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication token: {e.message}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except Exception as e:
        bind(
            operation="auth_get_user",
            error_type=type(e).__name__,
            error_message=scrub(str(e)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


CurrentUserDep = Annotated[User, Depends(get_current_user)]
CurrentUser = CurrentUserDep  # alias kept for older imports


def get_current_user_id(user: CurrentUserDep) -> str:
    """Authenticated user UUID for routes that only need ``owner_id``.

    Usage:
        @router.post("/notes")
        async def create_note(user_id: CurrentUserIdDep):
            ...
    """
    if not user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user has no id",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return str(user.id)


CurrentUserIdDep = Annotated[str, Depends(get_current_user_id)]
CurrentUserId = CurrentUserIdDep  # alias kept for older imports


# ---------------------------------------------------------------------------
# Secret-key (service) client — bypasses RLS; backend-only
# ---------------------------------------------------------------------------

def _get_secret_key() -> str:
    """Backend-only admin key.

    Prefer the new ``sb_secret_…`` style key; fall back to the legacy
    JWT ``service_role`` key via Settings.supabase_admin_key.
    """
    key = get_settings().supabase_admin_key
    if not key:
        note(
            operation="supabase_client_init",
            supabase_client_id=str(uuid.uuid4()),
            client_kind="async_service",
            error_type="MissingSecret",
            error_message="Supabase secret key is not configured.",
            outcome="error",
        )
        raise ValueError("SUPABASE_SECRET_KEY must be set in environment variables.")
    return key


async def get_async_service_supabase() -> AsyncClient:
    """Trusted backend async client (secret key — RLS does not apply).

    Use only *after* you have authenticated the user yourself, and always
    scope writes by ``owner`` / ``user_id`` in application code.

    Session persistence is disabled: this client is a long-lived singleton,
    not a logged-in end user.
    """
    global _async_service_supabase_client
    if _async_service_supabase_client is None:
        try:
            url, _publishable_key = _get_supabase_credentials()
            secret_key = _get_secret_key()
            _async_service_supabase_client = await create_async_client(
                url,
                secret_key,
                options=AsyncClientOptions(
                    persist_session=False,  # server process, not an end-user login
                    auto_refresh_token=False,
                ),
            )
            bind(
                supabase_client_id=str(uuid.uuid4()),
                client_kind="async_service",
            )
        except Exception as e:
            note(
                operation="supabase_client_init",
                supabase_client_id=str(uuid.uuid4()),
                client_kind="async_service",
                error_type=type(e).__name__,
                error_message=scrub(str(e)),
                outcome="error",
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase service client not initialized: {e}",
            ) from e
    return _async_service_supabase_client


# ---------------------------------------------------------------------------
# Per-request user client — JWT forwarded so Postgres RLS applies
# ---------------------------------------------------------------------------

async def get_async_user_supabase(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_security)],
) -> AsyncIterator[AsyncClient]:
    """Yield a fresh async client stamped with the caller's Bearer JWT.

    Because the JWT is sent on every request, Supabase/Postgres Row Level
    Security policies see ``auth.uid()`` and can restrict rows automatically.

    This is a *generator* dependency (``yield``) so FastAPI can create the
    client for the request and discard it afterward.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        url, key = _get_supabase_credentials()
        client = await create_async_client(
            url,
            key,
            options=AsyncClientOptions(
                persist_session=False,
                auto_refresh_token=False,
                # JWT + apikey on every call so Postgres RLS sees auth.uid().
                headers={
                    "Authorization": f"Bearer {credentials.credentials}",
                    "apikey": key,
                },
            ),
        )
    except Exception as e:
        bind(
            operation="supabase_client_init",
            supabase_client_id=str(uuid.uuid4()),
            client_kind="async_user",
            error_type=type(e).__name__,
            error_message=scrub(str(e)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase user client not initialized: {e}",
        ) from e
    yield client


AsyncServiceSupabaseDep = Annotated[AsyncClient, Depends(get_async_service_supabase)]
AsyncUserSupabaseDep = Annotated[AsyncClient, Depends(get_async_user_supabase)]
