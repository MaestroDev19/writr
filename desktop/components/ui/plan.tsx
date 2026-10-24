"use client"

import * as React from "react"
import { CheckCircle2, Circle, Clock, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export interface PlanTaskItem {
  id: string | number
  title: string
  description?: string
  status: "pending" | "in_progress" | "completed"
}

interface PlanProps {
  title?: string
  tasks: PlanTaskItem[]
  className?: string
}

export function Plan({ title = "Revision Plan", tasks, className }: PlanProps) {
  if (!tasks || tasks.length === 0) return null

  const completedCount = tasks.filter((t) => t.status === "completed").length
  const progressPercent = Math.round((completedCount / tasks.length) * 100)

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border border-border bg-card/60 p-3.5 text-xs shadow-xs",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <ListChecks className="size-3.5 text-primary" />
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-md font-mono text-[10px]">
            {completedCount}/{tasks.length} ({progressPercent}%)
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-start gap-2.5 rounded-lg border border-border/40 bg-muted/20 p-2 transition-colors hover:bg-muted/40"
          >
            <div className="mt-0.5 shrink-0">
              {task.status === "completed" ? (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              ) : task.status === "in_progress" ? (
                <Clock className="size-3.5 text-primary animate-pulse" />
              ) : (
                <Circle className="size-3.5 text-muted-foreground/60" />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  "font-medium leading-tight",
                  task.status === "completed"
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                )}
              >
                {task.title}
              </span>
              {task.description ? (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {task.description}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
