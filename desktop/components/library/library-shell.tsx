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
import { VectorStore, type StoredDocument } from "@/lib/vector-store"
import { isTauri } from "@/lib/tauri"
import { getCurrentUserId, supabase } from "@/lib/supabase"
import type {
  IngestProgressState,
  LibraryNote,
  NoteSourceType,
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

  // Periodic health check for Ollama status
  useEffect(() => {
    void pingOllama().then(setOllamaOk)
    const id = window.setInterval(() => {
      void pingOllama().then(setOllamaOk)
    }, 15_000)
    return () => window.clearInterval(id)
  }, [])

  // Hydrate notes list from SQLite database for the active authenticated user
  useEffect(() => {
    let active = true

    async function loadDocuments() {
      if (!isTauri()) return
      const currentUserId = getCurrentUserId()
      if (!currentUserId) {
        if (active) setNotes([])
        return
      }

      try {
        const store = new VectorStore()
        const docs = await store.listDocuments()
        if (!active) return

        const loadedNotes: LibraryNote[] = docs.map((doc) => {
          let sourceType: NoteSourceType = "file"
          let sourceLabel = doc.name
          if (doc.name.startsWith("http://") || doc.name.startsWith("https://")) {
            sourceType = "link"
          } else if (
            doc.name.startsWith("Note ") ||
            doc.name === "Pasted note" ||
            doc.name === "clipboard"
          ) {
            sourceType = "paste"
            sourceLabel = "clipboard"
          }

          return {
            id: doc.id,
            title: doc.name,
            sourceType,
            sourceLabel,
            status: "ready" as const,
            shaShort: shortSha(doc.id),
            createdAt: doc.createdAt ?? new Date().toISOString(),
          }
        })

        setNotes(loadedNotes)
      } catch (err) {
        console.error("Failed to load reference documents:", err)
      }
    }

    void loadDocuments()

    // Listen for auth transitions (e.g. login/logout or account switch on shared PC)
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void loadDocuments()
    })

    return () => {
      active = false
      authListener.subscription.unsubscribe()
    }
  }, [])

  const selected = notes.find((n) => n.id === selectedId) ?? null

  const runIngest = useCallback(
    async (
      draft: Omit<LibraryNote, "status" | "createdAt"> & {
        bodyKey: string
        file?: File
      }
    ) => {
      const existing = notes.find(
        (n) =>
          (n.shaShort === draft.shaShort || n.title === draft.title) &&
          n.status === "ready"
      )
      if (existing) return "duplicate" as const

      setBusy(true)
      const tempId = crypto.randomUUID()
      const ingesting: LibraryNote = {
        id: tempId,
        title: draft.title,
        sourceType: draft.sourceType,
        sourceLabel: draft.sourceLabel,
        shaShort: draft.shaShort,
        status: "ingesting",
        createdAt: new Date().toISOString(),
      }
      setNotes((prev) => [ingesting, ...prev])
      setSelectedId(tempId)

      try {
        const store = new VectorStore()
        let storedDoc: StoredDocument

        if (draft.sourceType === "paste") {
          storedDoc = await store.addTexts(
            draft.bodyKey,
            draft.title,
            undefined,
            setProgress
          )
        } else if (draft.sourceType === "link") {
          storedDoc = await store.addDocuments(
            draft.bodyKey,
            draft.title,
            undefined,
            setProgress
          )
        } else {
          // File ingestion (pass File object if in browser, or path string if desktop Tauri)
          storedDoc = await store.addDocuments(
            draft.file ?? draft.bodyKey,
            draft.title,
            undefined,
            setProgress
          )
        }

        setNotes((prev) =>
          prev.map((n) =>
            n.id === tempId
              ? {
                  ...n,
                  id: storedDoc.id,
                  title: storedDoc.name,
                  status: "ready" as const,
                  shaShort: shortSha(storedDoc.id),
                }
              : n
          )
        )
        setSelectedId(storedDoc.id)
        toast.success(`Indexed "${storedDoc.name}" into library.`)
        return "ok" as const
      } catch (err: unknown) {
        console.error("Ingest failed:", err)
        const errMsg = err instanceof Error ? err.message : String(err)
        const isThin =
          errMsg.toLowerCase().includes("thin") ||
          errMsg.toLowerCase().includes("insufficient text")

        setNotes((prev) =>
          prev.map((n) =>
            n.id === tempId
              ? {
                  ...n,
                  status: "failed" as const,
                  errorMessage: isThin
                    ? "Page extract was too thin to index."
                    : errMsg || "Ingest failed. Retry when Ollama is up.",
                }
              : n
          )
        )
        return isThin ? ("thin" as const) : ("error" as const)
      } finally {
        setBusy(false)
        setProgress(IDLE_PROGRESS)
        setAddMode(null)
      }
    },
    [notes]
  )

  const handleRetry = useCallback(
    async (id: string) => {
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
      try {
        const store = new VectorStore()
        let storedDoc: StoredDocument
        if (note.sourceType === "link" || note.sourceType === "file") {
          storedDoc = await store.addDocuments(
            note.sourceLabel,
            note.title,
            undefined,
            setProgress
          )
        } else {
          storedDoc = await store.addTexts(
            note.title,
            note.title,
            undefined,
            setProgress
          )
        }
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  id: storedDoc.id,
                  title: storedDoc.name,
                  status: "ready" as const,
                  shaShort: shortSha(storedDoc.id),
                }
              : n
          )
        )
        setSelectedId(storedDoc.id)
        toast.success(`Indexed "${storedDoc.name}" into library.`)
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        setNotes((prev) =>
          prev.map((n) =>
            n.id === id
              ? {
                  ...n,
                  status: "failed" as const,
                  errorMessage: errMsg || "Ingest failed. Retry when Ollama is up.",
                }
              : n
          )
        )
      } finally {
        setBusy(false)
        setProgress(IDLE_PROGRESS)
      }
    },
    [notes]
  )

  const handleDelete = useCallback(async (id: string) => {
    try {
      const store = new VectorStore()
      await store.deleteDocument(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      setSelectedId((prev) => (prev === id ? null : prev))
      toast.success("Document removed from library.")
    } catch (err) {
      console.error("Failed to delete document:", err)
      toast.error("Could not delete document.")
    }
  }, [])

  const handleSearch = useCallback(async (query: string): Promise<SearchHit[]> => {
    const store = new VectorStore()
    return await store.searchHits(query, 12)
  }, [])

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
              onDelete={(id) => void handleDelete(id)}
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
        onAdd={async ({ path, title, file }) => {
          const result = await runIngest({
            id: "",
            title,
            sourceType: "file",
            sourceLabel: path,
            shaShort: shortSha(path),
            bodyKey: path,
            file,
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
