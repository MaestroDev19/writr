"""Shared slowapi rate limiter.

Registered on the FastAPI app in ``main.py``; routers import ``limiter``
only to decorate endpoints.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
