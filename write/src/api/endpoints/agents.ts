import { api } from "@/lib/axios"
import { assertAgentContent } from "@/lib/agent-content"

export interface AgentResponse {
  response: string
}

/**
 * Client budget for agent + tools. Must stay under write-backend
 * `vercel.json` functions.main.py.maxDuration (120s).
 */
const AGENT_TIMEOUT_MS = 90_000

/** POST /agents/write — FE-built user message as `content`. */
export async function writeAgent(content: string): Promise<AgentResponse> {
  assertAgentContent(content)
  const { data } = await api.post<AgentResponse>(
    "/agents/write",
    { content },
    { timeout: AGENT_TIMEOUT_MS }
  )
  return data
}

/** POST /agents/critique — FE-built user message as `content`. */
export async function critiqueAgent(content: string): Promise<AgentResponse> {
  assertAgentContent(content)
  const { data } = await api.post<AgentResponse>(
    "/agents/critique",
    { content },
    { timeout: AGENT_TIMEOUT_MS }
  )
  return data
}
