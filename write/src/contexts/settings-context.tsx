/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import {
  formatActiveModelDisplayName,
  isGeminiFreeModel,
  WRITR_HOSTED_MODEL,
} from "@/lib/model-providers"
import type { AppSettings, ModelProvider, WorkflowPromptConfig } from "@/types/settings"

export type { AppSettings, ModelProvider, WorkflowPromptConfig }
export type { StorageMode } from "@/types/settings"

export const DEFAULT_GENERATE_CONFIG: WorkflowPromptConfig = {
  systemPrompt:
    "You are a literary co-author and prose stylist. Emulate the cadence, thematic resonance, and sensory depth of the reference library. Prioritize narrative propulsion and organic dialogue without generic exposition.",
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.9,
  frequencyPenalty: 1.1,
  contextChunks: 5,
}

export const DEFAULT_CRITIQUE_CONFIG: WorkflowPromptConfig = {
  systemPrompt:
    "You are an incisive developmental editor. Evaluate structure, prose rhythm, tonal consistency, and narrative tension against the reference style guidelines. Cite specific passages and suggest concrete line-level enhancements.",
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
  geminiModel: WRITR_HOSTED_MODEL,
  generateConfig: DEFAULT_GENERATE_CONFIG,
  critiqueConfig: DEFAULT_CRITIQUE_CONFIG,
}

function sanitizeStoredSettings(raw: Record<string, unknown>): AppSettings {
  return {
    storageMode: "default",
    modelProvider: "gemini",
    geminiModel:
      typeof raw.geminiModel === "string" && isGeminiFreeModel(raw.geminiModel)
        ? raw.geminiModel
        : DEFAULT_SETTINGS.geminiModel,
    generateConfig: {
      ...DEFAULT_GENERATE_CONFIG,
      ...((raw.generateConfig as Partial<WorkflowPromptConfig>) || {}),
    },
    critiqueConfig: {
      ...DEFAULT_CRITIQUE_CONFIG,
      ...((raw.critiqueConfig as Partial<WorkflowPromptConfig>) || {}),
    },
  }
}

function persistSettings(settings: AppSettings) {
  try {
    // Strip legacy local/Ollama/API-key fields so old devices do not keep dead mode.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // storage quota exceeded or disabled
  }
}

interface SettingsContextType {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  activeModelDisplayName: string
}

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, unknown>
        const cleaned = sanitizeStoredSettings(parsed)
        // Rewrite storage immediately so local mode / keys do not linger.
        persistSettings(cleaned)
        return cleaned
      }
    } catch {
      // fallback to default
    }
    return DEFAULT_SETTINGS
  })

  const updateSettings = React.useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = sanitizeStoredSettings({ ...prev, ...partial })
      persistSettings(updated)
      return updated
    })
  }, [])

  const activeModelDisplayName = React.useMemo(
    () => formatActiveModelDisplayName(settings.geminiModel || WRITR_HOSTED_MODEL),
    [settings.geminiModel]
  )

  const value = React.useMemo(
    () => ({
      settings,
      updateSettings,
      activeModelDisplayName,
    }),
    [settings, updateSettings, activeModelDisplayName]
  )

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextType {
  const context = React.useContext(SettingsContext)
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}
