"use client"

import * as React from "react"
import { Wrench, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

export interface ToolCallData {
  name: string
  args?: Record<string, unknown> | string
  status?: "running" | "completed" | "error"
  output?: string | number | Record<string, unknown>
}

interface ToolProps {
  tool: ToolCallData
  defaultOpen?: boolean
  className?: string
}

export function Tool({ tool, defaultOpen = false, className }: ToolProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const isRunning = tool.status === "running"
  const isError = tool.status === "error"

  return (
    <div className={cn("w-full py-1", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="group/tool flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">
          {isRunning ? (
            <Spinner className="size-3 text-primary" />
          ) : isError ? (
            <AlertCircle className="size-3 text-destructive" />
          ) : (
            <Wrench className="size-3 text-primary/80" />
          )}
          <span className="font-mono font-medium text-foreground/90">
            {tool.name}
          </span>
          <Badge
            variant={isRunning ? "secondary" : isError ? "destructive" : "outline"}
            className="rounded-md px-1.5 py-0 font-mono text-[10px] font-normal"
          >
            {isRunning ? "calling" : isError ? "failed" : "completed"}
          </Badge>
          <ChevronRight className="ml-auto size-3 transition-transform duration-200 group-aria-expanded/tool:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5 font-mono text-[11px]">
            {tool.args ? (
              <div>
                <span className="text-muted-foreground">Input: </span>
                <span className="text-foreground">
                  {typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args)}
                </span>
              </div>
            ) : null}
            {tool.output ? (
              <div>
                <span className="text-muted-foreground">Result: </span>
                <span className="text-foreground">
                  {typeof tool.output === "string"
                    ? tool.output
                    : JSON.stringify(tool.output)}
                </span>
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
