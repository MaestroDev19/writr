import type { GeminiModelId } from "@/lib/model-providers"

export type StorageMode = "default"
export type ModelProvider = "gemini"

export interface WorkflowPromptConfig {
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  contextChunks: number
}

/** Client-side settings. Chat and embeddings use the hosted Gemini key. */
export interface AppSettings {
  storageMode: StorageMode
  modelProvider: ModelProvider
  /** Hosted Gemini chat model. Limited to free-tier text models. */
  geminiModel: GeminiModelId
  generateConfig?: WorkflowPromptConfig
  critiqueConfig?: WorkflowPromptConfig
}
