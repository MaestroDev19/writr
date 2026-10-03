"""Structured JSON emitter for Writr.

Call sites never log plain sentences. They pass field maps into ``emit``,
or enrich the open wide event via ``bind`` / ``note`` (re-exported from
``utils.wide_event``).

High-cardinality identifiers (request_id, user_id, job_id, document_id,
content hashes, client ids) should dominate every line so individual
users and requests stay queryable.
"""

from __future__ import annotations

import json
import logging
import os
import re
import socket
import sys
from collections.abc import Mapping
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

# Tokens, API keys, and JWTs sometimes show up inside provider exceptions.
_SECRET = re.compile(
    r"(?i)bearer\s+[a-z0-9\-\._~+/]+=*"
    r"|sb_secret_[a-z0-9_\-]+"
    r"|sb_publishable_[a-z0-9_\-]+"
    r"|sk-[a-z0-9_\-]+"
    r"|AIza[a-z0-9_\-]+"
    r"|eyJ[a-zA-Z0-9_\-]{8,}\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+"
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def scrub(value: Any, limit: int = 300) -> str:
    """Trim exception text and strip credentials that providers sometimes echo."""
    return _SECRET.sub("[redacted]", str(value))[:limit]


@lru_cache(maxsize=1)
def environment_fields() -> dict[str, Any]:
    """Process and deployment facts that already exist. Unset values are omitted.

    ``instance_id`` and ``process_id`` come from the running process.
    Commit, version, region, and deployment id are included only when an
    environment variable sets them. ``environment`` prefers ``ENVIRONMENT``
    / ``ENV``, then ``VERCEL_ENV`` (production, preview, or development on
    Vercel), then Settings, which defaults to ``development`` for local runs.
    """
    fields: dict[str, Any] = {
        "instance_id": os.environ.get("INSTANCE_ID")
        or os.environ.get("HOSTNAME")
        or socket.gethostname(),
        "process_id": os.getpid(),
    }
    commit = (
        os.environ.get("COMMIT_SHA")
        or os.environ.get("GIT_COMMIT")
        or os.environ.get("SOURCE_VERSION")
        or os.environ.get("VERCEL_GIT_COMMIT_SHA")
        or os.environ.get("GITHUB_SHA")
    )
    if commit:
        fields["commit_hash"] = commit
    version = os.environ.get("SERVICE_VERSION") or os.environ.get("APP_VERSION")
    if version:
        fields["version"] = version
    region = (
        os.environ.get("REGION")
        or os.environ.get("AWS_REGION")
        or os.environ.get("FLY_REGION")
        or os.environ.get("VERCEL_REGION")
    )
    if region:
        fields["region"] = region
    environment = (
        os.environ.get("ENVIRONMENT")
        or os.environ.get("ENV")
        or os.environ.get("VERCEL_ENV")
    )
    deployment_id = os.environ.get("DEPLOYMENT_ID") or os.environ.get("K_REVISION")
    service = os.environ.get("SERVICE_NAME")
    try:
        from core.config import get_settings

        settings = get_settings()
    except Exception:
        settings = None
    if settings is not None:
        environment = environment or settings.environment
        version = version or settings.service_version
        commit = commit or settings.commit_sha
        region = region or settings.region
        deployment_id = deployment_id or settings.deployment_id
        service = service or settings.service_name
    if environment:
        fields["environment"] = environment
    if service:
        fields["service"] = service
    if version:
        fields["version"] = version
    if commit:
        fields["commit_hash"] = commit
    if region:
        fields["region"] = region
    if deployment_id:
        fields["deployment_id"] = deployment_id
    return fields


def _clean(fields: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in fields.items() if value is not None}


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        event = getattr(record, "event", None)
        payload: dict[str, Any] = dict(event) if isinstance(event, dict) else {}
        payload.setdefault("timestamp", utc_now())
        payload["level"] = "error" if record.levelno >= logging.ERROR else "info"
        return json.dumps(payload, default=str, separators=(",", ":"))


def _configure() -> logging.Logger:
    log = logging.getLogger("writr")
    log.setLevel(logging.INFO)
    log.propagate = False
    if not any(
        isinstance(getattr(handler, "formatter", None), _JsonFormatter)
        for handler in log.handlers
    ):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(_JsonFormatter())
        log.addHandler(handler)
    return log


_log = _configure()


class StructuredLogger:
    """Emit one JSON object per call. Argument must be a mapping of fields."""

    def info(self, event: Mapping[str, Any]) -> None:
        self._write(event, logging.INFO)

    def error(self, event: Mapping[str, Any]) -> None:
        self._write(event, logging.ERROR)

    def _write(self, event: Mapping[str, Any], level: int) -> None:
        if not isinstance(event, Mapping):
            raise TypeError("logger calls require a mapping of fields")
        _log.log(level, "event", extra={"event": _clean(event)})


logger = StructuredLogger()


def emit(event: Mapping[str, Any]) -> None:
    """Write one structured wide-event line. Prefer wide_event helpers at call sites."""
    if not isinstance(event, Mapping):
        raise TypeError("emit requires a mapping of fields")
    clean = _clean(event)
    status = clean.get("status_code")
    if isinstance(status, int) and status >= 500:
        logger.error(clean)
    elif isinstance(status, int):
        logger.info(clean)
    elif clean.get("outcome") == "error":
        logger.error(clean)
    else:
        logger.info(clean)


# ---------------------------------------------------------------------------
# Re-exports: bind / note / current_event live in wide_event (one emitter path).
# Lazy imports avoid the log ↔ wide_event cycle at module load.
# ---------------------------------------------------------------------------


def bind(**fields: Any) -> None:
    from utils.wide_event import bind as _bind

    _bind(**fields)


def note(**fields: Any) -> None:
    from utils.wide_event import note as _note

    _note(**fields)


def current_event() -> dict[str, Any] | None:
    from utils.wide_event import current_event as _current_event

    return _current_event()
