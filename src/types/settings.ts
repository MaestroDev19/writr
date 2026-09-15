export type StorageMode = "default" | "local"
export type ModelProvider = "ollama" | "gemini" | "groq" | "openai" | "openrouter"

export interface WorkflowPromptConfig {
  systemPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  contextChunks: number
}

export interface AppSettings {
  storageMode: StorageMode
  modelProvider: ModelProvider
  ollamaEndpoint: string
  ollamaModel: string
  ollamaEmbeddingModel: string
  geminiApiKey: string
  geminiModel: string
  openAiApiKey: string
  openRouterApiKey: string
  localDbPath: string
  generateConfig?: WorkflowPromptConfig
  critiqueConfig?: WorkflowPromptConfig
}

