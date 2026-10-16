const KEY = "writr.setup.ready"

export function isSetupReady(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(KEY) === "1"
}

export function markSetupReady(): void {
  window.localStorage.setItem(KEY, "1")
}

export function clearSetupReady(): void {
  window.localStorage.removeItem(KEY)
}
