"""
Writr backend entrypoint.

This file builds the FastAPI application:
  1. Create the ``app`` instance.
  2. Enable CORS so browser frontends can call the API.
  3. Mount the main API ``router`` (all feature routes live there).
  4. Expose simple ``/`` and ``/health`` endpoints for sanity checks.
  5. Start the background-job worker on startup (see ``lifespan``).

Run locally with something like:
  uvicorn main:app --reload --port 8000
"""

import asyncio
import contextlib
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from core.config import get_settings
from core.limiter import limiter
from router import UploadRouter
from services.chunking import get_chunker
from services.connector import Connector, get_connector
from services.doc_loader import get_doc_loader
from services.embeddings import get_embedding_service
from services.queue import get_queue
from services.supabase import get_async_service_supabase, get_supabase
from services.vetctor_store import get_writr_vector_store
from utils import logger
from utils.worker import make_worker_id

_WORKER_IDLE_SECONDS = 2.0


async def build_worker_connector() -> Connector:
    """Assemble a Connector outside a request (FastAPI deps only resolve per request)."""
    service_client = await get_async_service_supabase()
    embeddings = get_embedding_service(get_settings())
    return get_connector(
        doc_loader=get_doc_loader(),
        chunker=get_chunker(),
        embedding_service=embeddings,
        queue=get_queue(service_client),
        writr_vector_store=get_writr_vector_store(
            service_client, get_supabase(), embeddings
        ),
    )


async def worker_loop(
    connector: Connector, *, idle_seconds: float = _WORKER_IDLE_SECONDS
) -> None:
    """Claim and run queued jobs forever; sleep when the queue is empty."""
    worker_id = make_worker_id()
    logger.info("Worker started worker_id=%s", worker_id)
    while True:
        try:
            job = await connector.run_next_job(worker_id)
        except Exception:
            # An unhandled error would end the task silently and stop all processing.
            logger.exception("Worker loop error worker_id=%s", worker_id)
            job = None
        if job is None:
            await asyncio.sleep(idle_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    try:
        connector = await build_worker_connector()
    except Exception:
        # Serve the API anyway; queued jobs wait until a worker can start.
        logger.exception("Worker not started: could not build connector")
        yield
        return

    worker_task = asyncio.create_task(worker_loop(connector))
    try:
        yield
    finally:
        worker_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker_task


# The ASGI application object uvicorn / gunicorn will serve.
app = FastAPI(lifespan=lifespan)

# slowapi reads the limiter from app.state; 429s go through this handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allow cross-origin requests from any frontend origin during development.
# Tighten allow_origins in production to your real frontend URL(s).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# Attach all feature routes (ingest, chat, etc.) defined under ``router/``.
app.include_router(UploadRouter)


@app.get("/health")
def read_health() -> dict[str, str]:
    """Liveness probe — used by load balancers / deploy checks."""
    logger.info("GET request received at health endpoint")
    return {"message": "healthy"}


@app.get("/")
def read_root() -> dict[str, str]:
    """Root welcome message — confirms the API is reachable."""
    logger.info("GET request received at root endpoint")
    return {"message": "welcome to Writr"}
