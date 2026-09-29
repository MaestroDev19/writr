from fastapi import APIRouter

from .v1.upload import UploadRouter, active_generation_handler

router = APIRouter()
router.include_router(UploadRouter)

__all__ = ["router", "UploadRouter", "active_generation_handler"]
