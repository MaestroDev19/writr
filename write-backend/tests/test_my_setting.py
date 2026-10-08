"""Settings routes: Write and Review save independently on one user row."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from router.v1.mySetting import MySettingRouter
from services.supabase import get_async_service_supabase, get_current_user_id

USER_ID = "user-1"


class _Result:
    def __init__(self, data: list[dict]) -> None:
        self.data = data


class _Query:
    def __init__(self, rows: dict[str, dict]) -> None:
        self._rows = rows
        self._payload: dict | None = None
        self._user_id: str | None = None
        self._mode = "select"

    def upsert(self, payload: dict, on_conflict: str | None = None) -> _Query:
        self._mode = "upsert"
        self._payload = payload
        return self

    def select(self, _columns: str) -> _Query:
        return self

    def eq(self, key: str, value: str) -> _Query:
        if key == "user_id":
            self._user_id = value
        return self

    def limit(self, _count: int) -> _Query:
        return self

    async def execute(self) -> _Result:
        if self._mode == "upsert":
            assert self._payload is not None
            user_id = self._payload["user_id"]
            row = self._rows.get(user_id, {"id": "row-1", "user_id": user_id})
            row.update(self._payload)
            self._rows[user_id] = row
            return _Result([row])
        row = self._rows.get(self._user_id or "")
        return _Result([row] if row else [])


class FakeSupabase:
    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}

    def table(self, name: str) -> _Query:
        assert name == "user_settings"
        return _Query(self.rows)


@pytest.fixture
def store() -> FakeSupabase:
    return FakeSupabase()


@pytest.fixture
async def client(store: FakeSupabase) -> AsyncIterator[AsyncClient]:
    app = FastAPI()
    app.include_router(MySettingRouter)
    app.dependency_overrides[get_current_user_id] = lambda: USER_ID

    async def override_db() -> FakeSupabase:
        return store

    app.dependency_overrides[get_async_service_supabase] = override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


@pytest.mark.asyncio
async def test_get_is_empty_before_save(client: AsyncClient) -> None:
    response = await client.get("/mySetting/")
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == USER_ID
    assert body["model_name"] is None
    assert body["generate"]["temperature"] is None
    assert body["critique"]["temperature"] is None


@pytest.mark.asyncio
async def test_generate_and_critique_do_not_overwrite_each_other(
    client: AsyncClient,
    store: FakeSupabase,
) -> None:
    generate = await client.post(
        "/mySetting/generate",
        json={
            "model_name": "gemini-3.8-flash",
            "system_prompt": "Write plainly.",
            "temperature": 0.7,
            "max_tokens": 2048,
            "top_p": 0.9,
            "frequency_penalty": 1.1,
            "context_chunks": 5,
        },
    )
    assert generate.status_code == 200
    assert generate.json()["temperature"] == 0.7
    assert generate.json()["model_name"] == "gemini-3.8-flash"

    critique = await client.post(
        "/mySetting/critique",
        json={
            "system_prompt": "Review tightly.",
            "temperature": 0.3,
            "max_tokens": 1536,
            "top_p": 0.8,
            "frequency_penalty": 1.0,
            "context_chunks": 4,
        },
    )
    assert critique.status_code == 200
    assert critique.json()["temperature"] == 0.3
    assert critique.json()["model_name"] == "gemini-3.8-flash"

    row = store.rows[USER_ID]
    assert row["generate_temperature"] == 0.7
    assert row["critique_temperature"] == 0.3
    assert row["generate_system_prompt"] == "Write plainly."
    assert "temperature" not in row

    loaded = await client.get("/mySetting/")
    assert loaded.status_code == 200
    saved = loaded.json()
    assert saved["generate"]["context_chunks"] == 5
    assert saved["critique"]["context_chunks"] == 4
    assert saved["model_name"] == "gemini-3.8-flash"


@pytest.mark.asyncio
async def test_empty_update_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/mySetting/generate", json={})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_out_of_range_temperature_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/mySetting/critique", json={"temperature": 3})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_unknown_model_is_rejected(client: AsyncClient) -> None:
    response = await client.post(
        "/mySetting/generate",
        json={"model_name": "gemini-2.5-pro"},
    )
    assert response.status_code == 422
