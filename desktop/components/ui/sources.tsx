"use client"

import * as React from "react"
import { BookOpen, ChevronRight, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export interface SourceReference {
  id?: string | number
  title: string
  content?: string
  score?: number
  chunkIndex?: number
  metadata?: Record<string, unknown>
}

interface SourcesProps {
  sources: SourceReference[]
  defaultOpen?: boolean
  className?: string
}

export function Sources({ sources, defaultOpen = false, className }: SourcesProps) {
  const [open, setOpen] = React.useState(defaultOpen)

  if (!sources || sources.length === 0) return null

  return (
    <div className={cn("w-full py-1", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="group/sources flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
          <BookOpen className="size-3 text-primary/80" />
          <span className="font-medium text-foreground/90">
            {sources.length} {sources.length === 1 ? "source cited" : "sources cited"}
          </span>
          <ChevronRight className="size-3 transition-transform duration-200 group-aria-expanded/sources:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {sources.map((source, idx) => (
              <div
                key={source.id ?? idx}
                className="group relative flex flex-col gap-1 rounded-lg border border-border bg-card/60 p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                    <FileText className="size-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{source.title}</span>
                  </div>
                  {source.score !== undefined ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-md border-border/80 px-1 py-0 font-mono text-[9px] font-normal text-muted-foreground"
                    >
                      {Math.round(source.score * 100)}% match
                    </Badge>
                  ) : null}
                </div>
                {source.content ? (
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                    {source.content}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
