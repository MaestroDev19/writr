"""Critique / Review agent — scored feedback; focus comes in the user instruction."""

from __future__ import annotations

from typing import Literal

from langchain.agents import create_agent
from pydantic import BaseModel, Field

from ai.agents.limits import DEFAULT_RECURSION_LIMIT
from ai.prompts.system import CRITIQUE_SYSTEM_PROMPT_TOON
from ai.tools.retriever import make_search_notes_tool
from ai.vectorstore import DEFAULT_K


class CritiqueRecommendation(BaseModel):
    """One local fix. Field order matches the Review page parser."""

    category: str = Field(description="Review focus this issue belongs to.")
    severity: Literal["high", "medium", "low"] = Field(
        description="high breaks clarity or continuity; medium hurts craft; low is polish."
    )
    issue: str = Field(description="What is wrong, citing a specific passage.")
    revised_example: str = Field(description="A local replacement for that passage.")


class CritiqueReport(BaseModel):
    """Scored review returned as structured_response. Not a replacement draft."""

    score_overall: int = Field(description="Integer 0-100, aligned with the findings.")
    pacing_score: int = Field(description="Integer 0-100 for pace and readability.")
    voice_score: int = Field(description="Integer 0-100 for voice against the notes.")
    friction_score: int = Field(description="Integer 0-100 for what makes the piece hard to read.")
    pacing_summary: str = Field(description="One or two sentences on pace.")
    voice_summary: str = Field(description="One or two sentences on voice.")
    friction_summary: str = Field(description="One or two sentences on friction.")
    recommendations: list[CritiqueRecommendation] = Field(
        description="The 3 to 7 most useful issues."
    )
    report_text: str = Field(description="Which notes were used, or that none matched.")


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
        response_format=CritiqueReport,
        name="critique_agent",
    ).with_config({"recursion_limit": recursion_limit})
