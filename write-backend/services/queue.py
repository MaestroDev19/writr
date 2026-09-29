import hashlib
import logging
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Annotated

from fastapi import Depends
from postgrest.exceptions import APIError

from services.supabase import AsyncServiceSupabaseDep, get_async_service_supabase

logger = logging.getLogger(__name__)


class QueueStatus(StrEnum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    dead = "dead"


def _log_ref(value: object | None) -> str:
    """Short opaque ref for logs: correlatable, not reversible to full IDs/keys."""
    if value is None:
        return "-"
    digest = hashlib.sha256(str(value).encode("utf-8")).hexdigest()
    return digest[:12]


class Queue:
    def __init__(self, supabase_client=None) -> None:
        # Prefer an injected service-role client; fall back at call time if needed.
        self.supabase_client = supabase_client

    async def _client(self):
        if self.supabase_client is not None:
            return self.supabase_client
        self.supabase_client = await get_async_service_supabase()
        return self.supabase_client

    async def enqueue(
        self,
        *,
        job_type: str,
        payload: dict,
        idempotency_key: str,
        owner_id: str,
    ) -> dict:
        if not idempotency_key or not str(idempotency_key).strip():
            raise ValueError("idempotency_key is required for enqueue")

        row = {
            "job_type": job_type,
            "payload": payload,
            "idempotency_key": idempotency_key,
            "owner_id": owner_id,
            "status": QueueStatus.queued.value,
        }

        client = await self._client()
        # Safe log fields: job_type + short hashes. Never log payload / raw keys / owner UUID.
        key_ref = _log_ref(idempotency_key)
        owner_ref = _log_ref(owner_id)

        try:
            logger.info(
                "Enqueueing job type=%s owner_ref=%s key_ref=%s",
                job_type,
                owner_ref,
                key_ref,
            )
            res = await client.table("background_jobs").insert(row).execute()
            job = res.data[0]
            logger.info(
                "Enqueued job id=%s type=%s key_ref=%s",
                job.get("id"),
                job_type,
                key_ref,
            )
            return job
        except APIError as e:
            # Unique violation on idempotency_key → treat as already queued.
            if e.code == "23505":
                logger.warning(
                    "Duplicate enqueue type=%s key_ref=%s db_code=%s",
                    job_type,
                    key_ref,
                    e.code,
                )
                try:
                    existing = (
                        await client.table("background_jobs")
                        .select("*")
                        .eq("idempotency_key", idempotency_key)
                        .maybe_single()
                        .execute()
                    )
                except Exception:
                    logger.exception(
                        "Lookup after duplicate enqueue failed type=%s key_ref=%s",
                        job_type,
                        key_ref,
                    )
                    raise

                if existing.data:
                    logger.info(
                        "Returning existing job id=%s type=%s key_ref=%s",
                        existing.data.get("id"),
                        job_type,
                        key_ref,
                    )
                    return existing.data

                logger.error(
                    "Unique conflict but no row found type=%s key_ref=%s",
                    job_type,
                    key_ref,
                )
                raise

            logger.exception(
                "PostgREST enqueue failed type=%s key_ref=%s db_code=%s",
                job_type,
                key_ref,
                e.code,
            )
            raise
        except Exception:
            logger.exception(
                "Unexpected enqueue failure type=%s key_ref=%s",
                job_type,
                key_ref,
            )
            raise

    async def claim_job(self, *, worker_id: str) -> dict | None:
        if not worker_id or not worker_id.strip():
            raise ValueError("worker_id is required")

        worker_ref = _log_ref(worker_id)
        client = await self._client()

        try:
            res = await client.rpc(
                "claim_background_job",
                {"p_worker_id": worker_id},
            ).execute()
        except Exception:
            logger.exception("Claim failed worker_ref=%s", worker_ref)
            raise

        if not res.data:
            logger.debug("Queue empty worker_ref=%s", worker_ref)
            return None

        job = res.data[0]
        logger.info(
            "Claimed job id=%s type=%s worker_ref=%s attempts=%s",
            job.get("id"),
            job.get("job_type"),
            worker_ref,
            job.get("attempts"),
        )
        return job

    async def heartbeat(self, *, job_id: str, worker_id: str) -> bool:
        """Refresh locked_at so cron does not treat a long-running job as stuck.

        Returns True if this worker still owns the running job; False if the
        row was not updated (lost lock, completed elsewhere, or wrong worker).
        """
        if not job_id or not str(job_id).strip():
            raise ValueError("job_id is required")
        if not worker_id or not worker_id.strip():
            raise ValueError("worker_id is required")

        worker_ref = _log_ref(worker_id)
        now = datetime.now(timezone.utc).isoformat()
        client = await self._client()

        try:
            res = (
                await client.table("background_jobs")
                .update({"locked_at": now, "updated_at": now})
                .eq("id", job_id)
                .eq("locked_by", worker_id)
                .eq("status", QueueStatus.running.value)
                .select("id")
                .execute()
            )
        except Exception:
            logger.exception(
                "Heartbeat failed job_id=%s worker_ref=%s",
                job_id,
                worker_ref,
            )
            raise

        owned = bool(res.data)
        if owned:
            logger.debug(
                "Heartbeat ok job_id=%s worker_ref=%s",
                job_id,
                worker_ref,
            )
        else:
            logger.warning(
                "Heartbeat missed job_id=%s worker_ref=%s "
                "(lock lost or not running)",
                job_id,
                worker_ref,
            )
        return owned

    async def complete_job(self, *, job_id: str, worker_id: str) -> bool:
        """Mark a running job as succeeded and clear the lock.

        Returns True if this worker owned the job and completed it; False if
        the row was not updated (wrong worker, already finished, or not running).
        """
        if not job_id or not str(job_id).strip():
            raise ValueError("job_id is required")
        if not worker_id or not worker_id.strip():
            raise ValueError("worker_id is required")

        worker_ref = _log_ref(worker_id)
        now = datetime.now(timezone.utc).isoformat()
        client = await self._client()

        try:
            res = (
                await client.table("background_jobs")
                .update(
                    {
                        "status": QueueStatus.succeeded.value,
                        "locked_at": None,
                        "locked_by": None,
                        "last_error": None,
                        "updated_at": now,
                    }
                )
                .eq("id", job_id)
                .eq("locked_by", worker_id)
                .eq("status", QueueStatus.running.value)
                .select("id")
                .execute()
            )
        except Exception:
            logger.exception(
                "Complete failed job_id=%s worker_ref=%s",
                job_id,
                worker_ref,
            )
            raise

        done = bool(res.data)
        if done:
            logger.info(
                "Completed job id=%s worker_ref=%s",
                job_id,
                worker_ref,
            )
        else:
            logger.warning(
                "Complete missed job_id=%s worker_ref=%s "
                "(lock lost or not running)",
                job_id,
                worker_ref,
            )
        return done

    async def fail_job(
        self,
        *,
        job_id: str,
        worker_id: str,
        error: str,
        retry: bool = True,
        max_attempts: int = 5,
    ) -> bool:
        """Fail a running job: re-queue with backoff, or mark dead.

        Returns True if this worker owned the job and updated it; False if not.
        """
        if not job_id or not str(job_id).strip():
            raise ValueError("job_id is required")
        if not worker_id or not worker_id.strip():
            raise ValueError("worker_id is required")

        worker_ref = _log_ref(worker_id)
        error_note = (error or "unknown error").strip()[:2000] or "unknown error"
        now = datetime.now(timezone.utc)
        client = await self._client()

        try:
            current = (
                await client.table("background_jobs")
                .select("id, attempts, status, locked_by")
                .eq("id", job_id)
                .eq("locked_by", worker_id)
                .eq("status", QueueStatus.running.value)
                .maybe_single()
                .execute()
            )
        except Exception:
            logger.exception(
                "Fail lookup failed job_id=%s worker_ref=%s",
                job_id,
                worker_ref,
            )
            raise

        if not current.data:
            logger.warning(
                "Fail missed job_id=%s worker_ref=%s "
                "(lock lost or not running)",
                job_id,
                worker_ref,
            )
            return False

        attempts = int(current.data.get("attempts") or 0)
        will_retry = retry and attempts < max_attempts

        if will_retry:
            # Exponential backoff: 30s, 60s, 120s… capped at 15 minutes.
            delay_seconds = min(30 * (2 ** max(attempts - 1, 0)), 15 * 60)
            patch = {
                "status": QueueStatus.queued.value,
                "locked_at": None,
                "locked_by": None,
                "available_at": (now + timedelta(seconds=delay_seconds)).isoformat(),
                "last_error": error_note,
                "updated_at": now.isoformat(),
            }
            outcome = "requeued"
        else:
            patch = {
                "status": QueueStatus.dead.value,
                "locked_at": None,
                "locked_by": None,
                "last_error": error_note,
                "updated_at": now.isoformat(),
            }
            outcome = "dead"

        try:
            res = (
                await client.table("background_jobs")
                .update(patch)
                .eq("id", job_id)
                .eq("locked_by", worker_id)
                .eq("status", QueueStatus.running.value)
                .select("id, status, attempts, available_at")
                .execute()
            )
        except Exception:
            logger.exception(
                "Fail update failed job_id=%s worker_ref=%s outcome=%s",
                job_id,
                worker_ref,
                outcome,
            )
            raise

        done = bool(res.data)
        if done:
            logger.warning(
                "Failed job id=%s worker_ref=%s outcome=%s attempts=%s",
                job_id,
                worker_ref,
                outcome,
                attempts,
            )
        else:
            logger.warning(
                "Fail race job_id=%s worker_ref=%s (row changed during fail)",
                job_id,
                worker_ref,
            )
        return done


def get_queue(supabase_client: AsyncServiceSupabaseDep) -> Queue:
    """FastAPI dependency: Queue backed by the secret-key async Supabase client."""
    return Queue(supabase_client)


QueueDep = Annotated[Queue, Depends(get_queue)]