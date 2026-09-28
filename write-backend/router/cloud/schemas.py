from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

Visibility = Literal["catalog", "private"]
EmbeddingStatus = Literal["pending", "ready", "failed"]


class ReferenceDocumentRead(BaseModel):
    model_config = {"extra": "ignore"}

    id: UUID
    owner_id: UUID | None = None
    name: str | None = None
    visibility: Visibility
    storage_path: str | None = None
    chunk_count: int | None = None
    embedding_status: str | None = None
    created_at: datetime | None = None

    @field_validator("chunk_count", mode="before")
    @classmethod
    def coerce_chunk_count(cls, value: object) -> int | None:
        if value is None or value == "":
            return None
        return int(value)


class ReferenceChunkRead(BaseModel):
    model_config = {"extra": "ignore"}

    id: UUID
    document_id: UUID
    owner_id: UUID | None = None
    visibility: Visibility | None = None
    chunk_index: int
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime | None = None


class ReferenceDocumentDetail(ReferenceDocumentRead):
    chunks: list[ReferenceChunkRead] = Field(default_factory=list)


class ReferenceIn(BaseModel):
    texts: list[str] = Field(min_length=1)
    filename: str | None = None
    name: str | None = None

    @field_validator("texts")
    @classmethod
    def require_non_empty_texts(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if item.strip()]
        if not cleaned:
            raise ValueError("at least one non-empty text is required")
        return cleaned


class ReferenceOut(BaseModel):
    document: ReferenceDocumentRead
    ids: list[UUID]
    count: int
    embedding_model: str


class MatchRequest(BaseModel):
    query: str = Field(min_length=1)
    match_count: int = Field(default=8, ge=1, le=50)
    filter: dict[str, Any] = Field(default_factory=dict)

    @field_validator("query")
    @classmethod
    def strip_query(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("query is required")
        return cleaned


class MatchHit(BaseModel):
    model_config = {"extra": "ignore"}

    id: UUID
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    similarity: float


class MatchResponse(BaseModel):
    embedding_model: str
    count: int
    matches: list[MatchHit]
