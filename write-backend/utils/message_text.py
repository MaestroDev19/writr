"""Normalize LangChain / provider message content to plain text."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


def message_content_text(content: Any) -> str:
    """Return user-facing text from ``AIMessage.content``.

    Providers (notably Anthropic) often return a list of content blocks:
    ``[{"type": "text", "text": "...", "extras": {...}}]``. Callers must not
    ``str()`` that list — it leaks signatures and block metadata to the client.
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            part = _block_text(block)
            if part:
                parts.append(part)
        return "\n".join(parts) if len(parts) > 1 else (parts[0] if parts else "")
    return str(content)


def _block_text(block: Any) -> str:
    if isinstance(block, str):
        return block
    if isinstance(block, Mapping):
        block_type = block.get("type")
        if block_type in (None, "text") and "text" in block:
            return str(block.get("text") or "")
        return ""
    block_type = getattr(block, "type", None)
    text = getattr(block, "text", None)
    if text is not None and block_type in (None, "text"):
        return str(text)
    return ""
