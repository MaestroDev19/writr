"use client"

import * as React from "react"
import { Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace"
import { Spinner, LoadingText } from "@/components/ui/spinner"

interface ReasoningProps {
  /** The model's chain-of-thought or reasoning text */
  reasoning: string
  /** Whether the reasoning is actively in progress/streaming */
  isRunning?: boolean
  /** Optional title override */
  title?: string
  /** Optional duration or word count description */
  description?: string
  /** Default open state */
  defaultOpen?: boolean
  className?: string
}

export function Reasoning({
  reasoning,
  isRunning = false,
  title,
  description,
  defaultOpen,
  className,
}: ReasoningProps) {
  const [userOpen, setUserOpen] = React.useState<boolean | undefined>(defaultOpen)
  const open = isRunning ? true : (userOpen ?? false)

  if (!reasoning && !isRunning) return null

  return (
    <Trace className={cn("w-full py-1", className)}>
      <TraceCollapsible open={open} onOpenChange={setUserOpen}>
        <TraceCollapsibleTrigger className="rounded-lg bg-muted/40 px-2.5 py-1.5 transition-colors hover:bg-muted/70">
          <TraceLine status={isRunning ? "running" : undefined}>
            <TraceIcon>
              {isRunning ? (
                <Spinner variant="pulse" className="size-3.5" />
              ) : (
                <Brain className="size-3.5 text-primary/80" />
              )}
            </TraceIcon>
            <TraceTitle className="text-xs font-medium text-foreground/90">
              {title ? (
                title
              ) : isRunning ? (
                <LoadingText
                  messages={[
                    "Reasoning through draft…",
                    "Evaluating continuity & context…",
                    "Formulating critique & revisions…",
                  ]}
                  showDots={false}
                />
              ) : (
                "Reasoning process"
              )}
            </TraceTitle>
            {description ? (
              <TraceDescription className="text-[11px]">
                {description}
              </TraceDescription>
            ) : null}
          </TraceLine>
        </TraceCollapsibleTrigger>
        <TraceCollapsibleContent className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {reasoning || "Analyzing document slice and querying library memory…"}
        </TraceCollapsibleContent>
      </TraceCollapsible>
    </Trace>
  )
}
