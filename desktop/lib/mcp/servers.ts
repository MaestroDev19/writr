import type { MCPAdapterConfig } from "@langchain/mcp-adapters"

import { mcpPlugin, type McpPluginId } from "@/lib/mcp/plugins"
import { assertServerSetting, McpConfigError, type McpServerSetting } from "@/lib/mcp/policy"

type ServerMap = NonNullable<MCPAdapterConfig["servers"]>
type ServerConnection = ServerMap[string]

const INHERITED_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
] as const

/**
 * Turns one author setting into the connection MCPAdapter expects.
 * Node only. The static WebView must not import this file.
 */
export function connectionFor(setting: McpServerSetting): ServerConnection {
  assertServerSetting(setting)
  if ((setting.id === "files" || setting.id === "git") && !setting.rootDir) {
    throw new McpConfigError(`${mcpPlugin(setting.id).title} needs a project folder.`)
  }
  if (setting.id === "chrome" && setting.usePersonalBrowser !== true) {
    throw new McpConfigError("Chrome DevTools stays off until you allow it to use your open Chrome.")
  }
  switch (setting.id) {
    case "fetch":
      return stdio("uvx", ["mcp-server-fetch"], pythonEnv(setting), 20_000)
    case "wiki":
      return npx(["@cyanheads/wikipedia-mcp-server"], setting.env, 20_000)
    case "time":
      return stdio(
        "uvx",
        setting.localTimezone ? ["mcp-server-time", `--local-timezone=${setting.localTimezone}`] : ["mcp-server-time"],
        pythonEnv(setting),
        10_000,
      )
    case "playwright":
      return npx(
        setting.usePersonalBrowser ? ["@playwright/mcp@latest", "--extension"] : ["@playwright/mcp@latest"],
        setting.env,
        45_000,
      )
    case "chrome":
      return npx(["chrome-devtools-mcp@latest", "--autoConnect", "--no-usage-statistics"], setting.env, 45_000)
    case "notion":
      return { url: "https://mcp.notion.com/mcp", defaultToolTimeout: 30_000 }
    case "files":
      return npx(["@modelcontextprotocol/server-filesystem", setting.rootDir ?? ""], setting.env, 15_000)
    case "git":
      return stdio("uvx", ["mcp-server-git", "--repository", setting.rootDir ?? ""], setting.env, 15_000)
    default: {
      const unreachable: never = setting.id
      throw new Error(`Unknown MCP plugin: ${unreachable}`)
    }
  }
}

export function connectionsFor(settings: readonly McpServerSetting[]): ServerMap {
  const servers: ServerMap = {}
  for (const setting of settings) {
    servers[setting.id] = connectionFor(setting)
  }
  return servers
}

function pythonEnv(setting: McpServerSetting): Record<string, string> | undefined {
  const env = childEnv(setting.env)
  if (process.platform === "win32") env.PYTHONIOENCODING = "utf-8"
  return Object.keys(env).length > 0 ? env : undefined
}

function npx(args: string[], extra: Record<string, string> | undefined, timeoutMs: number): ServerConnection {
  const env = withEnv(extra)
  if (process.platform === "win32") {
    return {
      command: "cmd",
      args: ["/c", "npx", "-y", ...args],
      ...(env ? { env } : {}),
      defaultToolTimeout: timeoutMs,
    }
  }
  return {
    command: "npx",
    args: ["-y", ...args],
    ...(env ? { env } : {}),
    defaultToolTimeout: timeoutMs,
  }
}

function stdio(
  command: string,
  args: string[],
  extra: Record<string, string> | undefined,
  timeoutMs: number,
): ServerConnection {
  const env = withEnv(extra)
  return {
    command,
    args,
    ...(env ? { env } : {}),
    defaultToolTimeout: timeoutMs,
  }
}

function withEnv(extra: Record<string, string> | undefined): Record<string, string> | undefined {
  const env = childEnv(extra)
  return Object.keys(env).length > 0 ? env : undefined
}

function childEnv(extra: Record<string, string> | undefined): Record<string, string> {
  const env: Record<string, string> = {}
  for (const key of INHERITED_ENV_KEYS) {
    const value = process.env[key]
    if (value) env[key] = value
  }
  if (extra) Object.assign(env, extra)
  return env
}

export function pluginTitle(id: McpPluginId): string {
  return mcpPlugin(id).title
}
