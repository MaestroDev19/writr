"""Generate / Write agent — produces and revises story artifacts."""

from __future__ import annotations

from langchain.agents import create_agent

from ai.prompts.system import GENERATE_SYSTEM_PROMPT_TOON
from ai.tools.retriver import make_search_notes_tool
from ai.vectorstore import DEFAULT_K


def build_generate_agent(
    *,
    model,
    owner_id: str,
    tools: list | None = None,
    context_chunks: int = DEFAULT_K,
):
    """Build the Write agent with RagLine ``search_notes`` + Generate contract."""
    rag_tools = tools if tools is not None else [
        make_search_notes_tool(owner_id=owner_id, k=context_chunks)
    ]
    return create_agent(
        model=model,
        tools=rag_tools,
        system_prompt=GENERATE_SYSTEM_PROMPT_TOON,
        name="write_agent",
    )
