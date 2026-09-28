"""
Document loading for Writr reference ingest.

Job of this module: turn a file, upload bytes, pasted text, or a URL into
plain text + metadata that Chunker.chunk(...) can consume.

Why it exists:
  FastAPI routes should not care whether the source was a PDF, DOCX, or
  webpage — they always get a LoadedDocument with .text and .metadata.
"""

from __future__ import annotations

import asyncio
import tempfile
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal
from urllib.parse import urlparse

from fastapi import Depends
from langchain_community.document_loaders import (
    Docx2txtLoader,
    PyPDFLoader,
    TextLoader,
    WebBaseLoader,
)

from utils.log import logger

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# File kinds we accept. Kept as a Literal so type-checkers catch typos.
# We deliberately avoid Unstructured* loaders to keep dependencies light.
FileKind = Literal["pdf", "docx", "txt", "md"]

# Lookup set for fast "is this extension allowed?" checks.
SUPPORTED_EXTENSIONS: frozenset[str] = frozenset({".pdf", ".docx", ".txt", ".md"})

# After scraping a URL, if we got fewer characters than this, the page is
# almost certainly a JS shell (empty HTML shell) rather than real article text.
MIN_URL_CHARS = 200


class DocLoaderError(Exception):
    """Raised when a document cannot be loaded or extracted.

    Callers (API routes) catch this and turn it into a 4xx response.
    """


@dataclass(frozen=True, slots=True)
class LoadedDocument:
    """Result of a successful load — plain text ready for chunking.

    Attributes:
        text: Full extracted body (pages already joined).
        metadata: Source hints for downstream storage / retrieval
                  (filename, mime type, visibility, etc.).
    """

    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


class DocLoader:
    """Sync extractors for local files, uploads, pasted text, and URLs.

    Important for FastAPI:
      File parsers (PDF/DOCX) are synchronous and CPU/disk-bound.
      Prefer the ``*_async`` helpers from async routes so WebBaseLoader /
      heavy parsing do not block the event loop.
    """

    # ------------------------------------------------------------------
    # Public loaders
    # ------------------------------------------------------------------

    def load(self, file_path: str | Path) -> LoadedDocument:
        """Load a document already on disk, choosing a parser by extension.

        Flow:
          1. Confirm the path exists and the extension is supported.
          2. Hand off to the matching LangChain loader.
          3. Join multi-page results into one string.
          4. Reject empty extracts (corrupt / image-only PDFs, etc.).
        """
        path = Path(file_path)
        if not path.is_file():
            logger.error("Document path not found: %s", path)
            raise DocLoaderError(f"File not found: {path}")

        suffix = path.suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            logger.error("Unsupported file type: %s", path)
            raise DocLoaderError(
                f"Unsupported file type: {suffix}. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        try:
            # Pick the lightest loader that can read this format.
            if suffix == ".pdf":
                docs = PyPDFLoader(str(path)).load()
            elif suffix == ".docx":
                docs = Docx2txtLoader(str(path)).load()
            else:
                # .txt and .md — raw text; Chunker owns markdown structure later.
                docs = TextLoader(str(path), encoding="utf-8").load()
        except DocLoaderError:
            # Already our error — bubble up unchanged.
            raise
        except Exception as e:
            # Anything else from LangChain / the OS → wrap for the API layer.
            logger.error("Failed to load %s: %s", path, e)
            raise DocLoaderError(f"Failed to load {path.name}: {e}") from e

        text = self._join_docs(docs)
        if not text.strip():
            raise DocLoaderError(f"No extractable text in {path.name}")

        return LoadedDocument(
            text=text,
            metadata={
                "source": str(path),
                "filename": path.name,
                # "pdf" / "docx" / "txt" / "md" — useful for analytics later
                "mime_hint": suffix.lstrip("."),
            },
        )

    def load_bytes(self, data: bytes, *, filename: str) -> LoadedDocument:
        """Load an in-memory upload (typical FastAPI UploadFile.read() result).

        LangChain's PDF/DOCX loaders need a real filesystem path, so we:
          1. Write bytes into a temporary directory.
          2. Reuse ``load()`` for parsing.
          3. Replace temp-path metadata with the client's original filename.
        """
        if not data:
            raise DocLoaderError("Empty file upload")

        suffix = Path(filename).suffix.lower()
        if suffix not in SUPPORTED_EXTENSIONS:
            raise DocLoaderError(
                f"Unsupported file type: {suffix}. "
                f"Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
            )

        # TemporaryDirectory cleans itself up when the ``with`` block exits.
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / Path(filename).name
            path.write_bytes(data)
            loaded = self.load(path)

        # Prefer the name the user uploaded over the ephemeral temp path.
        return LoadedDocument(
            text=loaded.text,
            metadata={
                **loaded.metadata,
                "source": filename,
                "filename": Path(filename).name,
            },
        )

    def load_text(self, text: str, *, filename: str | None = None) -> LoadedDocument:
        """Wrap already-extracted or pasted text (e.g. from a frontend editor).

        No file I/O — just validate non-empty and attach optional source labels.
        """
        cleaned = text.strip()
        if not cleaned:
            raise DocLoaderError("Text content is empty")

        meta: dict[str, Any] = {"mime_hint": "text"}
        if filename:
            meta["source"] = filename
            meta["filename"] = Path(filename).name

        return LoadedDocument(text=cleaned, metadata=meta)

    def load_url(self, url: str) -> LoadedDocument:
        """Fetch a public URL and extract visible text (synchronous).

        Prefer ``load_url_async`` inside FastAPI routes so the event loop
        stays free while the HTTP fetch + HTML parse run on a worker thread.

        Failed scrapes (JS-heavy sites) are detected via MIN_URL_CHARS rather
        than treating a short empty shell as a successful article.
        """
        normalized = self._validate_url(url)
        try:
            # WebBaseLoader downloads HTML and pulls readable text nodes.
            docs = WebBaseLoader(normalized).load()
        except Exception as e:
            logger.error("Failed to load URL %s: %s", normalized, e)
            raise DocLoaderError(f"Failed to fetch URL: {e}") from e

        text = self._join_docs(docs)
        if len(text.strip()) < MIN_URL_CHARS:
            raise DocLoaderError(
                "Could not extract enough readable text from this URL. "
                "The page may be JavaScript-rendered — paste the article or upload a file."
            )

        # Best-effort page title from loader metadata (may be missing).
        title = None
        if docs and isinstance(docs[0].metadata, dict):
            title = docs[0].metadata.get("title")

        return LoadedDocument(
            text=text,
            metadata={
                "source": normalized,
                # Fall back to last path segment, then a generic "web" label.
                "filename": title or urlparse(normalized).path.rsplit("/", 1)[-1] or "web",
                "mime_hint": "html",
                # URL imports stay private — never published to a shared catalog.
                "visibility": "private",
            },
        )

    async def load_url_async(self, url: str) -> LoadedDocument:
        """Async-friendly wrapper: runs ``load_url`` on a thread pool.

        Use this from ``async def`` FastAPI endpoints.
        """
        return await asyncio.to_thread(self.load_url, url)

    async def aload_bytes(self, data: bytes, *, filename: str) -> LoadedDocument:
        """Async-friendly wrapper: runs ``load_bytes`` on a thread pool.

        PDF/DOCX parsing can be slow; offloading keeps the API responsive.
        """
        return await asyncio.to_thread(self.load_bytes, data, filename=filename)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _validate_url(self, url: str) -> str:
        """Require an absolute http(s) URL — reject relative paths and file://."""
        cleaned = url.strip()
        parsed = urlparse(cleaned)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise DocLoaderError("URL must be an absolute http(s) link")
        return cleaned

    def _join_docs(self, docs: list[Any]) -> str:
        """Merge LangChain Document page_content fields into one string.

        Blank pages are dropped; surviving pages are separated by a blank line
        so page boundaries stay somewhat visible for later chunking.
        """
        parts = [d.page_content.strip() for d in docs if getattr(d, "page_content", None)]
        return "\n\n".join(p for p in parts if p)


@lru_cache(maxsize=1)
def get_doc_loader() -> DocLoader:
    """Return a single shared DocLoader instance (cheap to create, but cache anyway).

    Used with FastAPI's Depends(...) so every request gets the same object
    without rebuilding it each time.
    """
    return DocLoader()


# Type alias for route signatures: ``loader: DocLoaderDep``.
DocLoaderDep = Annotated[DocLoader, Depends(get_doc_loader)]
