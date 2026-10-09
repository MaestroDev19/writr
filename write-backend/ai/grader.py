from typing import Literal

from langgraph.graph import MessagesState
from pydantic import BaseModel, Field

from ai.model import build_default_model
from ai.prompts.user import REFERENCE_CHUNKS_RETRIEVAL_GRADER_USER_PROMPT
from ai.route import MAX_REWRITES

grader_model = build_default_model()


class GradeDocuments(BaseModel):
    """Grade documents using a binary score for relevance check."""

    binary_score: str = Field(
        description="Relevance score: 'yes' if relevant, or 'no' if not relevant"
    )


def grade_workflow(state: MessagesState) -> Literal["route", "rewrite"]:
    messages = state["messages"]
    question = messages[0].content
    context = messages[-1].content
    prompt = REFERENCE_CHUNKS_RETRIEVAL_GRADER_USER_PROMPT.format(
        context=context,
        question=question,
    )
    response = grader_model.with_structured_output(GradeDocuments).invoke(
        [{"role": "user", "content": prompt}]
    )
    score = (response.binary_score or "").strip().lower()
    rewrite_count = int(state.get("rewrite_count") or 0)
    if score == "yes" or rewrite_count >= MAX_REWRITES:
        return "route"
    return "rewrite"
