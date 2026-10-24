import { ChatOllama } from "@langchain/ollama"

import type { AgentId } from "@/lib/agents/prompts"
import { temperatureFor, type ChatSettingsStored } from "@/lib/chat-settings"
import { OLLAMA_BASE_URL } from "@/lib/setup"

/**
 * Local chat model for one agent turn. No API key.
 * The name and creativity come from the author's chat settings.
 * Write uses the preset temperature. The other agents stay capped.
 */
export function createModel(settings: ChatSettingsStored, agent: AgentId): ChatOllama {
  const name = settings.model
  if (!name) {
    throw new Error("Choose a chat model before starting a turn.")
  }
  return new ChatOllama({
    model: name,
    baseUrl: OLLAMA_BASE_URL,
    temperature: temperatureFor(agent, settings.creativity),
    numCtx: 16384,
  })
}
