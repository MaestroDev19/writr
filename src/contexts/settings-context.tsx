/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import type { AppSettings, StorageMode, ModelProvider } from "@/types/settings"

export type { AppSettings, StorageMode, ModelProvider }

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
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
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
