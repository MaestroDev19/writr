import type { DynamicStructuredTool } from "@langchain/core/tools"
import { MCPAdapter, type AuthProvider, type MCPAdapterConfig } from "@langchain/mcp-adapters"

import type { AgentId } from "@/lib/agents/prompts"
import { mcpPlugin, type McpPluginId } from "@/lib/mcp/plugins"
import {
  allowlistedToolNames,
  serversForAgent,
  type McpConfig,
  type McpServerSetting,
} from "@/lib/mcp/policy"
import { connectionsFor, connectionFor } from "@/lib/mcp/servers"

/**
 * Node sidecar only. The Next app is a static export and cannot spawn these
 * processes. Import this module from the sidecar, never from a React component.
 *
 * How a turn uses it: desktop/skills/references/build-the-app.md
 */

export type McpFailure = {
  serverId: string
  message: string
}

export type McpToolInfo = {
  name: string
  description: string
}

export type McpSession = {
  adapter: MCPAdapter | null
  tools: DynamicStructuredTool[]
  failures: McpFailure[]
  close: () => Promise<void>
}

export async function toolsForAgent(
  config: McpConfig,
  agent: AgentId,
  auth?: { notion?: AuthProvider },
): Promise<McpSession> {
  const selected = serversForAgent(config, agent)
  if (selected.length === 0) {
    return { adapter: null, tools: [], failures: [], close: async () => {} }
  }
  const failures: McpFailure[] = []
  const adapter = openAdapter(connectionsFor(selected), failures)
  try {
    const discovered = await adapter.listTools(
      selected.map((server) => server.id),
      selected.some((server) => server.id === "notion") && auth?.notion
        ? { authProvider: auth.notion }
        : undefined,
    )
    const allowed = new Set(selected.flatMap((server) => allowlistedToolNames(server, discovered.map((tool) => tool.name))))
    return {
      adapter,
      tools: discovered.filter((tool) => allowed.has(tool.name)),
      failures,
      close: () => adapter.close(),
    }
  } catch (error) {
    await adapter.close()
    failures.push({ serverId: agent, message: failureMessage(error) })
    return { adapter: null, tools: [], failures, close: async () => {} }
  }
}

/** Lists the raw tool names a plugin advertises, so the author can allowlist them. */
export async function discoverMcpTools(setting: McpServerSetting): Promise<{ tools: McpToolInfo[]; failures: McpFailure[] }> {
  const failures: McpFailure[] = []
  const adapter = openAdapter({ [setting.id]: connectionFor(setting) }, failures)
  try {
    const tools = await adapter.listTools([setting.id])
    const prefix = `${setting.id}_`
    return {
      tools: tools.map((tool) => ({
        name: tool.name.startsWith(prefix) ? tool.name.slice(prefix.length) : tool.name,
        description: tool.description ?? "",
      })),
      failures,
    }
  } finally {
    await adapter.close()
  }
}

function openAdapter(servers: NonNullable<MCPAdapterConfig["servers"]>, failures: McpFailure[]): MCPAdapter {
  if (typeof window !== "undefined") {
    throw new Error("MCP plugins run in the Node sidecar, not the WebView.")
  }
  return new MCPAdapter({
    prefixToolNameWithServerName: true,
    onConnectionError: ({ serverName, error }) => {
      failures.push({
        serverId: serverName,
        message: `Could not connect to ${safeTitle(serverName)}.`,
      })
      console.error(`[mcp] ${serverName}`, error)
    },
    servers,
  })
}

function safeTitle(serverName: string): string {
  if (isPluginId(serverName)) return mcpPlugin(serverName).title
  return "that MCP server"
}

function isPluginId(value: string): value is McpPluginId {
  return mcpPluginIds.has(value)
}

const mcpPluginIds = new Set<string>(["fetch", "wiki", "time", "playwright", "chrome", "notion", "files", "git"])

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return "The MCP plugins could not be loaded for this turn."
  return "The MCP plugins could not be loaded for this turn."
}
