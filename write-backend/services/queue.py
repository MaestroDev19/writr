"""Background job queue backed by ``background_jobs`` in Supabase.

Workers claim rows via RPC, heartbeat while running, then complete or fail
with exponential backoff. Uses the secret-key client (RLS bypassed).
"""

from datetime import datetime, timedelta, timezone
from enum import StrEnum
from typing import Annotated, Any

from fastapi import Depends
from postgrest.exceptions import APIError

from services.supabase import AsyncServiceSupabaseDep, get_async_service_supabase
from utils.log import bind, current_event, note, scrub


class QueueStatus(StrEnum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    dead = "dead"


# In-flight work. A finished, failed, or dead row does not block the next one.
ACTIVE_JOB_STATUSES: tuple[str, ...] = (
    QueueStatus.queued.value,
    QueueStatus.running.value,
)


class ActiveGenerationError(Exception):
    """This owner already has a queued or running job. Nothing was inserted."""

    def __init__(self, job: dict) -> None:
        self.job = job
        super().__init__("owner already has an active generation")


def _assign_job_id(fields: dict[str, Any], job_id: object) -> None:
    """Keep the parent job id when a hop enqueues child jobs."""
    event = current_event()
    parent_job_id = event.get("job_id") if event else None
    if parent_job_id and job_id and parent_job_id != job_id:
        children = list(event.get("child_job_ids") or []) if event else []
        if job_id not in children:
            children.append(job_id)
        fields["child_job_ids"] = children
        return
    fields["job_id"] = job_id


def _with_request_id(payload: dict) -> dict:
    """Stamp the in-flight request id onto the job so the worker hop can correlate logs."""
    event = current_event()
    request_id = event.get("request_id") if event else None
    if not request_id or "request_id" in payload:
        return payload
    return {**payload, "request_id": request_id}


class Queue:
    def __init__(self, supabase_client=None) -> None:
        # Injected at construction when available; otherwise lazy-loaded on first use.
        self.supabase_client = supabase_client

    async def _client(self):
        if self.supabase_client is not None:
            return self.supabase_client
        self.supabase_client = await get_async_service_supabase()
        return self.supabase_client

    async def get_job(self, job_id: str, owner_id: str) -> dict | None:
        """Load one job for this owner. Payload is omitted."""
        if not job_id or not owner_id:
            return None
        client = await self._client()
        res = (
            await client.table("background_jobs")
            .select("id, owner_id, status")
            .eq("id", job_id)
            .eq("owner_id", owner_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    async def find_active_job(self, owner_id: str) -> dict | None:
        """In-flight generation for this owner, if one exists. Does not insert."""
        if not owner_id or not str(owner_id).strip():
            raise ValueError("owner_id is required")
        client = await self._client()
        return await self._active_job(client, owner_id)

    async def _active_job(self, client, owner_id: str) -> dict | None:
        """Return this owner's in-flight job, if one exists. Payload is omitted."""
        res = (
            await client.table("background_jobs")
            .select("id, owner_id, job_type, status, created_at")
            .eq("owner_id", owner_id)
            .in_("status", list(ACTIVE_JOB_STATUSES))
            .order("created_at")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    def _mark_busy(self, fields: dict[str, Any], job: dict) -> None:
        fields["queue_result"] = "busy"
        fields["job_status"] = job.get("status")
        _assign_job_id(fields, job.get("id"))

    async def enqueue(
        self,
        *,
        job_type: str,
        payload: dict,
        owner_id: str,
    ) -> dict:
        if not owner_id or not str(owner_id).strip():
            raise ValueError("owner_id is required for enqueue")

        stored_payload = _with_request_id(payload)
        row = {
            "job_type": job_type,
            "payload": stored_payload,
            "owner_id": owner_id,
            "status": QueueStatus.queued.value,
        }

        client = await self._client()
        # Log ids only — never payload text, document bodies, or credentials.
        fields: dict[str, Any] = {
            "user_id": owner_id,
            "job_type": job_type,
        }
        open_event = current_event()
        if open_event and open_event.get("request_id"):
            fields["request_id"] = open_event["request_id"]

        try:
            # One in-flight generation per owner. Check before insert so a second
            # request never becomes a row. The partial unique index closes the race.
            active = await self._active_job(client, owner_id)
            if active:
                self._mark_busy(fields, active)
                raise ActiveGenerationError(active)

            res = await client.table("background_jobs").insert(row).execute()
            job = res.data[0]
            _assign_job_id(fields, job.get("id"))
            fields["job_status"] = job.get("status")
            fields["queue_result"] = "enqueued"
            return job
        except ActiveGenerationError:
            raise
        except APIError as e:
            if e.code == "23505":
                try:
                    active = await self._active_job(client, owner_id)
                except Exception as lookup_error:
                    fields["outcome"] = "error"
                    fields["error_type"] = type(lookup_error).__name__
                    fields["error_message"] = scrub(str(lookup_error))
                    raise

                if active:
                    self._mark_busy(fields, active)
                    raise ActiveGenerationError(active) from e

            fields["outcome"] = "error"
            fields["error_type"] = type(e).__name__
            fields["error_message"] = scrub(str(e))
            fields["db_code"] = e.code
            raise
        except Exception as exc:
            if "outcome" not in fields:
                fields["outcome"] = "error"
                fields["error_type"] = type(exc).__name__
                fields["error_message"] = scrub(str(exc))
            raise
        finally:
            note(**fields)

    async def claim_job(self, *, worker_id: str) -> dict | None:
        if not worker_id or not worker_id.strip():
            raise ValueError("worker_id is required")

        client = await self._client()

        try:
            res = await client.rpc(
                "claim_background_job",
                {"p_worker_id": worker_id},
            ).execute()
        except Exception as exc:
            # Caller emits when this hop has no open event (claim runs before the job scope).
            bind(
                worker_id=worker_id,
                error_type=type(exc).__name__,
                error_message=scrub(str(exc)),
                outcome="error",
                queue_result="claim_failed",
            )
            raise

        if not res.data:
            # Empty claim is normal idle polling — do not emit a wide-event hop.
            return None

        job = res.data[0]
        bind(
            job_id=job.get("id"),
            user_id=job.get("owner_id"),
            worker_id=worker_id,
            job_status=job.get("status"),
            attempts=job.get("attempts"),
        )
        return job

    async def heartbeat(self, *, job_id: str, worker_id: str) -> bool:
        """Refresh ``locked_at`` so reclaim cron does not treat a long job as stuck.

        Returns True while this worker still owns the running row; False if the
        lock was lost, the job finished elsewhere, or the worker id does not match.
        """
        if not job_id or not str(job_id).strip():
            raise ValueError("job_id is required")
        if not worker_id or not worker_id.strip():
            raise ValueError("worker_id is required")

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
        except Exception as exc:
            if current_event() is None:
                note(
                    job_id=job_id,
                    worker_id=worker_id,
                    error_type=type(exc).__name__,
                    error_message=scrub(str(exc)),
                    outcome="error",
                )
            else:
                bind(
                    job_id=job_id,
                    worker_id=worker_id,
                    error_type=type(exc).__name__,
                    error_message=scrub(str(exc)),
                )
            raise

        owned = bool(res.data)
        if owned:
            bind(job_id=job_id, worker_id=worker_id)
        else:
            bind(
                job_id=job_id,
                worker_id=worker_id,
                lost_lock_job_id=job_id,
                error_type="JobLockLost",
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

        now = datetime.now(timezone.utc).isoformat()
        client = await self._client()
        fields: dict[str, Any] = {"job_id": job_id, "worker_id": worker_id}

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
        except Exception as exc:
            fields["outcome"] = "error"
            fields["error_type"] = type(exc).__name__
            fields["error_message"] = scrub(str(exc))
            raise
        else:
            done = bool(res.data)
            if done:
                fields["outcome"] = "success"
                fields["queue_result"] = "succeeded"
                fields["job_status"] = QueueStatus.succeeded.value
            else:
                fields["outcome"] = "error"
                fields["error_type"] = "JobCompleteMissed"
                fields["lost_lock_job_id"] = job_id
                fields["queue_result"] = "complete_missed"
                fields["lock_lost"] = True
            return done
        finally:
            note(**fields)

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

        error_note = scrub(error or "unknown error", limit=2000) or "unknown error"
        now = datetime.now(timezone.utc)
        client = await self._client()
        fields: dict[str, Any] = {
            "job_id": job_id,
            "worker_id": worker_id,
            "error_message": scrub(error_note),
            "outcome": "error",
        }

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
        except Exception as exc:
            fields["error_type"] = type(exc).__name__
            fields["error_message"] = scrub(str(exc))
            note(**fields)
            raise

        if not current.data:
            fields["error_type"] = "JobFailMissed"
            fields["lost_lock_job_id"] = job_id
            note(**fields)
            return False

        attempts = int(current.data.get("attempts") or 0)
        will_retry = retry and attempts < max_attempts
        fields["attempts"] = attempts

        if will_retry:
            # 30s, 60s, 120s… capped at 15 minutes — backs off under sustained failure.
            delay_seconds = min(30 * (2 ** max(attempts - 1, 0)), 15 * 60)
            available_at = (now + timedelta(seconds=delay_seconds)).isoformat()
            patch = {
                "status": QueueStatus.queued.value,
                "locked_at": None,
                "locked_by": None,
                "available_at": available_at,
                "last_error": error_note,
                "updated_at": now.isoformat(),
            }
            fields["available_at"] = available_at
            fields["queue_result"] = "requeued"
        else:
            patch = {
                "status": QueueStatus.dead.value,
                "locked_at": None,
                "locked_by": None,
                "last_error": error_note,
                "updated_at": now.isoformat(),
            }
            fields["queue_result"] = "dead"

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
        except Exception as exc:
            fields["error_type"] = type(exc).__name__
            fields["error_message"] = scrub(str(exc))
            note(**fields)
            raise

        done = bool(res.data)
        if not done:
            fields["error_type"] = "JobFailRace"
            fields["lost_lock_job_id"] = job_id
        note(**fields)
        return done


def get_queue(supabase_client: AsyncServiceSupabaseDep) -> Queue:
    """FastAPI dependency: queue using the secret-key async Supabase client."""
    return Queue(supabase_client)


QueueDep = Annotated[Queue, Depends(get_queue)]
