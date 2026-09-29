"""Writr backend entrypoint.

Builds the FastAPI app: CORS, routers, health checks, and a background
worker started in ``lifespan``.

Run locally:
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
from router import UploadRouter, active_generation_handler
from services.chunking import get_chunker
from services.connector import Connector, get_connector
from services.doc_loader import get_doc_loader
from services.embeddings import get_embedding_service
from services.queue import ActiveGenerationError, get_queue
from services.supabase import get_async_service_supabase, get_supabase
from services.vetctor_store import get_writr_vector_store
from utils.log import bind, scrub
from utils.wide_event import WideEventMiddleware, wide_event_scope
from utils.worker import make_worker_id, run_worker


async def build_worker_connector() -> Connector:
    """Build a Connector outside a request (Depends only resolves per request)."""
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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    worker_id = make_worker_id()
    connector: Connector | None = None
    with wide_event_scope(operation="worker_start", worker_id=worker_id):
        try:
            connector = await build_worker_connector()
        except Exception as exc:
            # API still serves; queued jobs wait until a worker can start.
            bind(
                outcome="error",
                error_type=type(exc).__name__,
                error_message=scrub(str(exc)),
            )
            connector = None

    if connector is None:
        yield
        return

    worker_task = asyncio.create_task(run_worker(connector, worker_id))
    try:
        yield
    finally:
        worker_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await worker_task


# ASGI app object for uvicorn / gunicorn.
app = FastAPI(lifespan=lifespan)

# Second generation for an owner who already has queued/running work: 409, no insert.
app.add_exception_handler(ActiveGenerationError, active_generation_handler)

# slowapi expects the limiter on app.state; 429s use this handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Open CORS for local/dev frontends; tighten allow_origins in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
)
# Last = outermost middleware, so the wide event always emits in ``finally``.
app.add_middleware(WideEventMiddleware)

app.include_router(UploadRouter)


@app.get("/health")
def read_health() -> dict[str, str]:
    """Liveness probe — used by load balancers / deploy checks."""
    return {"message": "healthy"}


@app.get("/")
def read_root() -> dict[str, str]:
    """Root welcome message — confirms the API is reachable."""
    return {"message": "welcome to Writr"}
