from fastapi import APIRouter

from .cloud import router as cloud_router

router = APIRouter()
router.include_router(cloud_router)

__all__ = ["router"]
