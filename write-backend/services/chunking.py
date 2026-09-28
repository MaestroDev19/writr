"""
Text chunking for Writr reference ingest.

Job of this module: take a long document string and split it into smaller
Chunk pieces that fit embedding / retrieval limits — without blindly
cutting mid-sentence when we can detect structure.

High-level pipeline (see Chunker.chunk):
  1. normalize   — clean OCR / PDF junk
  2. profile     — decide *how* to split (atomic / record / structured / prose)
  3. split_*     — apply the matching strategy
  4. merge tails — glue tiny orphan fragments onto the previous chunk
  5. return Chunk objects with index + metadata
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any, Literal

import re
import unicodedata

import tiktoken
from fastapi import Depends
from langchain_text_splitters import (
    MarkdownHeaderTextSplitter,
    RecursiveCharacterTextSplitter,
)

from core.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

# Four splitting strategies. Chosen once per document in determine_profile().
#   atomic     — document is already tiny; keep as a single chunk
#   record     — key:value / entity blocks (bios, fact sheets)
#   structured — has markdown headings (# ## ###)
#   prose      — narrative text; prefer scene breaks, else size split
Profile = Literal["atomic", "record", "structured", "prose"]

# Intermediate split result before we wrap into Chunk:
#   (chunk text, profile-specific metadata extras such as heading_path)
Piece = tuple[str, dict[str, Any]]


@dataclass(frozen=True, slots=True)
class Chunk:
    """One retrieval-ready piece of a document.

    Attributes:
        content: The text that will be embedded / stored.
        index:   0-based order within the parent document.
        profile: Which split strategy produced this chunk.
        metadata: Shared fields (doc_name, char_count) plus extras
                  (heading_path, scene_index, entity, …).
    """

    content: str
    index: int
    profile: Profile
    metadata: dict


class Chunker:
    """Splits documents into embedding-sized pieces using structure-aware profiles.

    Construction reads defaults from settings (chunk_size, overlap, etc.) so
    routes usually just call ``get_chunker()`` / ``ChunkerDep``.
    """

    def __init__(
        self,
        *,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        atomic_max: int | None = None,
        min_chunk: int | None = None,
    ) -> None:
        # Max characters per chunk (rough proxy for embedding token limits).
        self.chunk_size = chunk_size or settings.chunk_size  # e.g. 2000
        # How many chars to re-include from the previous chunk (0 = no overlap).
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap
        # Below this token estimate → treat as "record" (or atomic if even smaller).
        self.atomic_max = atomic_max or settings.atomic_max
        # Chunks shorter than this get merged into the previous piece.
        self.min_chunk = min_chunk or settings.min_chunk

        # Structure pass: split markdown on # / ## / ### and keep heading labels.
        self._md = MarkdownHeaderTextSplitter(
            headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")],
            strip_headers=False,  # keep the heading line inside the section body
        )
        # Size fallback: when a section/scene is still too long, cut on natural
        # boundaries (paragraph → line → sentence → word → character).
        self._size_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""],
        )

    # ------------------------------------------------------------------
    # Helpers: measure & clean text
    # ------------------------------------------------------------------

    def tokenCount(self, text: str, safety: float = 0.75) -> int:
        """Estimate token count with a safety factor (default 75% of raw count).

        We use OpenAI's cl100k_base encoding (same family as GPT-4 / many
        embedding models). The safety multiplier under-counts slightly so we
        stay conservative when deciding profiles.
        """
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = encoding.encode(text)
        return int(len(tokens) * safety)

    def normalize(self, text: str) -> str:
        """Clean messy source text before profiling / splitting.

        Steps (in order):
          1. Unicode normalize + strip invisible / soft-hyphen junk.
          2. Unify line endings and collapse runaway blank lines.
          3. Fix PDF hyphenation across line breaks ("gov-\\nernment").
          4. Straighten curly quotes (helps later quote-balance checks).
          5. Normalize common scene-break markers to a single ``***`` sentinel
             so prose splitting has one pattern to look for.
        """
        # 1. unicode / invisible junk
        text = unicodedata.normalize("NFKC", text)
        text = text.replace("\u00ad", "")  # soft hyphen
        text = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", text)

        # 2. line endings + whitespace
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = re.sub(r"[ \t]+\n", "\n", text)  # trailing spaces before newline
        text = re.sub(r"\n{3,}", "\n\n", text)  # at most one blank line

        # 3. PDF line-break hyphenation: "gov-\nernment" → "government"
        text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)

        # 4. curly quotes → straight
        text = text.translate(
            str.maketrans(
                {
                    "\u2018": "'",
                    "\u2019": "'",
                    "\u201c": '"',
                    "\u201d": '"',
                }
            )
        )

        # 5. scene breaks → one sentinel for prose splitting
        text = re.sub(
            r"(?m)^\s*(\*\*\*|---|· · ·|# # #)\s*$",
            "\n\n***\n\n",
            text,
        )
        return text.strip()

    def has_markdown_headings(self, text: str) -> bool:
        """True if the text has at least one markdown heading line (# … ######)."""
        return bool(re.search(r"(?m)^#{1,6}\s+\S", text))

    def looks_like_record(self, text: str) -> bool:
        """Heuristic: ≥30% of non-empty lines look like ``Key: value``.

        Used to detect bios, character sheets, and similar structured notes
        that should stay as whole records rather than prose paragraphs.
        """
        lines = [ln for ln in text.splitlines() if ln.strip()]
        if not lines:
            return False
        keyed = sum(
            1 for ln in lines if re.match(r"^[^:\n]{1,40}:\s+\S", ln)
        )
        return keyed / len(lines) >= 0.30

    def strip_repeated_lines(self, text: str) -> str:
        """Remove every occurrence of the first line (e.g. repeating headers).

        Note: currently unused by ``chunk()`` but kept as a helper for callers
        that want to scrub repeating page headers before ingest.
        """
        lines = text.splitlines()
        if not lines:
            return text
        first_line = lines[0]
        return text.replace(first_line, "")

    # ------------------------------------------------------------------
    # Profile selection
    # ------------------------------------------------------------------

    def determine_profile(self, text: str) -> Profile:
        """Pick one split strategy for the whole document.

        Decision order (first match wins):
          1. very short          → atomic   (keep whole)
          2. short OR key:value  → record   (blank-line entities)
          3. has # headings      → structured
          4. otherwise           → prose
        """
        text = self.normalize(text)
        tokenCount = self.tokenCount(text)

        if tokenCount < self.min_chunk:
            return "atomic"
        elif tokenCount < self.atomic_max or self.looks_like_record(text):
            return "record"
        elif self.has_markdown_headings(text):
            return "structured"
        else:
            return "prose"

    # ------------------------------------------------------------------
    # Split strategies (one per profile)
    # ------------------------------------------------------------------

    def split_markdown(self, text: str) -> list[Piece]:
        """Split on markdown headers; size-split any section that is still too big.

        Each piece carries a ``heading_path`` breadcrumb like
        ``["Chapter 1", "Section A"]`` so retrieval can show where it came from.
        """
        docs = self._md.split_text(text)  # list of Documents with heading metadata
        parts: list[Piece] = []

        for doc in docs:
            body = doc.page_content
            # Build breadcrumb from whatever heading levels the splitter found.
            heading_path = [
                doc.metadata[key]
                for key in ("h1", "h2", "h3")
                if key in doc.metadata and doc.metadata[key]
            ]
            extra: dict[str, Any] = {}
            if heading_path:
                extra["heading_path"] = heading_path

            if len(body) <= self.chunk_size:
                parts.append((body, extra))
            else:
                # Oversized section → cut by size; keep the same heading_path
                # on every sub-chunk so context is not lost.
                for piece in self._size_splitter.split_text(body):
                    parts.append((piece, dict(extra)))

        return parts

    def split_prose(self, text: str) -> list[Piece]:
        """Split narrative text on scene breaks; fall back to size splitting.

        ``normalize()`` already turned ``---`` / ``***`` / etc. into the
        ``\\n\\n***\\n\\n`` sentinel, so we only need one regex here.
        """
        scenes = re.split(r"\n\n\*\*\*\n\n", text)
        parts: list[Piece] = []

        for scene_index, scene in enumerate(scenes):
            scene = scene.strip()
            if not scene:
                continue
            extra: dict[str, Any] = {"scene_index": scene_index}

            if len(scene) <= self.chunk_size:
                parts.append((scene, extra))
            else:
                # No useful structure left inside this scene — split by size.
                for piece in self._size_splitter.split_text(scene):
                    parts.append((piece, dict(extra)))

        return parts

    def split_records(self, text: str) -> list[Piece]:
        """One chunk per blank-line-separated entity block.

        Tries to attach an ``entity`` label from a Name:/Title: line (or the
        first line) so retrieval results can show who/what the block is about.
        """
        blocks = re.split(r"\n\s*\n", text)
        parts: list[Piece] = []

        for block in blocks:
            block = block.strip()
            if not block:
                continue
            extra: dict[str, Any] = {}
            entity = self._entity_from_record(block)
            if entity:
                extra["entity"] = entity
            parts.append((block, extra))

        return parts

    def _entity_from_record(self, block: str) -> str | None:
        """Best-effort label for a record block.

        Prefer an explicit ``Name:`` / ``Title:`` field; otherwise use the
        first non-empty line (truncated) as a weak label.
        """
        for line in block.splitlines():
            stripped = line.strip()
            match = re.match(r"(?i)^(?:name|title)\s*:\s*(.+)$", stripped)
            if match:
                return match.group(1).strip()

        # Fallback: first non-empty line as a weak label
        for line in block.splitlines():
            if line.strip():
                return line.strip()[:80]
        return None

    def _merge_small_tails(self, pieces: list[Piece]) -> list[Piece]:
        """Glue orphan tails shorter than ``min_chunk`` onto the previous piece.

        Avoids tiny retrieval fragments (e.g. a lone heading or one-line remnant)
        that would embed poorly on their own.
        """
        if not pieces:
            return pieces

        merged: list[Piece] = [pieces[0]]
        for content, extra in pieces[1:]:
            prev_content, prev_extra = merged[-1]
            if len(content) < self.min_chunk:
                # Keep the previous piece's metadata; swallow the tiny tail.
                merged[-1] = (f"{prev_content}\n\n{content}", prev_extra)
            else:
                merged.append((content, extra))
        return merged

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def chunk(self, text: str, *, doc_name: str | None = None) -> list[Chunk]:
        """Normalize → pick one profile → split → merge tiny tails → Chunks.

        Profile is chosen once for the whole document (not per fragment).
        Size safety (``_size_splitter``) lives inside each ``split_*`` method.
        """
        text = self.normalize(text)
        if not text:
            return []

        profile = self.determine_profile(text)

        # Flat dispatch by profile — not recursive.
        if profile == "atomic":
            pieces: list[Piece] = [(text, {})]
        elif profile == "record":
            pieces = self.split_records(text)
        elif profile == "structured":
            pieces = self.split_markdown(text)
        else:
            pieces = self.split_prose(text)

        pieces = self._merge_small_tails(pieces)

        # Wrap each piece in a Chunk with shared + profile-specific metadata.
        chunks: list[Chunk] = []
        for index, (content, extra) in enumerate(pieces):
            metadata: dict[str, Any] = {
                "profile": profile,
                "doc_name": doc_name,
                "char_count": len(content),
                **extra,  # heading_path / scene_index / entity / …
            }
            chunks.append(
                Chunk(
                    content=content,
                    index=index,
                    profile=profile,
                    metadata=metadata,
                )
            )
        return chunks


@lru_cache(maxsize=1)
def get_chunker() -> Chunker:
    """Return a single shared Chunker (settings are read once at construction).

    Used with FastAPI's Depends(...) so routes inject the same instance.
    """
    return Chunker()


# Type alias for route signatures: ``chunker: ChunkerDep``.
ChunkerDep = Annotated[Chunker, Depends(get_chunker)]
