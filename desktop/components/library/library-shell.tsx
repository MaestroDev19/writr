"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { FileUp, ClipboardPaste, Link2, Blocks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotesList } from "@/components/library/notes-list"
import { NoteDetail } from "@/components/library/note-detail"
import { SearchPane } from "@/components/library/search-pane"
import { AddFilePanel } from "@/components/library/add-file-panel"
import { AddPastePanel } from "@/components/library/add-paste-panel"
import { AddLinkPanel } from "@/components/library/add-link-panel"
import { IngestProgress } from "@/components/library/ingest-progress"
import { pingOllama } from "@/lib/setup"
import type {
  IngestProgressState,
  LibraryNote,
  SearchHit,
} from "@/types/library"

type AddMode = "file" | "paste" | "link" | null

function shortSha(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, "0").slice(0, 8)
}

const IDLE_PROGRESS: IngestProgressState = {
  stage: "idle",
  percent: 0,
}

export function LibraryShell() {
  const [notes, setNotes] = useState<LibraryNote[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addMode, setAddMode] = useState<AddMode>(null)
  const [progress, setProgress] = useState<IngestProgressState>(IDLE_PROGRESS)
  const [busy, setBusy] = useState(false)
  const [ollamaOk, setOllamaOk] = useState(true)

  useEffect(() => {
    void pingOllama().then(setOllamaOk)
    const id = window.setInterval(() => {
      void pingOllama().then(setOllamaOk)
    }, 15_000)
    return () => window.clearInterval(id)
  }, [])

  const selected = notes.find((n) => n.id === selectedId) ?? null

  const runIngest = useCallback(
    async (
      draft: Omit<LibraryNote, "status" | "createdAt"> & { bodyKey: string }
    ) => {
      const existing = notes.find((n) => n.shaShort === draft.shaShort)
      if (existing) return "duplicate" as const

      setBusy(true)
      const id = crypto.randomUUID()
      const ingesting: LibraryNote = {
        id,
        title: draft.title,
        sourceType: draft.sourceType,
        sourceLabel: draft.sourceLabel,
        shaShort: draft.shaShort,
        status: "ingesting",
        createdAt: new Date().toISOString(),
      }
      setNotes((prev) => [ingesting, ...prev])
      setSelectedId(id)

      const stages: Array<{
        stage: IngestProgressState["stage"]
        percent: number
      }> = [
        { stage: "reading", percent: 15 },
        { stage: "chunking", percent: 35 },
        { stage: "embedding", percent: 70 },
        { stage: "saving", percent: 90 },
      ]

      try {
        for (const step of stages) {
          setProgress({
            stage: step.stage,
            percent: step.percent,
            noteTitle: draft.title,
            embeddingCurrent: step.stage === "embedding" ? 2 : undefined,
            embeddingTotal: step.stage === "embedding" ? 4 : undefined,
          })
          await new Promise((r) => setTimeout(r, 350))
        }

        if (draft.sourceType === "link" && draft.bodyKey.length < 12) {
          throw new Error("thin")
        }

        setProgress({ stage: "done", percent: 100, noteTitle: draft.title })
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, status: "ready" as const } : n
          )
        )
        return "ok" as const
      } catch (err) {
        const thin = err instanceof Error && err.message === "thin"
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  status: "failed" as const,
                  errorMessage: thin
                    ? "Page extract was too thin to index."
                    : "Ingest failed. Retry when Ollama is up.",
                }
              : n
          )
        )
        return thin ? ("thin" as const) : ("error" as const)
      } finally {
        setBusy(false)
        setProgress(IDLE_PROGRESS)
        setAddMode(null)
      }
    },
    [notes]
  )

  async function handleRetry(id: string) {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, status: "ingesting", errorMessage: undefined }
          : n
      )
    )
    setBusy(true)
    setProgress({
      stage: "embedding",
      percent: 55,
      noteTitle: note.title,
      embeddingCurrent: 1,
      embeddingTotal: 3,
    })
    await new Promise((r) => setTimeout(r, 600))
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: "ready" } : n))
    )
    setBusy(false)
    setProgress(IDLE_PROGRESS)
  }

  async function handleSearch(query: string): Promise<SearchHit[]> {
    const q = query.toLowerCase()
    const ready = notes.filter((n) => n.status === "ready")
    return ready
      .filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.sourceLabel.toLowerCase().includes(q)
      )
      .slice(0, 12)
      .map((n, i) => ({
        id: `${n.id}-hit`,
        noteId: n.id,
        noteTitle: n.title,
        snippet: `Local hit for "${query}" in ${n.title}. Full hybrid retrieve wires when the embed index is ready.`,
        ordinal: i + 1,
        score: Math.max(0.4, 1 - i * 0.07),
      }))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border bg-muted/40 px-5 py-3.5 sm:px-6">
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
          Add notes
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-md"
          disabled={busy}
          onClick={() => setAddMode("file")}
        >
          <FileUp data-icon="inline-start" />
          File
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-md"
          disabled={busy}
          onClick={() => setAddMode("paste")}
        >
          <ClipboardPaste data-icon="inline-start" />
          Paste
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-md"
          disabled={busy}
          onClick={() => setAddMode("link")}
        >
          <Link2 data-icon="inline-start" />
          Link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-md"
          disabled={busy}
          onClick={() =>
            toast.message("Notion import comes via MCP", {
              description:
                "Connect a trusted Notion MCP server in Settings. Imports land in Library notes, not as the Write/Review target.",
            })
          }
        >
          <Blocks data-icon="inline-start" />
          Notion
        </Button>
        <p className="ms-auto hidden text-xs text-muted-foreground md:block">
          Evidence for agents · stays on this machine
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(240px,0.4fr)_minmax(0,0.6fr)]">
        <section
          aria-label="Notes"
          className="min-h-56 border-b border-border md:min-h-0 md:border-e md:border-b-0"
        >
          <NotesList
            notes={notes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRetry={(id) => void handleRetry(id)}
          />
        </section>
        <section aria-label="Detail or search" className="min-h-56 md:min-h-0">
          {selected ? (
            <NoteDetail
              note={selected}
              onRetry={(id) => void handleRetry(id)}
              onClear={() => setSelectedId(null)}
            />
          ) : (
            <SearchPane
              notes={notes}
              ollamaOk={ollamaOk}
              onSearch={handleSearch}
            />
          )}
        </section>
      </div>

      <AddFilePanel
        open={addMode === "file"}
        onOpenChange={(open) => !open && setAddMode(null)}
        busy={busy}
        onAdd={async ({ path, title }) => {
          const result = await runIngest({
            id: "",
            title,
            sourceType: "file",
            sourceLabel: path,
            shaShort: shortSha(path),
            bodyKey: path,
          })
          return result === "thin" ? "error" : result
        }}
      />
      <AddPastePanel
        open={addMode === "paste"}
        onOpenChange={(open) => !open && setAddMode(null)}
        busy={busy}
        onAdd={async ({ title, body }) => {
          const result = await runIngest({
            id: "",
            title,
            sourceType: "paste",
            sourceLabel: "clipboard",
            shaShort: shortSha(body),
            bodyKey: body,
          })
          return result === "thin" ? "error" : result
        }}
      />
      <AddLinkPanel
        open={addMode === "link"}
        onOpenChange={(open) => !open && setAddMode(null)}
        busy={busy}
        onAdd={async ({ url }) =>
          runIngest({
            id: "",
            title: url.replace(/^https?:\/\//, "").slice(0, 48),
            sourceType: "link",
            sourceLabel: url,
            shaShort: shortSha(url),
            bodyKey: url,
          })
        }
      />
      <IngestProgress open={busy && progress.stage !== "idle"} state={progress} />
    </div>
  )
}
