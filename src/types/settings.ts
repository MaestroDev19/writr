import type { ModelProvider } from "@/lib/model-providers"

export type { ModelProvider }
export type LlmSource = "default" | "byok"

export interface WorkflowPromptConfig {
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  contextChunks: number
}

/** Client-side settings only. The raw API key is never persisted here. */
export interface AppSettings {
  /** Writr-hosted model vs the author's own provider key. */
  llmSource: LlmSource
  modelProvider: ModelProvider
  /** Display / preference for Writr-hosted chat model; server may override. */
  hostedModel: string
  /** Optional chat model id when using a personal key. */
  byokModel: string
  byokKeyConfigured: boolean
  byokKeyLast4: string
  generateConfig?: WorkflowPromptConfig
  critiqueConfig?: WorkflowPromptConfig
}
