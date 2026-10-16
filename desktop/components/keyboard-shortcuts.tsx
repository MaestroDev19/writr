"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog"
import { APP_SHORTCUTS, matchesShortcut } from "@/lib/shortcuts"

const HELP_EVENT = "writr:open-shortcuts"

export function openShortcutsHelp() {
  window.dispatchEvent(new Event(HELP_EVENT))
}

export function KeyboardShortcuts() {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    function onHelp() {
      setHelpOpen(true)
    }
    window.addEventListener(HELP_EVENT, onHelp)
    return () => window.removeEventListener(HELP_EVENT, onHelp)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return

      for (const shortcut of APP_SHORTCUTS) {
        if (!matchesShortcut(event, shortcut.keys)) continue

        event.preventDefault()

        if (shortcut.href) {
          router.push(shortcut.href)
          return
        }

        if (shortcut.action === "shortcuts") {
          setHelpOpen((open) => !open)
          return
        }

        if (shortcut.action === "theme") {
          setTheme(resolvedTheme === "dark" ? "light" : "dark")
          return
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router, resolvedTheme, setTheme])

  return (
    <KeyboardShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
  )
}
