"""Writr utilities.

Keep this package init free of service imports. Eagerly importing
``utils.worker`` pulls in ``services.connector`` and creates a circular
import when ``services.embeddings`` loads ``utils.log``.
"""

from utils.log import logger

__all__ = [
    "logger",
]
