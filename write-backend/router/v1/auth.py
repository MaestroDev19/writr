"""Authentication router for Writr.

Proxies Supabase Auth through the Writr backend so client apps (such as the desktop app)
do not need to bundle public or private Supabase API keys.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from supabase_auth.errors import AuthApiError

from core.limiter import limiter
from services.supabase import (
    AsyncServiceSupabaseDep,
    CurrentUserDep,
    SupabaseDep,
    _bearer_security,
)
from utils.log import bind, scrub

AuthRouter = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: EmailStr
    password: str = Field(min_length=1)


class SignupRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2, max_length=100)


class RefreshRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    refresh_token: str = Field(min_length=1)


class ForgotPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    email: EmailStr


class UpdateProfileRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    author_name: str | None = Field(default=None, min_length=2, max_length=100)
    avatar_url: str | None = None


class SessionData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int | None = None
    expires_at: int | None = None


class UserData(BaseModel):
    id: str
    email: str | None = None
    user_metadata: dict[str, Any] = {}


class UserProfile(BaseModel):
    id: str
    author_name: str | None = None
    avatar_url: str | None = None
    updated_at: str | None = None


class AuthResponse(BaseModel):
    session: SessionData | None = None
    user: UserData | None = None
    profile: UserProfile | None = None
    needs_email_confirmation: bool = False


class MeResponse(BaseModel):
    user: UserData
    profile: UserProfile | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_profile(
    service_client: AsyncServiceSupabaseDep,
    user_id: str,
    user_metadata: dict[str, Any] | None = None,
    email: str | None = None,
) -> UserProfile:
    """Fetch user profile from the database or create a fallback profile row."""
    meta = user_metadata or {}
    try:
        res = (
            await service_client.from_("profiles")
            .select("id, author_name, avatar_url, updated_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            row = res.data[0]
            return UserProfile(
                id=row["id"],
                author_name=row.get("author_name"),
                avatar_url=row.get("avatar_url"),
                updated_at=row.get("updated_at"),
            )
    except Exception as exc:
        bind(profile_lookup_error=scrub(str(exc)))

    author_name = (
        meta.get("author_name")
        or meta.get("full_name")
        or (email.split("@")[0] if email else "Author")
    )
    avatar_url = meta.get("avatar_url") or ""
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        upsert_res = (
            await service_client.from_("profiles")
            .upsert(
                {
                    "id": user_id,
                    "author_name": author_name,
                    "avatar_url": avatar_url,
                    "updated_at": now_iso,
                }
            )
            .execute()
        )
        if upsert_res.data and len(upsert_res.data) > 0:
            row = upsert_res.data[0]
            return UserProfile(
                id=row["id"],
                author_name=row.get("author_name"),
                avatar_url=row.get("avatar_url"),
                updated_at=row.get("updated_at"),
            )
    except Exception as exc:
        bind(profile_upsert_error=scrub(str(exc)))

    return UserProfile(
        id=user_id,
        author_name=author_name,
        avatar_url=avatar_url,
        updated_at=now_iso,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@AuthRouter.post("/login", response_model=AuthResponse)
@limiter.limit("20/minute")
async def login(
    request: Request,
    payload: LoginRequest,
    client: SupabaseDep,
    service_client: AsyncServiceSupabaseDep,
) -> AuthResponse:
    """Authenticate with email and password via backend."""
    try:
        auth_res = client.auth.sign_in_with_password(
            {"email": payload.email, "password": payload.password}
        )
    except AuthApiError as exc:
        bind(
            operation="auth_login",
            error_type=type(exc).__name__,
            error_message=scrub(getattr(exc, "message", str(exc))),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=getattr(exc, "message", "Invalid login credentials"),
        ) from exc
    except Exception as exc:
        bind(
            operation="auth_login",
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication failed. Please try again later.",
        ) from exc

    if not auth_res or not auth_res.session or not auth_res.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or session not established",
        )

    user_obj = auth_res.user
    session_obj = auth_res.session

    profile = await _get_or_create_profile(
        service_client,
        str(user_obj.id),
        getattr(user_obj, "user_metadata", None),
        getattr(user_obj, "email", None),
    )

    return AuthResponse(
        session=SessionData(
            access_token=session_obj.access_token,
            refresh_token=session_obj.refresh_token,
            token_type=getattr(session_obj, "token_type", "bearer") or "bearer",
            expires_in=getattr(session_obj, "expires_in", None),
            expires_at=getattr(session_obj, "expires_at", None),
        ),
        user=UserData(
            id=str(user_obj.id),
            email=getattr(user_obj, "email", None),
            user_metadata=getattr(user_obj, "user_metadata", {}) or {},
        ),
        profile=profile,
        needs_email_confirmation=False,
    )


@AuthRouter.post("/signup", response_model=AuthResponse)
@limiter.limit("10/minute")
async def signup(
    request: Request,
    payload: SignupRequest,
    client: SupabaseDep,
    service_client: AsyncServiceSupabaseDep,
) -> AuthResponse:
    """Register a new author account."""
    try:
        auth_res = client.auth.sign_up(
            {
                "email": payload.email,
                "password": payload.password,
                "options": {
                    "data": {
                        "author_name": payload.full_name,
                        "full_name": payload.full_name,
                    }
                },
            }
        )
    except AuthApiError as exc:
        bind(
            operation="auth_signup",
            error_type=type(exc).__name__,
            error_message=scrub(getattr(exc, "message", str(exc))),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=getattr(exc, "message", "Sign up failed"),
        ) from exc
    except Exception as exc:
        bind(
            operation="auth_signup",
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Sign up failed. Please try again later.",
        ) from exc

    if not auth_res or not auth_res.user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create user account",
        )

    user_obj = auth_res.user

    # Supabase returns empty identities list when email is already registered
    identities = getattr(user_obj, "identities", None)
    if identities is not None and len(identities) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists. Please log in.",
        )

    session_obj = auth_res.session
    needs_confirm = session_obj is None

    profile: UserProfile | None = None
    if not needs_confirm and session_obj:
        profile = await _get_or_create_profile(
            service_client,
            str(user_obj.id),
            {"author_name": payload.full_name, "full_name": payload.full_name},
            payload.email,
        )

    return AuthResponse(
        session=SessionData(
            access_token=session_obj.access_token,
            refresh_token=session_obj.refresh_token,
            token_type=getattr(session_obj, "token_type", "bearer") or "bearer",
            expires_in=getattr(session_obj, "expires_in", None),
            expires_at=getattr(session_obj, "expires_at", None),
        )
        if session_obj
        else None,
        user=UserData(
            id=str(user_obj.id),
            email=getattr(user_obj, "email", None),
            user_metadata=getattr(user_obj, "user_metadata", {}) or {},
        ),
        profile=profile,
        needs_email_confirmation=needs_confirm,
    )


@AuthRouter.post("/refresh", response_model=AuthResponse)
@limiter.limit("30/minute")
async def refresh_session(
    request: Request,
    payload: RefreshRequest,
    client: SupabaseDep,
    service_client: AsyncServiceSupabaseDep,
) -> AuthResponse:
    """Exchange a valid refresh token for a fresh access token."""
    try:
        auth_res = client.auth.refresh_session(payload.refresh_token)
    except AuthApiError as exc:
        bind(
            operation="auth_refresh",
            error_type=type(exc).__name__,
            error_message=scrub(getattr(exc, "message", str(exc))),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=getattr(exc, "message", "Session expired or invalid refresh token"),
        ) from exc
    except Exception as exc:
        bind(
            operation="auth_refresh",
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to refresh session",
        ) from exc

    if not auth_res or not auth_res.session or not auth_res.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session refresh did not yield a valid session",
        )

    user_obj = auth_res.user
    session_obj = auth_res.session

    profile = await _get_or_create_profile(
        service_client,
        str(user_obj.id),
        getattr(user_obj, "user_metadata", None),
        getattr(user_obj, "email", None),
    )

    return AuthResponse(
        session=SessionData(
            access_token=session_obj.access_token,
            refresh_token=session_obj.refresh_token,
            token_type=getattr(session_obj, "token_type", "bearer") or "bearer",
            expires_in=getattr(session_obj, "expires_in", None),
            expires_at=getattr(session_obj, "expires_at", None),
        ),
        user=UserData(
            id=str(user_obj.id),
            email=getattr(user_obj, "email", None),
            user_metadata=getattr(user_obj, "user_metadata", {}) or {},
        ),
        profile=profile,
        needs_email_confirmation=False,
    )


@AuthRouter.get("/me", response_model=MeResponse)
async def get_me(
    user: CurrentUserDep,
    service_client: AsyncServiceSupabaseDep,
) -> MeResponse:
    """Fetch current user details and latest database profile."""
    profile = await _get_or_create_profile(
        service_client,
        str(user.id),
        getattr(user, "user_metadata", None),
        getattr(user, "email", None),
    )

    return MeResponse(
        user=UserData(
            id=str(user.id),
            email=getattr(user, "email", None),
            user_metadata=getattr(user, "user_metadata", {}) or {},
        ),
        profile=profile,
    )


@AuthRouter.patch("/profile", response_model=UserProfile)
async def update_profile(
    payload: UpdateProfileRequest,
    user: CurrentUserDep,
    client: SupabaseDep,
    service_client: AsyncServiceSupabaseDep,
) -> UserProfile:
    """Update author name or avatar in database and user metadata."""
    now_iso = datetime.now(timezone.utc).isoformat()
    update_data: dict[str, Any] = {"updated_at": now_iso}

    if payload.author_name is not None:
        update_data["author_name"] = payload.author_name
    if payload.avatar_url is not None:
        update_data["avatar_url"] = payload.avatar_url

    try:
        res = (
            await service_client.from_("profiles")
            .update(update_data)
            .eq("id", str(user.id))
            .execute()
        )
        if not res.data:
            # Fallback upsert if record did not exist
            upsert_data = {
                "id": str(user.id),
                "author_name": payload.author_name or "Author",
                "avatar_url": payload.avatar_url or "",
                "updated_at": now_iso,
            }
            res = await service_client.from_("profiles").upsert(upsert_data).execute()

        updated_row = res.data[0] if res.data else update_data
        updated_profile = UserProfile(
            id=str(user.id),
            author_name=updated_row.get("author_name") or payload.author_name,
            avatar_url=updated_row.get("avatar_url") or payload.avatar_url,
            updated_at=updated_row.get("updated_at") or now_iso,
        )
    except Exception as exc:
        bind(profile_update_error=scrub(str(exc)))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        ) from exc

    # Sync author_name into auth user_metadata if admin client is available
    if payload.author_name is not None:
        try:
            admin_client = getattr(client.auth, "admin", None)
            if admin_client:
                existing_meta = getattr(user, "user_metadata", {}) or {}
                admin_client.update_user_by_id(
                    str(user.id),
                    {
                        "user_metadata": {
                            **existing_meta,
                            "author_name": payload.author_name,
                            "full_name": payload.author_name,
                        }
                    },
                )
        except Exception:
            # Metadata update failure shouldn't fail the primary profile update
            pass

    return updated_profile


@AuthRouter.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    client: SupabaseDep,
) -> dict[str, Any]:
    """Trigger password reset email."""
    try:
        client.auth.reset_password_for_email(payload.email)
    except Exception:
        # Don't leak whether email exists
        pass
    return {
        "success": True,
        "message": "If this email address is registered, password reset instructions will be sent.",
    }


@AuthRouter.post("/logout")
async def logout(
    credentials: Annotated[Any, Depends(_bearer_security)],
    client: SupabaseDep,
) -> dict[str, str]:
    """Sign out the current user and invalidate the session."""
    try:
        client.auth.sign_out()
    except Exception:
        pass
    return {"message": "Logged out successfully"}
