/** Thin wrappers so UI works in browser preview and Tauri. */

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
