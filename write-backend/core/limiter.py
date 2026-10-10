"""Shared slowapi rate limiter.

Registered on the FastAPI app in ``main.py``; routers import ``limiter``
only to decorate endpoints.

Keyed by client IP today (fine behind Cloudflare's connecting IP, or when
the edge already collapses NAT). If another proxy sits in front of
Cloudflare, switch ``key_func`` to a stable per-user id (e.g. JWT ``sub``)
so shared egress IPs cannot starve or amplify quotas.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
