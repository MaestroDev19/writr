/** Thin wrappers so UI works in browser preview and Tauri. */

const OLLAMA_INSTALL_URL = "https://ollama.com/download"

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
}

export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener")
      await openUrl(url)
      return
    } catch {
      // Fall through if plugin not linked yet.
    }
  }
  window.open(url, "_blank", "noopener,noreferrer")
}

export async function openOllamaInstall(): Promise<void> {
  await openExternal(OLLAMA_INSTALL_URL)
}

const ALLOWED_EXTENSIONS = [".docx", ".txt", ".md"] as const

export type PickedFile = {
  name: string
  path?: string
  text?: string
}

export async function pickLibraryFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Notes",
            extensions: ["docx", "txt", "md"],
          },
        ],
      })
      if (!selected || Array.isArray(selected)) return null
      const name = selected.split(/[/\\]/).pop() ?? selected
      return { name, path: selected }
    } catch {
      // Fall through to HTML input.
    }
  }

  return pickViaHtmlInput()
}

function pickViaHtmlInput(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ALLOWED_EXTENSIONS.join(",")
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const lower = file.name.toLowerCase()
      if (lower.endsWith(".pdf")) {
        resolve({ name: file.name })
        return
      }
      if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
        resolve({ name: file.name })
        return
      }
      const text = lower.endsWith(".docx")
        ? undefined
        : await file.text()
      resolve({ name: file.name, text })
    }
    input.click()
  })
}

export function isUnsupportedLibraryFile(name: string): boolean {
  const lower = name.toLowerCase()
  if (lower.endsWith(".pdf")) return true
  return !ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export async function pingOllama(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function hasEmbedModel(
  model = "nomic-embed-text"
): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    })
    if (!res.ok) return false
    const data = (await res.json()) as {
      models?: Array<{ name?: string }>
    }
    return (data.models ?? []).some((m) =>
      (m.name ?? "").toLowerCase().includes(model.toLowerCase())
    )
  } catch {
    return false
  }
}
