"""Shared RagLine retriever tool for Write / Review agents."""

from __future__ import annotations

from langchain_core.tools import BaseTool, tool

from ai.vectorstore import DEFAULT_K, get_retriever


def make_search_notes_tool(
    *,
    owner_id: str,
    k: int = DEFAULT_K,
) -> BaseTool:
    """Build a ``search_notes`` tool scoped to one author's notes.

    ``owner_id`` is closed over (not an LLM argument) so retrieval stays tenant-safe.
    """

    @tool
    def search_notes(query: str) -> str:
        """Search the author's reference notes for lore, voice, and continuity.

        Use when you need names, traits, timeline, setting rules, or prior events
        from the notes library before inventing details.

        Args:
            query: Short search query (about 2–12 words).
        """
        retriever = get_retriever(k=k, owner_id=owner_id)
        docs = retriever.invoke(query)
        if not docs:
            return "No matching notes found."
        return "\n\n".join(doc.page_content for doc in docs)

    return search_notes
