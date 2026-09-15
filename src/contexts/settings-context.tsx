/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import type { AppSettings, StorageMode, ModelProvider, WorkflowPromptConfig } from "@/types/settings"

export type { AppSettings, StorageMode, ModelProvider, WorkflowPromptConfig }

export const DEFAULT_GENERATE_CONFIG: WorkflowPromptConfig = {
  systemPrompt: "You are a literary co-author and prose stylist. Emulate the cadence, thematic resonance, and sensory depth of the reference library. Prioritize narrative propulsion and organic dialogue without generic exposition.",
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  frequencyPenalty: 1.1,
  contextChunks: 5,
}

export const DEFAULT_CRITIQUE_CONFIG: WorkflowPromptConfig = {
  systemPrompt: "You are an incisive developmental editor. Evaluate chapter structure, prose rhythm, tonal consistency, and narrative tension against the reference style guidelines. Cite specific passages and suggest concrete line-level enhancements.",
  temperature: 0.3,
  maxTokens: 1536,
  topP: 0.8,
  frequencyPenalty: 1.0,
  contextChunks: 4,
}

const STORAGE_KEY = "writr_settings_v1"

const DEFAULT_SETTINGS: AppSettings = {
  storageMode: "default",
  modelProvider: "gemini",
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "llama3.1:8b",
  ollamaEmbeddingModel: "nomic-embed-text",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-pro",
  openAiApiKey: "",
  openRouterApiKey: "",
  localDbPath: "indexeddb://writr-local-store",
  generateConfig: DEFAULT_GENERATE_CONFIG,
  critiqueConfig: DEFAULT_CRITIQUE_CONFIG,
}

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  toggleStorageMode: () => void
  activeModelDisplayName: string
  isLocal: boolean
}

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          generateConfig: { ...DEFAULT_GENERATE_CONFIG, ...(parsed.generateConfig || {}) },
          critiqueConfig: { ...DEFAULT_CRITIQUE_CONFIG, ...(parsed.critiqueConfig || {}) },
        }
      }
    } catch {
      // fallback to default
    }
    return DEFAULT_SETTINGS
  })

  const updateSettings = React.useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...partial }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // storage quota exceeded or disabled
      }
      return updated
    })
  }, [])

  const toggleStorageMode = React.useCallback(() => {
    setSettings((prev) => {
      const nextMode: StorageMode = prev.storageMode === "default" ? "local" : "default"
      const nextProvider: ModelProvider = nextMode === "local" ? "ollama" : "gemini"
      const updated = { ...prev, storageMode: nextMode, modelProvider: nextProvider }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch {
        // quota
      }
      return updated
    })
  }, [])

  const isLocal = settings.storageMode === "local"

  const activeModelDisplayName = React.useMemo(() => {
    if (settings.modelProvider === "ollama") {
      return `Local — Ollama (${settings.ollamaModel})`
    }
    if (settings.modelProvider === "gemini") {
      return `Gemini — ${settings.geminiModel || "gemini-2.5-pro"}`
    }
    if (settings.modelProvider === "openai") {
      return "OpenAI — gpt-4o-mini"
    }
    return "OpenRouter — multi-model"
  }, [settings.modelProvider, settings.ollamaModel, settings.geminiModel])

  const value = React.useMemo(
    () => ({
      settings,
      updateSettings,
      toggleStorageMode,
      activeModelDisplayName,
      isLocal,
    }),
    [settings, updateSettings, toggleStorageMode, activeModelDisplayName, isLocal]
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextType {
  const context = React.useContext(SettingsContext)
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
