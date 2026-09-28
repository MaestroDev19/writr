export type StorageMode = "default"
export type ModelProvider = "gemini" | "groq" | "openai" | "openrouter"

export interface WorkflowPromptConfig {
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  contextChunks: number
}

/** Client-side settings only. API keys and embedding models live on the backend. */
export interface AppSettings {
  storageMode: StorageMode
  modelProvider: ModelProvider
  /** Display / preference for hosted chat model; server may override. */
  geminiModel: string
  generateConfig?: WorkflowPromptConfig
  critiqueConfig?: WorkflowPromptConfig
}
