"use client"

import * as React from "react"
import { Copy, Check, FileText, Sparkles, BookOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { stripMarkdown } from "@/lib/markdown-cleaner"
import { toast } from "sonner"

interface MarkdownCleanerProps {
  content: string
  onApplyToDraft?: (text: string, mode: "replace" | "append") => void
  hasTargetDraft?: boolean
  className?: string
}

export function MarkdownCleaner({
  content,
  onApplyToDraft,
  hasTargetDraft = false,
  className,
}: MarkdownCleanerProps) {
  const [viewMode, setViewMode] = React.useState<"clean" | "formatted">("clean")
  const [copiedClean, setCopiedClean] = React.useState(false)

  const cleanText = React.useMemo(() => stripMarkdown(content), [content])
  const wordCount = React.useMemo(() => {
    return cleanText ? (cleanText.match(/\S+/g)?.length ?? 0) : 0
  }, [cleanText])

  const readingMinutes = Math.max(1, Math.ceil(wordCount / 225))

  const handleCopyClean = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(cleanText)
      setCopiedClean(true)
      toast.success("Copied clean prose (markdown removed).")
      setTimeout(() => setCopiedClean(false), 2000)
    } catch {
      toast.error("Failed to copy text.")
    }
  }, [cleanText])

  if (!content) return null

  return (
    <div className={cn("flex w-full flex-col gap-2 rounded-xl border border-border/80 bg-background/50 p-3", className)}>
      {/* Top action and view mode toggle bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode("clean")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              viewMode === "clean"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Sparkles className="size-3" />
            Clean Prose
          </button>
          <button
            type="button"
            onClick={() => setViewMode("formatted")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              viewMode === "formatted"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FileText className="size-3" />
            Raw Markdown
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {wordCount.toLocaleString()} words · {readingMinutes}m read
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            className="h-6 gap-1 rounded-md px-2 text-[11px]"
            onClick={() => void handleCopyClean()}
          >
            {copiedClean ? (
              <>
                <Check className="size-3 text-emerald-500" />
                Copied Clean
              </>
            ) : (
              <>
                <Copy className="size-3" />
                Copy Clean
              </>
            )}
          </Button>

          {hasTargetDraft && onApplyToDraft ? (
            <>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-6 gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => onApplyToDraft(cleanText, "replace")}
                title="Replace attached target draft with clean revision"
              >
                Replace Draft
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-6 gap-1 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => onApplyToDraft(cleanText, "append")}
                title="Append clean revision to attached target draft"
              >
                Append
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Content display */}
      <div
        className={cn(
          "max-h-[360px] overflow-y-auto leading-relaxed whitespace-pre-wrap text-sm",
          viewMode === "clean"
            ? "font-serif text-[15px] leading-relaxed text-foreground/95 select-text"
            : "font-mono text-xs text-foreground/80 select-text"
        )}
      >
        {viewMode === "clean" ? cleanText : content}
      </div>
    </div>
  )
}
