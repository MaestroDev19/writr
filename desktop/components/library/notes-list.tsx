"use client"

import { BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { LibraryNote } from "@/types/library"
import { cn } from "@/lib/utils"

function statusVariant(status: LibraryNote["status"]) {
  if (status === "failed") return "destructive" as const
  if (status === "ingesting") return "default" as const
  return "secondary" as const
}

export function NotesList({
  notes,
  selectedId,
  onSelect,
  onRetry,
}: {
  notes: LibraryNote[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRetry: (id: string) => void
}) {
  if (notes.length === 0) {
    return (
      <Empty className="min-h-48 border-0 p-6">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="rounded-md bg-primary text-primary-foreground"
          >
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>No notes yet</EmptyTitle>
          <EmptyDescription>
            Add a file, paste, or link above. Notes stay on this machine and
            feed agent search.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <ScrollArea className="h-full w-full">
      <ul className="flex flex-col" role="listbox" aria-label="Notes">
        {notes.map((note) => {
          const selected = note.id === selectedId
          return (
            <li key={note.id} className="border-b border-border p-1">
              <div
                role="option"
                aria-selected={selected}
                tabIndex={0}
                className={cn(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors focus-visible:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring/30",
                  selected ? "bg-muted" : "hover:bg-muted/60"
                )}
                onClick={() => onSelect(note.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onSelect(note.id)
                  }
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{note.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {note.sourceType} · {note.sourceLabel}
                  </p>
                </div>
                <Badge
                  variant={statusVariant(note.status)}
                  className="rounded-md tracking-normal normal-case"
                >
                  {note.status}
                </Badge>
                {note.status === "failed" ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRetry(note.id)
                    }}
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </ScrollArea>
  )
}
