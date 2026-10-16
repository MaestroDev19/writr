"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  readChatSettings,
  resolveChatModel,
  writeChatSettings,
  type CreativityId,
} from "@/lib/chat-settings"
import { isEmbedModel, listOllamaModels } from "@/lib/setup"

type StatusTone = "muted" | "ok" | "error" | "busy"

type ChatSettingsContextValue = {
  ollamaOk: boolean | null
  chatModels: string[]
  selectedModel: string | null
  creativity: CreativityId
  setSelectedModel: (name: string) => void
  setCreativity: (id: CreativityId) => void
  statusLabel: string
  statusTone: StatusTone
}

const ChatSettingsContext = createContext<ChatSettingsContextValue | null>(null)

export function ChatSettingsProvider({ children }: { children: ReactNode }) {
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null)
  const [chatModels, setChatModels] = useState<string[]>([])
  const [selectedModel, setSelectedModelState] = useState<string | null>(null)
  const [creativity, setCreativityState] = useState<CreativityId>("balanced")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readChatSettings()
    setSelectedModelState(stored.model)
    setCreativityState(stored.creativity)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false

    async function load() {
      const names = await listOllamaModels()
      if (cancelled) return
      if (names === null) {
        setOllamaOk(false)
        setChatModels([])
        return
      }
      setOllamaOk(true)
      const chat = names.filter((name) => !isEmbedModel(name))
      setChatModels(chat)
      setSelectedModelState((current) => resolveChatModel(current, chat))
    }

    void load()
    const id = window.setInterval(() => {
      void load()
    }, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    writeChatSettings({ model: selectedModel, creativity })
  }, [hydrated, selectedModel, creativity])

  const setSelectedModel = useCallback((name: string) => {
    setSelectedModelState(name)
  }, [])

  const setCreativity = useCallback((id: CreativityId) => {
    setCreativityState(id)
  }, [])

  const value = useMemo<ChatSettingsContextValue>(() => {
    let statusLabel = "Checking model..."
    let statusTone: StatusTone = "busy"
    if (ollamaOk === false) {
      statusLabel = "Ollama unreachable"
      statusTone = "error"
    } else if (ollamaOk === true && selectedModel) {
      statusLabel = `Local · ${selectedModel}`
      statusTone = "ok"
    } else if (ollamaOk === true && chatModels.length > 1) {
      statusLabel = "Choose a chat model"
      statusTone = "busy"
    } else if (ollamaOk === true) {
      statusLabel = "No chat model"
      statusTone = "muted"
    }
    return {
      ollamaOk,
      chatModels,
      selectedModel,
      creativity,
      setSelectedModel,
      setCreativity,
      statusLabel,
      statusTone,
    }
  }, [chatModels, creativity, ollamaOk, selectedModel, setCreativity, setSelectedModel])

  return <ChatSettingsContext.Provider value={value}>{children}</ChatSettingsContext.Provider>
}

export function useChatSettings(): ChatSettingsContextValue {
  const value = useContext(ChatSettingsContext)
  if (!value) {
    throw new Error("useChatSettings must be used within ChatSettingsProvider")
  }
  return value
}
