from fastapi import APIRouter

from .v1.upload import UploadRouter

router = APIRouter()
router.include_router(UploadRouter)

__all__ = ["router", "UploadRouter"]
