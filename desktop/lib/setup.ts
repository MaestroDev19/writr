import type { SetupStep } from "@/types/library"

const OLLAMA_BASE_URL = "http://127.0.0.1:11434"
const OLLAMA_TAGS = `${OLLAMA_BASE_URL}/api/tags`
const EMBED_MODEL = "nomic-embed-text"

export { OLLAMA_BASE_URL }

export { EMBED_MODEL }

export async function pingOllama(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_TAGS, { method: "GET", signal: AbortSignal.timeout(2500) })
    return res.ok
  } catch {
    return false
  }
}

export function isEmbedModel(name: string): boolean {
  const normalized = name.toLowerCase()
  return normalized === EMBED_MODEL || normalized.startsWith(`${EMBED_MODEL}:`)
}

/** null when Ollama cannot be reached. Names include the embed model. */
export async function listOllamaModels(): Promise<string[] | null> {
  try {
    const res = await fetch(OLLAMA_TAGS, { method: "GET", signal: AbortSignal.timeout(2500) })
    if (!res.ok) return null
    const data = (await res.json()) as { models?: Array<{ name?: string }> }
    return (data.models ?? [])
      .map((model) => model.name?.trim() ?? "")
      .filter((name) => name.length > 0)
  } catch {
    return null
  }
}

/** Downloads nomic-embed-text from the local Ollama server. No API key. */
export async function pullEmbedModel(
  onProgress?: (update: { percent: number; status: string }) => void,
): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, stream: true }),
  })
  if (!res.ok || !res.body) {
    throw new Error(`Could not pull ${EMBED_MODEL}.`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line) as {
        status?: string
        completed?: number
        total?: number
        error?: string
      }
      if (event.error) throw new Error(event.error)
      const percent =
        event.total && event.total > 0
          ? Math.min(100, Math.round((100 * (event.completed ?? 0)) / event.total))
          : 0
      onProgress?.({ percent, status: event.status ?? "pulling" })
    }
  }
}

export async function hasEmbedModel(): Promise<boolean> {
  try {
    const res = await fetch(OLLAMA_TAGS, { method: "GET", signal: AbortSignal.timeout(2500) })
    if (!res.ok) return false
    const data = (await res.json()) as { models?: Array<{ name?: string }> }
    return (data.models ?? []).some(
      (m) => m.name === EMBED_MODEL || m.name?.startsWith(`${EMBED_MODEL}:`)
    )
  } catch {
    return false
  }
}

/** Stub until local DB migrate lands — always succeeds in UI-first phase. */
export async function ensureLocalDatabase(): Promise<{ ok: boolean; error?: string }> {
  await new Promise((r) => setTimeout(r, 200))
  return { ok: true }
}

export function initialSetupSteps(): SetupStep[] {
  return [
    { id: "ollama", label: "Ollama", status: "pending" },
    { id: "model", label: "Model pull", status: "pending", detail: EMBED_MODEL },
    { id: "database", label: "Local database", status: "pending" },
  ]
}

export async function openOllamaInstallDocs(): Promise<void> {
  const url = "https://ollama.com/download"
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener")
    await openUrl(url)
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}
