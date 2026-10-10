import { MAX_AGENT_CONTENT_CHARS } from "@/api/limits"

export function agentContentTooLong(content: string): boolean {
  return content.length > MAX_AGENT_CONTENT_CHARS
}

/** Refuse oversized /agents/* bodies before they hit the network. */
export function assertAgentContent(content: string): void {
  if (!agentContentTooLong(content)) return
  throw new Error(
    `This request is too long (${content.length.toLocaleString()} characters). Keep instructions and the file under ${MAX_AGENT_CONTENT_CHARS.toLocaleString()} characters.`
  )
}
