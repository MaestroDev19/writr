"""Rewrite author requests into simpler note-search queries (RagLine).

Used when the retrieval grader returns ``no``: rephrase for re-retrieve
on Write (generate) or Review (critique). Emits plain text — the improved
query only.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage
from langgraph.graph import MessagesState

from ai.model import build_default_model
from ai.prompts.user import QUERY_REWRITER_USER_PROMPT

rewriter_model = build_default_model()


def rewrite_workflow(state: MessagesState) -> MessagesState:
    question = state.messages[0].content 
    prompt = QUERY_REWRITER_USER_PROMPT.format(question=question)
    response = rewriter_model.invoke([{"role": "user", "content": prompt}])
    return {"messages": [HumanMessage(content=response.content)]}



