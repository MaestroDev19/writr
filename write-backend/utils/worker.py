import os
import socket
import uuid


def make_worker_id() -> str:
    """Identify one worker process for queue locks (``background_jobs.locked_by``).

    Call once per worker at startup and reuse it for every job: heartbeat,
    complete and fail only match rows locked by the same id. The random
    suffix keeps ids unique across restarts and containers where the pid
    is the same on every replica.
    """
    return f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"
