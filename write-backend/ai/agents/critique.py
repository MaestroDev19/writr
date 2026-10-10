"""Critique / Review agent — scored feedback; focus comes in the user instruction."""

from __future__ import annotations

from langchain.agents import create_agent

from ai.agents.limits import DEFAULT_RECURSION_LIMIT
from ai.prompts.system import CRITIQUE_SYSTEM_PROMPT_TOON
from ai.tools.retriever import make_search_notes_tool
from ai.vectorstore import DEFAULT_K


def build_critique_agent(
    *,
    model,
    owner_id: str,
    tools: list | None = None,
    context_chunks: int = DEFAULT_K,
    recursion_limit: int = DEFAULT_RECURSION_LIMIT,
):
    """Build the Review agent. Frontend appends review focus into the user instruction.

    V1 is single-turn (no checkpointer). ``recursion_limit`` caps model↔tool
    loops so a runaway search loop cannot burn tokens (``create_agent`` defaults
    to 9999).
    """
    rag_tools = tools if tools is not None else [
        make_search_notes_tool(owner_id=owner_id, k=context_chunks)
    ]
    return create_agent(
        model=model,
        tools=rag_tools,
        system_prompt=CRITIQUE_SYSTEM_PROMPT_TOON,
        name="critique_agent",
    ).with_config({"recursion_limit": recursion_limit})
