"""
Writr backend entrypoint.

This file builds the FastAPI application:
  1. Create the ``app`` instance.
  2. Enable CORS so browser frontends can call the API.
  3. Mount the main API ``router`` (all feature routes live there).
  4. Expose simple ``/`` and ``/health`` endpoints for sanity checks.

Run locally with something like:
  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from router import router
from utils import logger

# The ASGI application object uvicorn / gunicorn will serve.
app = FastAPI()

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
app.include_router(router)


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
