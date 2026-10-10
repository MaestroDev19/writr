import asyncio

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from ai.agents import build_critique_agent, build_generate_agent
from ai.model import build_model_for_user
from core.limiter import limiter
from core.user_settings import WorkflowName
from services.supabase import AsyncServiceSupabaseDep, CurrentUserIdDep
from utils.log import bind, scrub

AgentsRouter = APIRouter(prefix="/agents", tags=["agents"])


class AgentRequest(BaseModel):
    """FE-built instruction (+ target text) as one user message."""

    content: str = Field(min_length=1)


class AgentResponse(BaseModel):
    response: str


def _invoke_agent(agent, content: str):
    return agent.invoke({"messages": [{"role": "user", "content": content}]})


async def _run_agent(
    *,
    workflow: WorkflowName,
    content: str,
    user_id: str,
    supabase: AsyncServiceSupabaseDep,
) -> AgentResponse:
    bind(operation=f"agent_{workflow}", user_id=user_id)
    try:
        model = await build_model_for_user(supabase, user_id, workflow=workflow)
        if workflow == "critique":
            agent = build_critique_agent(model=model, owner_id=user_id)
        else:
            agent = build_generate_agent(model=model, owner_id=user_id)
        result = await asyncio.to_thread(_invoke_agent, agent, content)
        text = result["messages"][-1].content
        if not isinstance(text, str):
            text = str(text or "")
    except Exception as exc:
        bind(
            user_id=user_id,
            error_type=type(exc).__name__,
            error_message=scrub(str(exc)),
            outcome="error",
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not run {workflow}.",
        ) from exc

    bind(user_id=user_id, outcome="success")
    return AgentResponse(response=text)


@AgentsRouter.post("/write")
@limiter.limit("10/minute")
async def write(
    request: Request,
    payload: AgentRequest,
    user_id: CurrentUserIdDep,
    supabase: AsyncServiceSupabaseDep,
) -> AgentResponse:
    return await _run_agent(
        workflow="generate",
        content=payload.content,
        user_id=user_id,
        supabase=supabase,
    )


@AgentsRouter.post("/critique")
@limiter.limit("10/minute")
async def critique(
    request: Request,
    payload: AgentRequest,
    user_id: CurrentUserIdDep,
    supabase: AsyncServiceSupabaseDep,
) -> AgentResponse:
    return await _run_agent(
        workflow="critique",
        content=payload.content,
        user_id=user_id,
        supabase=supabase,
    )
