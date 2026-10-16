"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { LibraryNote } from "@/types/library"

export function NoteDetail({
  note,
  onRetry,
  onClear,
}: {
  note: LibraryNote
  onRetry: (id: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight">{note.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {note.sourceType} · {note.sourceLabel}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Search
        </Button>
      </div>

      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge
              variant={
                note.status === "failed"
                  ? "destructive"
                  : note.status === "ready"
                    ? "secondary"
                    : "default"
              }
            >
              {note.status}
            </Badge>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted-foreground">SHA</dt>
          <dd className="font-mono text-xs tabular-nums">{note.shaShort}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-border py-2">
          <dt className="text-muted-foreground">Added</dt>
          <dd className="text-xs tabular-nums">
            {new Date(note.createdAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      {note.status === "failed" && note.errorMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Ingest failed</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{note.errorMessage}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit"
              onClick={() => onRetry(note.id)}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
