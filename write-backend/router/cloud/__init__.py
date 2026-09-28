from fastapi import APIRouter, Depends

from router.cloud.notes import router as notes_router
from services.supabase import get_current_user

router = APIRouter(
    prefix="/cloud",
    tags=["cloud"],
    dependencies=[Depends(get_current_user)],
)
router.include_router(notes_router)

__all__ = ["router"]
