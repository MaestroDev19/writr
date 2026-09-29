import hashlib
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, Request, status

from core.limiter import limiter
from services.connector import ConnectorDep
from services.supabase import CurrentUserIdDep
from utils.log import logger


def construct_idempotency_key(owner_id: str, content: str | bytes) -> str:
    data = content.encode("utf-8") if isinstance(content, str) else content
    return f"{owner_id}:sha256:{hashlib.sha256(data).hexdigest()}"


UploadRouter = APIRouter(prefix="/v1", tags=["upload"])


@UploadRouter.post("/text", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("20/minute")
async def upload_text(
    request: Request,
    user_id: CurrentUserIdDep,
    connector: ConnectorDep,
    text: Annotated[str, Form(min_length=1)],
) -> dict:
    idempotency_key = construct_idempotency_key(user_id, text)
    try:
        job = await connector.enqueue_text(
            text, user_id, idempotency_key=idempotency_key
        )
    except Exception:
        logger.exception("Text enqueue failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not queue text for processing.",
        )
    return {"job_id": job.get("id"), "status": job.get("status")}
