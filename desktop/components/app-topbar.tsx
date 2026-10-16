"use client"

import { Keyboard } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { StatusPill } from "@/components/status-pill"
import { Button } from "@/components/ui/button"
import { EMBED_MODEL } from "@/lib/setup"

export function AppTopbar({
  title,
  subtitle,
  ollamaOk = true,
  modelLabel = EMBED_MODEL,
  statusLabel,
  statusTone,
  actions,
  onOpenShortcuts,
}: {
  title: string
  subtitle?: string
  ollamaOk?: boolean
  modelLabel?: string
  statusLabel?: string
  statusTone?: "muted" | "ok" | "error" | "busy"
  actions?: React.ReactNode
  onOpenShortcuts?: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-4 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur-md sm:px-7">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="truncate font-heading text-sm font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="truncate text-[11px] leading-snug text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <StatusPill
          className="hidden sm:inline-flex"
          label={statusLabel ?? (ollamaOk ? `Local · ${modelLabel}` : "Ollama unreachable")}
          tone={statusTone ?? (ollamaOk ? "ok" : "error")}
        />
        {onOpenShortcuts ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
            onClick={onOpenShortcuts}
          >
            <Keyboard />
          </Button>
        ) : null}
        <ThemeToggle />
      </div>
    </header>
  )
}
