"""Tests for the auth router proxying Supabase Auth."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from supabase_auth.errors import AuthApiError
from supabase_auth.types import User

from router.v1.auth import AuthRouter
from services.supabase import (
    get_async_service_supabase,
    get_current_user,
    get_supabase,
)

TEST_USER_ID = "00000000-0000-0000-0000-000000000001"
TEST_EMAIL = "author@writr.app"


class _FakeQueryResult:
    def __init__(self, data: list[dict[str, Any]]) -> None:
        self.data = data


class _FakeQuery:
    def __init__(self, rows: dict[str, dict[str, Any]]) -> None:
        self._rows = rows
        self._mode = "select"
        self._filter_id: str | None = None
        self._payload: dict[str, Any] | None = None

    def select(self, _cols: str) -> _FakeQuery:
        return self

    def eq(self, key: str, value: str) -> _FakeQuery:
        if key == "id":
            self._filter_id = value
        return self

    def limit(self, _n: int) -> _FakeQuery:
        return self

    def upsert(self, payload: dict[str, Any]) -> _FakeQuery:
        self._mode = "upsert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, Any]) -> _FakeQuery:
        self._mode = "update"
        self._payload = payload
        return self

    async def execute(self) -> _FakeQueryResult:
        if self._mode == "upsert" and self._payload:
            uid = self._payload.get("id", "")
            self._rows[uid] = dict(self._payload)
            return _FakeQueryResult([dict(self._payload)])

        if self._mode == "update" and self._payload and self._filter_id:
            row = self._rows.get(self._filter_id, {"id": self._filter_id})
            row.update(self._payload)
            self._rows[self._filter_id] = row
            return _FakeQueryResult([dict(row)])

        if self._filter_id and self._filter_id in self._rows:
            return _FakeQueryResult([dict(self._rows[self._filter_id])])
        return _FakeQueryResult([])


class _FakeServiceSupabase:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {
            TEST_USER_ID: {
                "id": TEST_USER_ID,
                "author_name": "Test Author",
                "avatar_url": "",
                "updated_at": "2026-10-24T00:00:00Z",
            }
        }

    def from_(self, table: str) -> _FakeQuery:
        assert table == "profiles"
        return _FakeQuery(self.rows)


@pytest.fixture
def fake_service() -> _FakeServiceSupabase:
    return _FakeServiceSupabase()


@pytest.fixture
def fake_client() -> MagicMock:
    client = MagicMock()

    # Mock login
    mock_session = MagicMock()
    mock_session.access_token = "mock-access-token"
    mock_session.refresh_token = "mock-refresh-token"
    mock_session.token_type = "bearer"
    mock_session.expires_in = 3600
    mock_session.expires_at = 1792850000

    mock_user = MagicMock()
    mock_user.id = TEST_USER_ID
    mock_user.email = TEST_EMAIL
    mock_user.user_metadata = {"author_name": "Test Author"}
    mock_user.identities = [MagicMock()]

    mock_auth_res = MagicMock()
    mock_auth_res.session = mock_session
    mock_auth_res.user = mock_user

    client.auth.sign_in_with_password.return_value = mock_auth_res
    client.auth.sign_up.return_value = mock_auth_res
    client.auth.refresh_session.return_value = mock_auth_res

    return client


@pytest.fixture
def fake_current_user() -> User:
    return User.model_construct(
        id=TEST_USER_ID,
        email=TEST_EMAIL,
        user_metadata={"author_name": "Test Author"},
    )


@pytest.fixture
async def client(
    fake_service: _FakeServiceSupabase,
    fake_client: MagicMock,
    fake_current_user: User,
) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.include_router(AuthRouter)

    app.dependency_overrides[get_supabase] = lambda: fake_client
    app.dependency_overrides[get_async_service_supabase] = lambda: fake_service
    app.dependency_overrides[get_current_user] = lambda: fake_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/login",
        json={"email": TEST_EMAIL, "password": "password123"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["session"]["access_token"] == "mock-access-token"
    assert body["session"]["refresh_token"] == "mock-refresh-token"
    assert body["user"]["id"] == TEST_USER_ID
    assert body["profile"]["author_name"] == "Test Author"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient, fake_client: MagicMock) -> None:
    fake_client.auth.sign_in_with_password.side_effect = AuthApiError(
        message="Invalid login credentials", status=400, code="invalid_credentials"
    )
    res = await client.post(
        "/auth/login",
        json={"email": "wrong@writr.app", "password": "badpassword"},
    )
    assert res.status_code == 401
    assert "Invalid login credentials" in res.json()["detail"]


@pytest.mark.asyncio
async def test_signup_success(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/signup",
        json={
            "email": "newuser@writr.app",
            "password": "strongpassword123",
            "full_name": "New Writer",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["session"]["access_token"] == "mock-access-token"
    assert body["user"]["id"] == TEST_USER_ID
    assert body["needs_email_confirmation"] is False


@pytest.mark.asyncio
async def test_signup_duplicate_email(client: AsyncClient, fake_client: MagicMock) -> None:
    duplicate_user = MagicMock()
    duplicate_user.id = "dup-user"
    duplicate_user.identities = []  # Empty identities signals duplicate in Supabase

    dup_res = MagicMock()
    dup_res.user = duplicate_user
    dup_res.session = None

    fake_client.auth.sign_up.return_value = dup_res

    res = await client.post(
        "/auth/signup",
        json={
            "email": "exists@writr.app",
            "password": "strongpassword123",
            "full_name": "Writer",
        },
    )
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]


@pytest.mark.asyncio
async def test_refresh_session(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/refresh",
        json={"refresh_token": "valid-refresh-token"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["session"]["access_token"] == "mock-access-token"


@pytest.mark.asyncio
async def test_get_me(client: AsyncClient) -> None:
    res = await client.get("/auth/me")
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["id"] == TEST_USER_ID
    assert body["profile"]["author_name"] == "Test Author"


@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient) -> None:
    res = await client.patch(
        "/auth/profile",
        json={"author_name": "Updated Pen Name"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["author_name"] == "Updated Pen Name"


@pytest.mark.asyncio
async def test_forgot_password(client: AsyncClient) -> None:
    res = await client.post(
        "/auth/forgot-password",
        json={"email": TEST_EMAIL},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True


@pytest.mark.asyncio
async def test_logout(client: AsyncClient) -> None:
    res = await client.post("/auth/logout")
    assert res.status_code == 200
    assert res.json()["message"] == "Logged out successfully"
