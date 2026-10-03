"""Background worker identity and claim loop.

The loop claims an existing queued row. It does not enqueue. A second
generation for the same owner is refused in the connector before insert.
"""

from __future__ import annotations

import asyncio
import os
import socket
import uuid
from typing import TYPE_CHECKING, Any

from utils.log import note, scrub

if TYPE_CHECKING:
    from services.connector import Connector

_IDLE_SECONDS = 2.0


def make_worker_id() -> str:
    """Identify one worker process for queue locks (``background_jobs.locked_by``).

    Call once per worker at startup and reuse it for every job: heartbeat,
    complete and fail only match rows locked by the same id. The random
    suffix keeps ids unique across restarts and containers where the pid
    is the same on every replica.
    """
    return f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"


async def drain_jobs(
    connector: Connector,
    worker_id: str,
    *,
    max_jobs: int = 1,
) -> list[dict[str, Any]]:
    """Claim and run up to ``max_jobs`` existing rows. Never creates a job.

    Used by the Vercel Cron drain endpoint (one short invoke) and by the
    long-lived local loop below.
    """
    if max_jobs < 1:
        return []

    processed: list[dict[str, Any]] = []
    for _ in range(max_jobs):
        try:
            job = await connector.run_next_job(worker_id)
        except Exception as exc:
            # Job and claim failures are already one wide event inside run_next_job.
            note(
                operation="worker_loop",
                worker_id=worker_id,
                error_type=type(exc).__name__,
                error_message=scrub(str(exc)),
                outcome="error",
            )
            break
        if job is None:
            break
        processed.append(job)
    return processed


async def run_worker(
    connector: Connector,
    worker_id: str,
    *,
    idle_seconds: float = _IDLE_SECONDS,
) -> None:
    """Claim and run one existing job at a time. Never creates a job."""
    while True:
        processed = await drain_jobs(connector, worker_id, max_jobs=1)
        if not processed:
            await asyncio.sleep(idle_seconds)
