import type { AgentId } from "@/lib/agents/prompts"

export const CREATIVITY_IDS = ["steady", "balanced", "inventive"] as const

export type CreativityId = (typeof CREATIVITY_IDS)[number]

export type CreativityPreset = {
  id: CreativityId
  label: string
  detail: string
  /** Temperature Write is allowed to use. */
  writeTemperature: number
}

export const CREATIVITY_PRESETS: readonly CreativityPreset[] = [
  {
    id: "steady",
    label: "Steady",
    detail: "Stays close to the document and the notes.",
    writeTemperature: 0.2,
  },
  {
    id: "balanced",
    label: "Balanced",
    detail: "Default. Room to rephrase, still grounded.",
    writeTemperature: 0.6,
  },
  {
    id: "inventive",
    label: "Inventive",
    detail: "Write explores further. Scores and citations stay cooler.",
    writeTemperature: 1,
  },
]

/** Review, Bible, Research, and the planner never go above this. */
export const GROUNDED_TEMPERATURE_CAP = 0.4

const STORAGE_KEY = "writr.chat-settings.v1"

export type ChatSettingsStored = {
  model: string | null
  creativity: CreativityId
}

export function temperatureFor(agent: AgentId, creativity: CreativityId): number {
  const preset = CREATIVITY_PRESETS.find((item) => item.id === creativity)
  const writeTemperature = preset?.writeTemperature ?? 0.6
  if (agent === "write") return writeTemperature
  return Math.min(writeTemperature, GROUNDED_TEMPERATURE_CAP)
}

export function readChatSettings(): ChatSettingsStored {
  if (typeof window === "undefined") {
    return { model: null, creativity: "balanced" }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { model: null, creativity: "balanced" }
    const parsed = JSON.parse(raw) as Partial<ChatSettingsStored>
    const creativity = CREATIVITY_IDS.includes(parsed.creativity as CreativityId)
      ? (parsed.creativity as CreativityId)
      : "balanced"
    const model = typeof parsed.model === "string" && parsed.model.length > 0 ? parsed.model : null
    return { model, creativity }
  } catch {
    return { model: null, creativity: "balanced" }
  }
}

export function writeChatSettings(settings: ChatSettingsStored): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function resolveChatModel(current: string | null, installed: readonly string[]): string | null {
  if (current && installed.includes(current)) return current
  if (installed.length === 1) return installed[0] ?? null
  return null
}
