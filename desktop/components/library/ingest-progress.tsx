"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import type { IngestProgressState } from "@/types/library"

const STAGE_LABEL: Record<Exclude<IngestProgressState["stage"], "idle" | "done">, string> = {
  reading: "Reading",
  chunking: "Chunking",
  embedding: "Embedding",
  saving: "Saving",
}

export function IngestProgress({
  open,
  state,
}: {
  open: boolean
  state: IngestProgressState
}) {
  const stageLabel =
    state.stage === "idle" || state.stage === "done"
      ? "Working"
      : state.stage === "embedding" &&
          state.embeddingCurrent != null &&
          state.embeddingTotal != null
        ? `Embedding (${state.embeddingCurrent}/${state.embeddingTotal})`
        : STAGE_LABEL[state.stage]

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={() => {
        /* v1 ingest is non-cancellable */
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-[24rem]">
        <DialogHeader>
          <DialogTitle>Adding note</DialogTitle>
          <DialogDescription>
            {state.noteTitle
              ? `Processing “${state.noteTitle}”. This cannot be cancelled yet.`
              : "Processing. This cannot be cancelled yet."}
          </DialogDescription>
        </DialogHeader>

        <div role="status" aria-live="polite" aria-atomic="true" className="flex flex-col gap-3">
          <p className="text-sm font-medium">{stageLabel}</p>
          <Progress value={state.percent}>
            <ProgressLabel className="sr-only">Ingest progress</ProgressLabel>
            <ProgressValue />
          </Progress>
        </div>
      </DialogContent>
    </Dialog>
  )
}
