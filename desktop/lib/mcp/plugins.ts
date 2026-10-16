import type { AgentId } from "@/lib/agents/prompts"

/**
 * Free MCP servers the author can turn on for the desktop agents.
 * Every plugin ships disabled. An empty allowlist attaches no tools.
 * Server ids stay short: LangChain prefixes them onto tool names, and
 * OpenAI-compatible tool names allow 64 characters.
 */

export const MCP_PLUGIN_IDS = [
  "fetch",
  "wiki",
  "time",
  "playwright",
  "chrome",
  "notion",
  "files",
  "git",
] as const

export type McpPluginId = (typeof MCP_PLUGIN_IDS)[number]

export type McpPlugin = {
  id: McpPluginId
  title: string
  summary: string
  /** Agents that may receive this plugin's tools. */
  agents: readonly AgentId[]
  /** Attaches to the author's open Chrome or Edge. Stays off until they opt in. */
  personalBrowser: boolean
  /** Present after `discoverMcpTools`. The author copies the ones they want. */
  suggestedTools: readonly string[]
  install: string
}

export const MCP_PLUGINS: readonly McpPlugin[] = [
  {
    id: "fetch",
    title: "Fetch",
    summary: "Reads a public URL and returns markdown. Research uses this the same way as research_fetch.",
    agents: ["research"],
    personalBrowser: false,
    suggestedTools: ["fetch"],
    install: "uvx mcp-server-fetch",
  },
  {
    id: "wiki",
    title: "Wikipedia",
    summary: "Searches and reads Wikipedia. No API key.",
    agents: ["research"],
    personalBrowser: false,
    suggestedTools: [],
    install: "npx -y @cyanheads/wikipedia-mcp-server",
  },
  {
    id: "time",
    title: "Time",
    summary: "Current time and timezone conversion for citation dates.",
    agents: ["research"],
    personalBrowser: false,
    suggestedTools: ["get_current_time", "convert_time"],
    install: "uvx mcp-server-time",
  },
  {
    id: "playwright",
    title: "Playwright",
    summary:
      "App-owned browser for pages Fetch cannot read. With usePersonalBrowser, attaches to the author's Chrome or Edge through the Playwright extension.",
    agents: ["research"],
    personalBrowser: true,
    suggestedTools: ["browser_navigate", "browser_snapshot", "browser_tabs"],
    install: "npx -y @playwright/mcp@latest",
  },
  {
    id: "chrome",
    title: "Chrome DevTools",
    summary:
      "Attaches to the Chrome window the author already has open, including signed-in tabs. Requires Chrome 144+ and remote debugging allowed in that window.",
    agents: ["research"],
    personalBrowser: true,
    suggestedTools: [],
    install: "npx -y chrome-devtools-mcp@latest --autoConnect",
  },
  {
    id: "notion",
    title: "Notion",
    summary:
      "Official Notion server. Write can read connected pages as evidence. Research and Story Bible imports become notes or proposals. The Notion URL is the source.",
    agents: ["write", "research", "story-bible"],
    personalBrowser: false,
    suggestedTools: [],
    install: "https://mcp.notion.com/mcp",
  },
  {
    id: "files",
    title: "Filesystem",
    summary:
      "Read-only stand-in for fs_read. The root must be the project folder. Suggested tools are the reference server's read tools.",
    agents: ["write", "critique"],
    personalBrowser: false,
    suggestedTools: [
      "read_file",
      "read_multiple_files",
      "list_directory",
      "list_directory_with_sizes",
      "directory_tree",
      "search_files",
      "get_file_info",
      "list_allowed_directories",
    ],
    install: "npx -y @modelcontextprotocol/server-filesystem <project folder>",
  },
  {
    id: "git",
    title: "Git",
    summary: "Read-only git history for a manuscript repo. Suggested tools omit commit, add, reset, and checkout.",
    agents: ["write", "critique"],
    personalBrowser: false,
    suggestedTools: ["git_status", "git_diff_unstaged", "git_diff_staged", "git_diff", "git_log", "git_show"],
    install: "uvx mcp-server-git --repository <project folder>",
  },
]

const BY_ID = new Map(MCP_PLUGINS.map((plugin) => [plugin.id, plugin]))

export function mcpPlugin(id: McpPluginId): McpPlugin {
  const plugin = BY_ID.get(id)
  if (!plugin) throw new Error(`Unknown MCP plugin: ${id}`)
  return plugin
}

export function pluginAllowsAgent(id: McpPluginId, agent: AgentId): boolean {
  return mcpPlugin(id).agents.includes(agent)
}
