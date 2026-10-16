export type AppShortcut = {
  id: string
  keys: string
  label: string
  href?: string
  action?: "theme" | "shortcuts"
}

/** Global writr desktop shortcuts (mod = Ctrl on Windows, ⌘ on macOS). */
export const APP_SHORTCUTS: AppShortcut[] = [
  { id: "home", keys: "mod+1", label: "Go to Home", href: "/home" },
  { id: "library", keys: "mod+2", label: "Go to Library", href: "/library" },
  { id: "write", keys: "mod+3", label: "Go to Write", href: "/write" },
  { id: "review", keys: "mod+4", label: "Go to Review", href: "/review" },
  { id: "settings", keys: "mod+,", label: "Open Settings", href: "/settings" },
  {
    id: "theme",
    keys: "mod+shift+l",
    label: "Toggle light / dark",
    action: "theme",
  },
  {
    id: "help",
    keys: "mod+/",
    label: "Keyboard shortcuts",
    action: "shortcuts",
  },
]

export function isModKey(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey
}

export function matchesShortcut(event: KeyboardEvent, keys: string) {
  const parts = keys.toLowerCase().split("+")
  const needMod = parts.includes("mod")
  const needShift = parts.includes("shift")
  const needAlt = parts.includes("alt")
  const key = parts.filter((p) => !["mod", "shift", "alt", "ctrl", "meta"].includes(p))[0]

  if (!key) return false
  if (needMod !== isModKey(event)) return false
  if (needShift !== event.shiftKey) return false
  if (needAlt !== event.altKey) return false

  const pressed = event.key.toLowerCase()
  if (pressed === key) return true
  // Digit keys: event.key is "1", shortcut uses "1"
  if (key.length === 1 && pressed === key) return true
  return false
}

export function formatShortcutKeys(keys: string, isMac: boolean) {
  return keys
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl"
      if (part === "shift") return isMac ? "⇧" : "Shift"
      if (part === "alt") return isMac ? "⌥" : "Alt"
      if (part === ",") return ","
      if (part === "/") return "/"
      return part.toUpperCase()
    })
    .join(isMac ? "" : "+")
}
