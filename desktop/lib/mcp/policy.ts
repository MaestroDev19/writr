import { z } from "zod"

import { MCP_PLUGIN_IDS, mcpPlugin, pluginAllowsAgent, type McpPluginId } from "@/lib/mcp/plugins"
import type { AgentId } from "@/lib/agents/prompts"

export class McpConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "McpConfigError"
  }
}

const BLOCKED_ENV = /supabase|service[_-]?role|writr\.db|database_url|ollama_api_key|openai_api_key|anthropic_api_key|password|secret|token/i

export const mcpServerSettingSchema = z.object({
  id: z.enum(MCP_PLUGIN_IDS),
  enabled: z.boolean(),
  /** Raw tool names from discoverMcpTools. Empty means this server contributes nothing. */
  toolAllowlist: z.array(z.string().min(1)).max(80),
  /** Project folder for `files` and `git`. */
  rootDir: z.string().min(1).optional(),
  /** Author opted into their own Chrome or Edge. Required for `chrome`. */
  usePersonalBrowser: z.boolean().optional(),
  /** IANA name passed to mcp-server-time, for example Europe/London. */
  localTimezone: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
})

export const mcpConfigSchema = z.object({
  servers: z.array(mcpServerSettingSchema).max(MCP_PLUGIN_IDS.length),
})

export type McpServerSetting = z.infer<typeof mcpServerSettingSchema>
export type McpConfig = z.infer<typeof mcpConfigSchema>

export const EMPTY_MCP_CONFIG: McpConfig = { servers: [] }

export function parseMcpConfig(raw: unknown): McpConfig {
  const parsed = mcpConfigSchema.safeParse(raw)
  if (!parsed.success) {
    throw new McpConfigError("MCP settings are not in a readable shape.")
  }
  const seen = new Set<McpPluginId>()
  for (const server of parsed.data.servers) {
    if (seen.has(server.id)) throw new McpConfigError(`MCP plugin ${server.id} is listed twice.`)
    seen.add(server.id)
    assertServerSetting(server)
  }
  return parsed.data
}

export function assertServerSetting(server: McpServerSetting): void {
  const plugin = mcpPlugin(server.id)
  if (server.env) {
    for (const [key, value] of Object.entries(server.env)) {
      if (BLOCKED_ENV.test(key) || BLOCKED_ENV.test(value)) {
        throw new McpConfigError(`${plugin.title} cannot receive that environment variable.`)
      }
    }
  }
  if (server.id === "files" || server.id === "git") {
    if (server.enabled && !server.rootDir) {
      throw new McpConfigError(`${plugin.title} needs a project folder.`)
    }
    if (server.rootDir) assertProjectRoot(server.rootDir, plugin.title)
  }
  if (server.id === "chrome" && server.enabled && server.usePersonalBrowser !== true) {
    throw new McpConfigError("Chrome DevTools stays off until you allow it to use your open Chrome.")
  }
  if (server.usePersonalBrowser && !plugin.personalBrowser) {
    throw new McpConfigError(`${plugin.title} does not attach to your browser.`)
  }
}

export function assertProjectRoot(rootDir: string, title: string): void {
  const normalized = rootDir.replace(/\\/g, "/").replace(/\/+$/, "")
  const driveRoot = /^[A-Za-z]:$/.test(normalized)
  const unixRoot = normalized === ""
  if (driveRoot || unixRoot || normalized === "." || normalized === "..") {
    throw new McpConfigError(`${title} needs a project folder, not a drive root.`)
  }
  const segments = normalized.split("/")
  if (segments.some((segment) => segment.toLowerCase() === "writr.db")) {
    throw new McpConfigError(`${title} cannot use the library database as its folder.`)
  }
}

export function serversForAgent(config: McpConfig, agent: AgentId): McpServerSetting[] {
  return config.servers.filter(
    (server) =>
      server.enabled &&
      server.toolAllowlist.length > 0 &&
      pluginAllowsAgent(server.id, agent) &&
      personalBrowserAllowed(server),
  )
}

function personalBrowserAllowed(server: McpServerSetting): boolean {
  const plugin = mcpPlugin(server.id)
  if (!plugin.personalBrowser) return true
  if (server.id === "chrome") return server.usePersonalBrowser === true
  if (server.usePersonalBrowser === true) return true
  return server.id === "playwright"
}

/** Tool names the adapter will actually expose: `serverId_rawName`. */
export function allowlistedToolNames(server: McpServerSetting, adaptedNames: readonly string[]): string[] {
  const prefix = `${server.id}_`
  const allowed = new Set(server.toolAllowlist)
  return adaptedNames.filter((name) => {
    const raw = name.startsWith(prefix) ? name.slice(prefix.length) : name
    return allowed.has(raw) || allowed.has(name)
  })
}
