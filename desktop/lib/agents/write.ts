import type { AuthProvider } from "@langchain/mcp-adapters"

import type { ChatSettingsStored } from "@/lib/chat-settings"
import { buildAgent } from "@/lib/agents/build"
import { AGENT_IDS, type AgentId } from "@/lib/agents/prompts"
import { toolsForAgent, type McpFailure, type McpSession } from "@/lib/mcp/host"
import type { McpConfig } from "@/lib/mcp/policy"
import { createModel } from "@/lib/model"
import type { ProjectSearch } from "@/lib/tools/search-project"

export { AGENT_RECURSION_LIMIT, WRITE_RECURSION_LIMIT, buildAgent, buildWriteAgent } from "@/lib/agents/build"
export type { AgentTool, BuildAgentInput } from "@/lib/agents/build"

/**
 * Write, Critique, Story Bible, Research, and the Revision Planner.
 * Each agent gets its own ChatOllama and its skill. Write, Critique,
 * Story Bible, and Research also get search_project and the MCP tools
 * their plugins allow. Call close() after the turns finish so the adapters drop.
 * Sidecar only. The WebView must not import this module.
 */
export async function buildAgents(input: {
  settings: ChatSettingsStored
  search: ProjectSearch
  mcp?: McpConfig
  auth?: { notion?: AuthProvider }
}) {
  const { settings, search, mcp, auth } = input
  const sessions = mcp ? await openSessions(mcp, auth) : new Map<AgentId, McpSession>()

  const one = (agent: AgentId) =>
    buildAgent({
      agent,
      model: createModel(settings, agent),
      search: agent === "revision-planner" ? undefined : search,
      tools: sessions.get(agent)?.tools ?? [],
    })

  return {
    write: one("write"),
    critique: one("critique"),
    "story-bible": one("story-bible"),
    research: one("research"),
    "revision-planner": one("revision-planner"),
    failures: [...sessions.values()].flatMap((session) => session.failures),
    close: async () => {
      await Promise.all([...sessions.values()].map((session) => session.close()))
    },
  }
}

async function openSessions(mcp: McpConfig, auth: { notion?: AuthProvider } | undefined): Promise<Map<AgentId, McpSession>> {
  const opened = await Promise.all(
    AGENT_IDS.map(async (agent) => [agent, await toolsForAgent(mcp, agent, auth)] as const),
  )
  return new Map(opened)
}

export type { McpFailure }


