import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { ClientTool, ServerTool } from "@langchain/core/tools"
import { SystemMessage, createAgent, dynamicSystemPromptMiddleware } from "langchain"

import { loadAgentSkill } from "@/lib/agents/skills"
import { AGENT_SYSTEM_PROMPTS, type AgentId } from "@/lib/agents/prompts"
import {
  agentContextSchema,
  searchProjectTool,
  type ProjectSearch,
} from "@/lib/tools/search-project"

/** Passed to invoke. No checkpointer in v1, so a turn does not resume. */
export const AGENT_RECURSION_LIMIT = 12

/** Write kept this name. Every agent uses the same cap. */
export const WRITE_RECURSION_LIMIT = AGENT_RECURSION_LIMIT

export type AgentTool = ClientTool | ServerTool

/**
 * First-party library search. The Revision Planner reads findings already
 * on the turn and must not discover new issues.
 */
const LIBRARY_SEARCH_AGENTS: readonly AgentId[] = [
  "write",
  "critique",
  "story-bible",
  "research",
]

export type BuildAgentInput = {
  agent: AgentId
  model: BaseChatModel
  /**
   * Closed over userId and projectId inside search_project.
   * Required for every agent except the Revision Planner.
   */
  search?: ProjectSearch
  /** MCP tools the sidecar appends after first-party tools. */
  tools?: readonly AgentTool[]
}

/**
 * One createAgent harness for all five agents.
 * The id selects the system prompt, the operating skill, and whether search_project is attached.
 * Middleware appends the skill as its own system block, after the voice prompt.
 * MCP tools follow first-party tools. Keep their adapter open until invoke finishes.
 */
export function buildAgent({ agent, model, search, tools = [] }: BuildAgentInput) {
  const firstParty = LIBRARY_SEARCH_AGENTS.includes(agent) ? [searchProjectTool(requireSearch(agent, search))] : []
  const skill = loadAgentSkill(agent)

  return createAgent({
    model,
    tools: [...firstParty, ...tools],
    systemPrompt: AGENT_SYSTEM_PROMPTS[agent],
    contextSchema: agentContextSchema,
    middleware: [
      dynamicSystemPromptMiddleware(
        () =>
          new SystemMessage({
            content: [{ type: "text", text: skill }],
          }),
      ),
    ],
  })
}

export function buildWriteAgent(model: BaseChatModel, search: ProjectSearch, tools?: readonly AgentTool[]) {
  return buildAgent({ agent: "write", model, search, tools })
}

function requireSearch(agent: AgentId, search: ProjectSearch | undefined): ProjectSearch {
  if (search) return search
  throw new Error(`Library search is required for the ${agent} agent.`)
}
