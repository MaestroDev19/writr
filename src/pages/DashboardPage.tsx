import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sparkles,
  MessageSquareQuote,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  FileText,
  FileCode2,
  Trash2,
  ArrowUpRight,
  Plus,
  HardDrive,
  Settings,
  BookOpen,
} from "lucide-react"
import { useSettings } from "@/contexts/settings-context"
import { useCorpus } from "@/contexts/corpus-context"
import {
  UploadConfirmDialog,
  type PendingUpload,
} from "@/components/upload-confirm-dialog"
import { EmbeddingMonitor } from "@/components/embedding-monitor"

type LibraryState = "ready" | "updating" | "needs-update"

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { isLocal, activeModelDisplayName } = useSettings()
  const {
    referenceDocuments,
    totalFiles,
    totalChunks,
    addReferenceFiles,
    deleteReferenceDocument,
    reindexAll,
    isEmbedding,
  } = useCorpus()
  const navigate = useNavigate()

  const displayName =
    profile?.author_name || user?.user_metadata?.author_name || "Author"

  const [lastUpdated, setLastUpdated] = React.useState("Today")
  const [pendingUpload, setPendingUpload] = React.useState<PendingUpload | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [needsUpdate, setNeedsUpdate] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const libraryState: LibraryState = isEmbedding
    ? "updating"
    : needsUpdate
      ? "needs-update"
      : "ready"

  const updateProgress = React.useMemo(() => {
    if (!isEmbedding) return 100
    if (referenceDocuments.length === 0) return 45
    const sum = referenceDocuments.reduce((acc, doc) => {
      if (doc.embeddingStatus === "ready") return acc + 100
      if (doc.embeddingStatus === "embedding") return acc + (doc.embeddingProgress ?? 45)
      return acc
    }, 0)
    return Math.min(99, Math.max(15, Math.round(sum / referenceDocuments.length)))
  }, [isEmbedding, referenceDocuments])

  const handleRefresh = React.useCallback(() => {
    setNeedsUpdate(false)
    reindexAll()
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    setLastUpdated(`Today, ${now}`)
  }, [reindexAll])

  const handleFilesSelected = React.useCallback((selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return
    setPendingUpload({
      files: selectedFiles,
      designatedRole: "reference",
      mode: "dashboard-reference",
    })
    setIsConfirmOpen(true)
  }, [])

  const handleAddSample = React.useCallback(() => {
    const sampleNames = [
      "character_notes.md",
      "world_lore.txt",
      "research_notes.pdf",
    ]
    const nextName = sampleNames[Math.floor(Math.random() * sampleNames.length)]
    const mockFile = new File(
      ["# Notes for your story\n..."],
      nextName,
      { type: nextName.endsWith(".pdf") ? "application/pdf" : "text/plain" }
    )
    handleFilesSelected([mockFile])
  }, [handleFilesSelected])

  React.useEffect(() => {
    if (window.location.hash === "#notes" || window.location.hash === "#corpus") {
      const el = document.getElementById("notes")
      el?.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome, {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add notes here. Open a story in Write to rewrite it.
          </p>
        </div>
      </header>

      {/* Library status */}
      <section
        aria-label="Notes library status"
        aria-live="polite"
        className={`rounded-[var(--radius-xl)] border p-4 transition-colors sm:p-5 ${
          libraryState === "needs-update"
            ? "border-amber-500/40 bg-amber-500/5"
            : libraryState === "updating"
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card shadow-xs"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] ${
                libraryState === "needs-update"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : libraryState === "updating"
                    ? "bg-primary/15 text-primary"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {libraryState === "needs-update" ? (
                <AlertTriangle className="size-5" aria-hidden="true" />
              ) : libraryState === "updating" ? (
                <RefreshCw className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-5" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {libraryState === "updating"
                    ? `Preparing notes (${updateProgress}%)`
                    : libraryState === "needs-update"
                      ? "Notes need a refresh"
                      : "Notes ready"}
                </span>
                <Badge variant="outline">
                  <HardDrive data-icon="inline-start" />
                  {isLocal ? "On this device" : "Cloud"}
                </Badge>
              </div>

              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {totalFiles} {totalFiles === 1 ? "note" : "notes"}
                </span>
                {" · "}
                {totalChunks} sections ready
                {" · "}
                Updated {lastUpdated}
                {" · "}
                {activeModelDisplayName}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleRefresh}
              size="sm"
              variant={libraryState === "needs-update" ? "default" : "outline"}
              disabled={libraryState === "updating"}
            >
              <RefreshCw
                data-icon="inline-start"
                className={libraryState === "updating" ? "animate-spin" : undefined}
              />
              Refresh notes
            </Button>

            <Button variant="ghost" size="sm" render={<a href="#notes" />}>
              View notes
            </Button>

            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/settings" />}
            >
              <Settings data-icon="inline-start" />
              Settings
            </Button>
          </div>
        </div>

        {libraryState === "updating" ? (
          <div
            className="mt-4 w-full"
            role="progressbar"
            aria-valuenow={updateProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Notes update progress"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${updateProgress}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Reading your notes so Writr can use them when you write…
            </p>
          </div>
        ) : null}
      </section>

      {/* Start writing */}
      <section aria-label="Start writing" className="mt-8">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Start writing</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pick what you want to do next.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
          <article
            onClick={() => navigate("/generate")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                navigate("/generate")
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Write and improve a scene"
            className="group flex min-h-[11rem] cursor-pointer flex-col justify-between rounded-[var(--radius-xl)] border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
          >
            <div>
              <div className="flex size-11 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Write
                <ArrowUpRight
                  className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Open a chapter and ask Writr to rewrite it with help from your notes.
              </p>
            </div>
            <p className="mt-5 border-t border-border/60 pt-3 text-xs font-semibold text-primary">
              Open Write
            </p>
          </article>

          <article
            onClick={() => navigate("/critique")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                navigate("/critique")
              }
            }}
            tabIndex={0}
            role="button"
            aria-label="Get feedback on your story documents"
            className="group flex min-h-[11rem] cursor-pointer flex-col justify-between rounded-[var(--radius-xl)] border border-border bg-card p-5 transition-colors hover:border-primary/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
          >
            <div>
              <div className="flex size-11 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <MessageSquareQuote className="size-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Review
                <ArrowUpRight
                  className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden="true"
                />
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Check scenes, scripts, story bibles, character sheets, and other docs for structure, voice, and clarity.
              </p>
            </div>
            <p className="mt-5 border-t border-border/60 pt-3 text-xs font-semibold text-primary">
              Get feedback
            </p>
          </article>
        </div>
      </section>

      {/* Notes library - reference upload only */}
      <section
        id="notes"
        aria-label="Notes library"
        className="mt-10 scroll-mt-24 rounded-[var(--radius-xl)] border border-border bg-card p-4 sm:mt-12 sm:p-6"
      >
        {/* legacy hash anchor */}
        <div id="corpus" className="sr-only" aria-hidden="true" />

        <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-bold text-foreground">Notes library</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Upload character sheets, world lore, and research. Writr uses these when you write or review.
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSample}
              className="flex-1 sm:flex-none"
            >
              <Plus data-icon="inline-start" />
              Try a sample
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRefresh}
              disabled={libraryState === "updating"}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw
                data-icon="inline-start"
                className={libraryState === "updating" ? "animate-spin" : undefined}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Upload notes"
          aria-describedby="notes-upload-help"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              fileInputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFilesSelected(Array.from(e.dataTransfer.files))
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-5 flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[var(--radius)] border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[180px] sm:p-8 ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            aria-label="Choose note files"
            accept=".pdf,.docx,.txt,.md,.epub"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFilesSelected(Array.from(e.target.files))
                e.target.value = ""
              }
            }}
          />
          <div className="flex size-12 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
            <UploadCloud className="size-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              Add research notes
            </h3>
            <p id="notes-upload-help" className="max-w-sm text-xs text-muted-foreground">
              PDF, Word, text, EPUB, or Markdown. On phones, use Choose files.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            <UploadCloud data-icon="inline-start" />
            Choose files
          </Button>
        </div>

        <div className="mt-5">
          <EmbeddingMonitor files={referenceDocuments} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 pb-3">
            <h3 className="text-xs font-semibold text-muted-foreground">
              Your notes ({referenceDocuments.length})
            </h3>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {referenceDocuments.length === 0 ? (
              <div className="px-2 py-10 text-center text-xs text-muted-foreground">
                No notes yet. Drop files above or choose files to get started.
              </div>
            ) : (
              referenceDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-1 py-3 text-xs transition-colors hover:bg-muted/20"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-muted text-foreground">
                      {doc.name.endsWith(".md") || doc.name.endsWith(".txt") ? (
                        <FileCode2 className="size-4 text-primary" aria-hidden="true" />
                      ) : (
                        <FileText className="size-4 text-primary" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{doc.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                        {doc.size}
                        {" · "}
                        {doc.chunks} sections
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {doc.embeddingStatus === "embedding" ? (
                      <Badge variant="secondary">
                        <RefreshCw data-icon="inline-start" className="animate-spin" />
                        Preparing {doc.embeddingProgress}%
                      </Badge>
                    ) : doc.isStale ? (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-400">
                        Needs refresh
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <CheckCircle2 data-icon="inline-start" />
                        Ready
                      </Badge>
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => deleteReferenceDocument(doc.id)}
                      aria-label={`Remove ${doc.name}`}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <UploadConfirmDialog
        isOpen={isConfirmOpen}
        pendingUpload={pendingUpload}
        onClose={() => {
          setIsConfirmOpen(false)
          setPendingUpload(null)
        }}
        onConfirm={(files) => addReferenceFiles(files)}
      />
    </div>
  )
}
