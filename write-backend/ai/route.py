"""RagLine routing for LangGraph conditional edges.

After notes are graded relevant, ``pick_workflow`` sends the graph to the
Write (``generate``) or Review (``critique``) agent from ``state["workflow"]``.

Wire either:

1. Two hops (passthrough ``route`` node)::

       retrieve -grade_documents-> route|rewrite
       route -pick_workflow-> generate|critique

2. One hop (preferred — ``grade_documents`` already calls ``pick_workflow``)::

       retrieve -grade_documents-> generate|critique|rewrite
"""

from __future__ import annotations

from typing import Any, Literal

from langgraph.graph import MessagesState

from core.user_settings import WorkflowName

MAX_REWRITES = 2

AgentRoute = Literal["generate", "critique"]
GradeRoute = Literal["generate", "critique", "rewrite"]


class RagLineState(MessagesState):
    """Shared RagLine state for Write + Review.

    ``workflow`` is set by the API when invoking the graph (not by the LLM).
    ``rewrite_count`` caps the grade → rewrite → retrieve loop.
    """

    workflow: WorkflowName
    rewrite_count: int


def pick_workflow(state: RagLineState | dict[str, Any]) -> AgentRoute:
    """Route to Write or Review from ``state["workflow"]``.

    Used as ``add_conditional_edges("route", pick_workflow, ...)`` or inside
    ``grade_documents`` after a yes (or rewrite-cap) decision.
    """
    workflow = state.get("workflow") or "generate"
    if workflow == "critique":
        return "critique"
    return "generate"


def route_node(state: RagLineState | dict[str, Any]) -> dict:
    """No-op passthrough when using a named ``route`` node before ``pick_workflow``."""
    return {}
