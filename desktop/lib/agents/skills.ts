import type { AgentId } from "@/lib/agents/prompts"
import { BUNDLED_SKILLS } from "@/lib/agents/skills-content"

/**
 * Operating skill for one agent, plus the shared harness and document-kind notes.
 * This is not the system prompt. The prompt stays a separate content block.
 * Works seamlessly in both browser webview and Node runtime.
 */
export function loadAgentSkill(agent: AgentId): string {
  const hit = BUNDLED_SKILLS[agent]
  if (hit) return hit
  throw new Error(`Could not find skill for agent: ${agent}`)
}
