"""One canonical wide event per HTTP request or background job.

Handlers and services call ``bind`` / ``note``. Only this module emits, and
only once, when the request or job finishes.

High-cardinality identifiers stay top-level so a single line can be queried
by request, user, document, job, or chunk. Lower-cardinality facts are grouped
under ``business``, ``http``, ``error``, and ``env``.
"""

from __future__ import annotations

import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token
from datetime import datetime, timezone
from typing import Any

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from utils.log import emit, environment_fields, scrub

_current: ContextVar[dict[str, Any] | None] = ContextVar("writr_wide_event", default=None)

# Identifiers. These are the fields you filter on for one request or user.
_ID_KEYS: tuple[str, ...] = (
    "event_id",
    "span_id",
    "request_id",
    "parent_request_id",
    "user_id",
    "document_id",
    "job_id",
    "chunk_id",
    "worker_id",
    "embedding_client_id",
    "supabase_client_id",
    "content_sha256",
    "source_digest",
    "query_sha256",
    "embedding_batch_sha256",
    "client_ip",
    "client_port",
    "lost_document_id",
    "lost_lock_job_id",
    "session_id",
)
_ID_LIST_KEYS: tuple[str, ...] = ("chunk_ids", "child_job_ids")

# Skill canonical names that stay flat on the line.
_CANONICAL_KEYS: tuple[str, ...] = (
    "timestamp",
    "duration_ms",
    "outcome",
    "operation",
    "status_code",
)

_HTTP_KEYS: tuple[str, ...] = (
    "method",
    "path",
    "route",
    "status_code",
    "user_agent",
)

_BUSINESS_KEYS: tuple[str, ...] = (
    "job_type",
    "source_type",
    "job_status",
    "chunk_count",
    "document_count",
    "content_bytes",
    "model_name",
    "embedding_provider",
    "embedding_dim",
    "attempts",
    "queue_result",
    "retry_scheduled",
    "heartbeat_ok",
    "heartbeat_count",
    "lock_lost",
    "embedding_count",
    "inserted_count",
    "mime_hint",
    "failure_stage",
    "rate_limited",
    "delay_seconds",
    "client_kind",
    "available_at",
)

_KNOWN_KEYS = (
    set(_ID_KEYS)
    | set(_ID_LIST_KEYS)
    | set(_CANONICAL_KEYS)
    | set(_HTTP_KEYS)
    | set(_BUSINESS_KEYS)
    | {"error_type", "error_message", "db_code", "user_agent", "route"}
)


def _present(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str) and not value.strip():
        return False
    if isinstance(value, (list, tuple, dict)) and len(value) == 0:
        return False
    return True


def current_event() -> dict[str, Any] | None:
    """Return the wide event for this request or job, if one is open."""
    return _current.get()


def current_request_id() -> str | None:
    """Return the request id to propagate onto queue payloads and downstream hops."""
    event = _current.get()
    if event is None:
        return None
    request_id = event.get("request_id")
    if not isinstance(request_id, str) or not request_id.strip():
        return None
    return request_id


def bind(**fields: Any) -> None:
    """Merge business context into the open wide event. No emission."""
    event = _current.get()
    if event is None:
        return
    for key, value in fields.items():
        if not _present(value):
            continue
        event[key] = value


def note(**fields: Any) -> None:
    """Attach fields to the open event, or emit one event when none is open.

    Startup and other out-of-request work has no middleware event. In that
    case this emits a single wide event. Inside a request or job it only
    binds, so the request still produces one line.
    """
    if _current.get() is None:
        with wide_event_scope(**fields):
            return
    bind(**fields)


def start_wide_event(**fields: Any) -> dict[str, Any]:
    """Build a new event dict. Does not emit and does not push the context."""
    event: dict[str, Any] = {
        "event_id": str(uuid.uuid4()),
        "span_id": str(uuid.uuid4()),
    }
    request_id = fields.get("request_id")
    event["request_id"] = str(request_id) if _present(request_id) else str(uuid.uuid4())
    for key, value in fields.items():
        if key == "request_id" or not _present(value):
            continue
        event[key] = value
    return event


def finalize_wide_event(event: dict[str, Any]) -> dict[str, Any]:
    """Shape a flat working dict into the canonical wide-event line."""
    line: dict[str, Any] = {}
    for key in (*_ID_KEYS, *_ID_LIST_KEYS, *_CANONICAL_KEYS):
        value = event.get(key)
        if _present(value):
            line[key] = value

    http = {
        key: event[key]
        for key in _HTTP_KEYS
        if key in event and _present(event[key])
    }
    if http:
        line["http"] = http

    business = {
        key: event[key]
        for key in _BUSINESS_KEYS
        if key in event and _present(event[key])
    }
    if business:
        line["business"] = business

    error: dict[str, Any] = {}
    error_type = event.get("error_type")
    error_message = event.get("error_message")
    db_code = event.get("db_code")
    if _present(error_type):
        error["type"] = error_type
    if _present(error_message):
        error["message"] = scrub(error_message)
    if error and _present(db_code):
        error["db_code"] = db_code
    if error:
        line["error"] = error

    line["env"] = environment_fields()

    for key, value in event.items():
        if key in _KNOWN_KEYS or key in line or not _present(value):
            continue
        line[key] = value
    return line


def finish_wide_event(event: dict[str, Any], token: Token[dict[str, Any] | None]) -> None:
    """Emit the event once and restore the previous context."""
    try:
        event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        if not _present(event.get("outcome")):
            event["outcome"] = "success"
        emit(finalize_wide_event(event))
    finally:
        _current.reset(token)


def _push(event: dict[str, Any]) -> Token[dict[str, Any] | None]:
    return _current.set(event)


@contextmanager
def wide_event_scope(**fields: Any) -> Iterator[dict[str, Any]]:
    """Open a wide event, yield it for enrichment, emit once on the way out."""
    event = start_wide_event(**fields)
    token = _push(event)
    started = time.perf_counter()
    try:
        yield event
        if event.get("outcome") != "error":
            event.setdefault("outcome", "success")
    except Exception as exc:
        event["outcome"] = "error"
        event.setdefault("error_type", type(exc).__name__)
        event.setdefault("error_message", scrub(str(exc)))
        raise
    finally:
        event["duration_ms"] = int(round((time.perf_counter() - started) * 1000))
        finish_wide_event(event, token)


class WideEventMiddleware:
    """Time the request, stamp request id, and emit one wide event at the end."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        header_map = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in scope.get("headers") or []
        }
        incoming = header_map.get("x-request-id", "").strip()
        request_id = incoming or str(uuid.uuid4())
        client = scope.get("client")
        client_ip = client[0] if client else None
        client_port = client[1] if client else None

        event = start_wide_event(
            request_id=request_id,
            method=scope.get("method"),
            path=scope.get("path") or "/",
            user_agent=header_map.get("user-agent"),
            client_ip=client_ip,
            client_port=client_port,
        )
        token = _push(event)
        started = time.perf_counter()
        status_code = 500

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                headers = MutableHeaders(raw=message.setdefault("headers", []))
                headers["x-request-id"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
            event["status_code"] = status_code
            route = scope.get("route")
            route_path = getattr(route, "path", None)
            if isinstance(route_path, str) and route_path:
                event["route"] = route_path
            if status_code == 409 and event.get("queue_result") == "busy":
                # Owner already has a queued or running job. Refused before insert.
                event["outcome"] = "rejected"
            elif status_code >= 400:
                event["outcome"] = "error"
            elif event.get("outcome") != "error":
                event["outcome"] = "success"
        except Exception as exc:
            event["status_code"] = 500
            event["outcome"] = "error"
            event.setdefault("error_type", type(exc).__name__)
            event.setdefault("error_message", scrub(str(exc)))
            raise
        finally:
            event["duration_ms"] = int(round((time.perf_counter() - started) * 1000))
            finish_wide_event(event, token)
