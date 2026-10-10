from fastapi import APIRouter

from .internal.drain import DrainRouter
from .v1.agents import AgentsRouter
from .v1.mySetting import MySettingRouter
from .v1.upload import UploadRouter, active_generation_handler

router = APIRouter()
router.include_router(UploadRouter)
router.include_router(MySettingRouter)
router.include_router(AgentsRouter)
router.include_router(DrainRouter)

__all__ = [
    "router",
    "UploadRouter",
    "MySettingRouter",
    "AgentsRouter",
    "DrainRouter",
    "active_generation_handler",
]
