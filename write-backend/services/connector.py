"""Composition root for reference-ingest services.

Routes inject ``ConnectorDep`` once and get doc loading, chunking,
embeddings, the job queue, and the vector store through a single object.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from services.chunking import Chunker, ChunkerDep
from services.doc_loader import DocLoader, DocLoaderDep
from services.embeddings import EmbeddingService, EmbeddingServiceDep
from services.queue import Queue, QueueDep
from services.vetctor_store import WritrVectorStore, WritrVectorStoreDep

from langchain_core.documents import Document
class Connector:
    """Façade over the services used to ingest and retrieve reference docs."""

    def __init__(
        self,
        doc_loader: DocLoader,
        chunker: Chunker,
        embedding_service: EmbeddingService,
        queue: Queue,
        writr_vector_store: WritrVectorStore,
    ) -> None:
        self.doc_loader = doc_loader
        self.chunker = chunker
        self.embedding_service = embedding_service
        self.queue = queue
        self.writr_vector_store = writr_vector_store

    async def load_and_process_document(self, document: Document, owner_id: str) -> None:
        pass
    async def load_and_process_documents(self, documents: list[Document], owner_id: str) -> None:
        pass

    async def load_and_process_document_from_url(self, url: str, owner_id: str) -> None:
        pass
    
    async def error_and_retry_handler(self, job_id: str, owner_id: str) -> None:
        pass
    async def failed_job_handler(self, job_id: str, owner_id: str) -> None:
        pass
def get_connector(
    doc_loader: DocLoaderDep,
    chunker: ChunkerDep,
    embedding_service: EmbeddingServiceDep,
    queue: QueueDep,
    writr_vector_store: WritrVectorStoreDep,
) -> Connector:
    """FastAPI dependency: assemble Connector from existing service deps."""
    return Connector(
        doc_loader=doc_loader,
        chunker=chunker,
        embedding_service=embedding_service,
        queue=queue,
        writr_vector_store=writr_vector_store,
    )


ConnectorDep = Annotated[Connector, Depends(get_connector)]
