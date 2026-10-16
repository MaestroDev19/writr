"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { APP_SHORTCUTS, formatShortcutKeys } from "@/lib/shortcuts"

function shortcutParts(keys: string, isMac: boolean): string[] {
  const formatted = formatShortcutKeys(keys, isMac)
  if (isMac) {
    return formatted.match(/⌘|⇧|⌥|./g)?.filter(Boolean) ?? [formatted]
  }
  return formatted.split("+")
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform))
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-md sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="normal-case tracking-tight">
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Navigate Writr without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-1">
          {APP_SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.id}
              className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5"
            >
              <span className="text-sm text-foreground">{shortcut.label}</span>
              <KbdGroup>
                {shortcutParts(shortcut.keys, isMac).map((part, i) => (
                  <Kbd key={`${shortcut.id}-${part}-${i}`}>{part}</Kbd>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
