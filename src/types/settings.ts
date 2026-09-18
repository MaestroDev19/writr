export type StorageMode = "default"
export type LlmSource = "default" | "byok"
export type ModelProvider = "gemini" | "groq" | "openai" | "openrouter"

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
  storageMode: StorageMode
  /** Writr-hosted model vs the author's own provider key. */
  llmSource: LlmSource
  modelProvider: ModelProvider
  /** Display / preference for hosted chat model; server may override. */
  geminiModel: string
  /** Optional chat model id when using a personal key. */
  byokModel: string
  byokKeyConfigured: boolean
  byokKeyLast4: string
  generateConfig?: WorkflowPromptConfig
  critiqueConfig?: WorkflowPromptConfig
}
