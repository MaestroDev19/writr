from langgraph.graph import MessagesState
from ai.model import build_default_model


from typing import Literal

from pydantic import BaseModel, Field
from ai.prompts.user import REFERENCE_CHUNKS_RETRIEVAL_GRADER_USER_PROMPT


grader_model = build_default_model()



class GradeDocuments(BaseModel):
    """Grade documents using a binary score for relevance check."""

    binary_score: str = Field(
        description="Relevance score: 'yes' if relevant, or 'no' if not relevant"
    )


def grade_workflow(state: MessagesState) -> Literal["route","rewrite"]:
      question = state.messages[0].content
      context = state.messages[-1].content
      prompt = REFERENCE_CHUNKS_RETRIEVAL_GRADER_USER_PROMPT.format(context=context, question=question)
      response = grader_model.with_structured_output(GradeDocuments).invoke([{"role": "user", "content": prompt}])
      if response.binary_score.lower() == "yes":
        return "route"
      
    return "rewrite" # default return if the score is not yes or no





