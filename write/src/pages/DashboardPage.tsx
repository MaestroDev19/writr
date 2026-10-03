import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/contexts/auth-context"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MAX_DOCUMENTS_PER_UPLOAD,
  activeUploadQuery,
  libraryQuery,
  uploadDocumentMutation,
  uploadDocumentsMutation,
  uploadLinkMutation,
  uploadStatusQuery,
  uploadTextMutation,
} from "@/api"
import { getApiErrorMessage, isAxiosError } from "@/lib/axios"
import {
  Sparkles,
  MessageSquareQuote,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  FileText,
  FileCode2,
  AlignLeft,
  Link2,
  Trash2,
  ArrowUpRight,
  Plus,
  Cloud,
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
type BannerTone = LibraryState | "error"
type NoteInput = "files" | "text" | "link"

/** Queue status from the upload job, shown on the notes library card. */
function jobStatusBanner(
  status: string | undefined
): { tone: BannerTone; label: string } | null {
  if (status === "queued") return { tone: "updating", label: "queued / waiting" }
  if (status === "running") return { tone: "updating", label: "embedding / preparing" }
  if (status === "succeeded") return { tone: "ready", label: "ready" }
  if (status === "failed" || status === "dead") return { tone: "error", label: "error" }
  return null
}

const NOTE_INPUTS: { id: NoteInput; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "text", label: "Text" },
  { id: "link", label: "Link" },
]

function noteTitle(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map((part) => part.trim())
    .find(Boolean)
  const clean = (line ?? "Pasted note").replace(/^#+\s*/, "")
  return clean.length > 72 ? `${clean.slice(0, 69)}…` : clean
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (!url.hostname) return null
    return url.toString()
  } catch {
    return null
  }
}

function adoptBusyJob(error: unknown, setJobId: (id: string) => void): boolean {
  if (!isAxiosError(error) || error.response?.status !== 409) return false
  const data = error.response.data as { job_id?: string } | undefined
  if (!data?.job_id) return false
  setJobId(data.job_id)
  return true
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { activeModelDisplayName } = useSettings()
  const queryClient = useQueryClient()
  const {
    referenceDocuments,
    totalFiles,
    totalChunks,
    libraryLimit,
    remainingSlots,
    deleteReferenceDocument,
    refreshLibrary,
    isEmbedding,
    isLoading,
    isDeleting,
    activeJobId,
    activeJobStatus,
  } = useCorpus()
  const navigate = useNavigate()

  const displayName =
    profile?.author_name || user?.user_metadata?.author_name || "Author"

  const [lastUpdated, setLastUpdated] = React.useState("Today")
  const [pendingUpload, setPendingUpload] = React.useState<PendingUpload | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [noteInput, setNoteInput] = React.useState<NoteInput>("files")
  const [noteText, setNoteText] = React.useState("")
  const [noteLink, setNoteLink] = React.useState("")
  const [textError, setTextError] = React.useState<string | null>(null)
  const [linkError, setLinkError] = React.useState<string | null>(null)
  const [filesError, setFilesError] = React.useState<string | null>(null)
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [jobId, setJobId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (activeJobId) setJobId(activeJobId)
  }, [activeJobId])

  const onUploadQueued = React.useCallback(
    async (data: { job_id: string }) => {
      setJobId(data.job_id)
      await queryClient.invalidateQueries({ queryKey: activeUploadQuery.queryKey })
    },
    [queryClient]
  )

  const textUpload = useMutation({
    ...uploadTextMutation,
    onSuccess: onUploadQueued,
  })
  const linkUpload = useMutation({
    ...uploadLinkMutation,
    onSuccess: onUploadQueued,
  })
  const documentUpload = useMutation({
    ...uploadDocumentMutation,
    onSuccess: onUploadQueued,
  })
  const documentsUpload = useMutation({
    ...uploadDocumentsMutation,
    onSuccess: onUploadQueued,
  })

  const { data: job, isError: jobStatusError } = useQuery({
    ...uploadStatusQuery(jobId ?? ""),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (!status) return 2000
      if (status === "queued" || status === "running") return 2000
      return false
    },
  })

  const jobStatus = job?.status ?? activeJobStatus ?? undefined
  const jobInFlight =
    !jobStatusError &&
    (jobStatus === "queued" ||
      jobStatus === "running" ||
      textUpload.isPending ||
      linkUpload.isPending ||
      documentUpload.isPending ||
      documentsUpload.isPending)

  const formLocked = jobInFlight

  React.useEffect(() => {
    if (!jobId) return

    if (jobStatusError) {
      void queryClient.invalidateQueries({ queryKey: activeUploadQuery.queryKey })
      setJobId(null)
      return
    }

    if (!job?.status) return
    if (job.status === "queued" || job.status === "running") return

    void queryClient.invalidateQueries({ queryKey: libraryQuery.queryKey })
    void queryClient.invalidateQueries({ queryKey: activeUploadQuery.queryKey })

    if (job.status === "succeeded") {
      setSaveMessage("Notes ready.")
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      setLastUpdated(`Today, ${now}`)
    } else if (job.status === "dead" || job.status === "failed") {
      setSaveMessage("This note could not be prepared.")
    }

    // Unlock once the job is terminal or gone.
    setJobId(null)
  }, [job?.status, jobId, jobStatusError, queryClient])

  const libraryState: LibraryState = isEmbedding || jobInFlight ? "updating" : "ready"
  const jobBanner =
    jobStatusError && jobId
      ? { tone: "error" as const, label: "error" }
      : jobId || jobInFlight
        ? (jobStatusBanner(jobStatus) ?? {
            tone: "updating" as const,
            label: "queued / waiting",
          })
        : null
  const bannerTone: BannerTone =
    jobBanner?.tone ??
    (libraryState === "updating" ? "updating" : "ready")

  const updateProgress = React.useMemo(() => {
    if (!jobInFlight && !isEmbedding) return 100
    if (referenceDocuments.length === 0) return 45
    const sum = referenceDocuments.reduce((acc, doc) => {
      if (doc.embeddingStatus === "ready") return acc + 100
      if (doc.embeddingStatus === "embedding") return acc + (doc.embeddingProgress ?? 45)
      return acc
    }, 0)
    return Math.min(99, Math.max(15, Math.round(sum / referenceDocuments.length)))
  }, [isEmbedding, jobInFlight, referenceDocuments])

  const bannerLabel =
    jobBanner?.label ??
    (libraryState === "updating"
      ? `Preparing notes (${updateProgress}%)`
      : "Notes ready")

  const handleRefresh = React.useCallback(async () => {
    await refreshLibrary()
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    setLastUpdated(`Today, ${now}`)
  }, [refreshLibrary])

  const handleFilesSelected = React.useCallback(
    (selectedFiles: File[]) => {
      if (selectedFiles.length === 0 || formLocked) return
      setFilesError(null)
      setSaveMessage(null)

      if (remainingSlots <= 0) {
        setFilesError(
          `Notes library is full (${libraryLimit}/${libraryLimit}). Remove a note to add another.`
        )
        return
      }

      let files = selectedFiles
      if (files.length > MAX_DOCUMENTS_PER_UPLOAD) {
        files = files.slice(0, MAX_DOCUMENTS_PER_UPLOAD)
        setFilesError(
          `Only ${MAX_DOCUMENTS_PER_UPLOAD} files can be uploaded at a time. Extra files were left out.`
        )
      }
      if (files.length > remainingSlots) {
        files = files.slice(0, remainingSlots)
        setFilesError(
          `You can add ${remainingSlots} more note${remainingSlots === 1 ? "" : "s"} (${totalFiles}/${libraryLimit}). Extra files were left out.`
        )
      }

      setPendingUpload({
        files,
        designatedRole: "reference",
        mode: "dashboard-reference",
      })
      setIsConfirmOpen(true)
    },
    [formLocked, libraryLimit, remainingSlots, totalFiles]
  )

  const handleConfirmFiles = React.useCallback(
    async (files: File[]) => {
      if (files.length === 0 || formLocked) return
      setFilesError(null)
      setSaveMessage(null)
      try {
        if (files.length === 1) {
          await documentUpload.mutateAsync(files[0])
        } else {
          await documentsUpload.mutateAsync(files)
        }
        setSaveMessage(
          files.length === 1
            ? "File queued. Writr is preparing it."
            : `${files.length} files queued. Writr is preparing them.`
        )
      } catch (error) {
        if (adoptBusyJob(error, setJobId)) {
          setFilesError("A note is already being prepared. Wait for it to finish.")
          return
        }
        setFilesError(getApiErrorMessage(error, "Could not upload these files."))
      }
    },
    [documentUpload, documentsUpload, formLocked]
  )

  const handleAddText = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (formLocked) return
      const text = noteText.trim()
      if (!text) {
        setTextError("Paste some text first.")
        return
      }
      if (remainingSlots <= 0) {
        setTextError(
          `Notes library is full (${libraryLimit}/${libraryLimit}). Remove a note to add another.`
        )
        return
      }
      setTextError(null)
      setSaveMessage(null)
      try {
        await textUpload.mutateAsync(text)
        setNoteText("")
        setSaveMessage(`“${noteTitle(text)}” queued. Writr is preparing it.`)
      } catch (error) {
        if (adoptBusyJob(error, setJobId)) {
          setTextError("A note is already being prepared. Wait for it to finish.")
          return
        }
        setTextError(getApiErrorMessage(error, "Could not add this note."))
      }
    },
    [formLocked, libraryLimit, noteText, remainingSlots, textUpload]
  )

  const handleAddLink = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (formLocked) return
      const url = parseHttpUrl(noteLink)
      if (!url) {
        setLinkError("Enter a full link that starts with http:// or https://.")
        return
      }
      if (remainingSlots <= 0) {
        setLinkError(
          `Notes library is full (${libraryLimit}/${libraryLimit}). Remove a note to add another.`
        )
        return
      }
      setLinkError(null)
      setSaveMessage(null)
      try {
        await linkUpload.mutateAsync(url)
        setNoteLink("")
        setSaveMessage("Link queued. Writr is preparing it.")
      } catch (error) {
        if (adoptBusyJob(error, setJobId)) {
          setLinkError("A note is already being prepared. Wait for it to finish.")
          return
        }
        setLinkError(getApiErrorMessage(error, "Could not add this link."))
      }
    },
    [formLocked, libraryLimit, linkUpload, noteLink, remainingSlots]
  )

  const handleAddSample = React.useCallback(() => {
    if (formLocked || remainingSlots <= 0) return
    const sampleNames = [
      "character_notes.md",
      "world_lore.txt",
      "research_notes.md",
    ]
    const nextName = sampleNames[Math.floor(Math.random() * sampleNames.length)]
    const mockFile = new File(
      ["# Notes for your story\nUse this sample while you try Writr.\n"],
      nextName,
      { type: "text/plain" }
    )
    handleFilesSelected([mockFile])
  }, [formLocked, handleFilesSelected, remainingSlots])

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
          bannerTone === "needs-update"
            ? "border-amber-500/40 bg-amber-500/5"
            : bannerTone === "error"
              ? "border-destructive/40 bg-destructive/5"
              : bannerTone === "updating"
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-card shadow-xs"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] ${
                bannerTone === "needs-update"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : bannerTone === "error"
                    ? "bg-destructive/15 text-destructive"
                    : bannerTone === "updating"
                      ? "bg-primary/15 text-primary"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {bannerTone === "needs-update" || bannerTone === "error" ? (
                <AlertTriangle className="size-5" aria-hidden="true" />
              ) : bannerTone === "updating" ? (
                <RefreshCw className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-5" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-foreground">
                  {bannerLabel}
                </span>
                <Badge variant="outline">
                  <Cloud data-icon="inline-start" />
                  Cloud
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
              onClick={() => void handleRefresh()}
              size="sm"
              variant={bannerTone === "needs-update" ? "default" : "outline"}
              disabled={formLocked}
            >
              <RefreshCw
                data-icon="inline-start"
                className={formLocked ? "animate-spin" : undefined}
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

        {bannerTone === "updating" ? (
          <div
            className="mt-4 w-full"
            role="progressbar"
            aria-valuenow={jobInFlight ? undefined : updateProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Notes update progress"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
              {jobInFlight ? (
                <div className="h-full w-1/3 animate-pulse bg-primary" />
              ) : (
                <div
                  className="h-full bg-primary transition-[width] duration-300"
                  style={{ width: `${updateProgress}%` }}
                />
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {bannerLabel === "queued / waiting"
                ? "Waiting to start reading your notes…"
                : "Reading your notes so Writr can use them when you write…"}
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
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Add files, paste text, or save a link. Up to {libraryLimit} notes ·{" "}
              {MAX_DOCUMENTS_PER_UPLOAD} files at a time.
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSample}
              disabled={formLocked || remainingSlots <= 0}
              className="flex-1 sm:flex-none"
            >
              <Plus data-icon="inline-start" />
              Try a sample
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={formLocked}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw
                data-icon="inline-start"
                className={formLocked ? "animate-spin" : undefined}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="How to add a note"
          className="mt-5 grid grid-cols-3 gap-1 rounded-[var(--radius)] bg-muted p-1"
          onKeyDown={(event) => {
            const current = NOTE_INPUTS.findIndex((item) => item.id === noteInput)
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
            event.preventDefault()
            const direction = event.key === "ArrowRight" ? 1 : -1
            const next = NOTE_INPUTS[(current + direction + NOTE_INPUTS.length) % NOTE_INPUTS.length]
            setNoteInput(next.id)
            document.getElementById(`notes-tab-${next.id}`)?.focus()
          }}
        >
          {NOTE_INPUTS.map((item) => {
            const selected = noteInput === item.id
            const Icon = item.id === "files" ? FileText : item.id === "text" ? AlignLeft : Link2
            return (
              <button
                key={item.id}
                id={`notes-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`notes-panel-${item.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  if (!formLocked) setNoteInput(item.id)
                }}
                disabled={formLocked}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-[calc(var(--radius)-2px)] text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? "cursor-pointer bg-background text-foreground shadow-xs"
                    : "cursor-pointer text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>

        <div
          id="notes-panel-files"
          role="tabpanel"
          aria-labelledby="notes-tab-files"
          hidden={noteInput !== "files"}
          className="mt-4"
        >
          <label
            onDragOver={(e) => {
              e.preventDefault()
              if (!formLocked && remainingSlots > 0) setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              if (formLocked || remainingSlots <= 0) return
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleFilesSelected(Array.from(e.dataTransfer.files))
              }
            }}
            aria-disabled={formLocked || remainingSlots <= 0}
            className={`flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[var(--radius)] border-2 border-dashed p-6 text-center transition-colors focus-within:ring-2 focus-within:ring-ring sm:min-h-[180px] sm:p-8 ${
              formLocked || remainingSlots <= 0
                ? "cursor-not-allowed border-border opacity-60"
                : isDragging
                  ? "cursor-pointer border-primary bg-primary/5"
                  : "cursor-pointer border-border hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              multiple
              disabled={formLocked || remainingSlots <= 0}
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
              <h3 className="text-sm font-semibold text-foreground">Add research notes</h3>
              <p id="notes-upload-help" className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                PDF, Word, text, EPUB, or Markdown. Up to {MAX_DOCUMENTS_PER_UPLOAD} files now
                · {remainingSlots} slot{remainingSlots === 1 ? "" : "s"} left.
              </p>
            </div>
            <span
              className={cn(
                buttonVariants(),
                (formLocked || remainingSlots <= 0) && "pointer-events-none opacity-60"
              )}
            >
              <UploadCloud data-icon="inline-start" />
              {formLocked ? "Preparing…" : remainingSlots <= 0 ? "Library full" : "Choose files"}
            </span>
          </label>
          {filesError ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {filesError}
            </p>
          ) : null}
        </div>

        <div
          id="notes-panel-text"
          role="tabpanel"
          aria-labelledby="notes-tab-text"
          hidden={noteInput !== "text"}
          className="mt-4"
        >
          <form onSubmit={handleAddText} className="flex flex-col gap-3" aria-disabled={formLocked}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note-text">Note</Label>
              <textarea
                id="note-text"
                value={noteText}
                rows={6}
                placeholder="Paste lore, research, or a scene…"
                autoComplete="off"
                disabled={formLocked || remainingSlots <= 0}
                aria-invalid={textError ? true : undefined}
                aria-describedby={textError ? "note-text-help note-text-error" : "note-text-help"}
                onChange={(event) => {
                  setNoteText(event.target.value)
                  if (textError) setTextError(null)
                  if (saveMessage) setSaveMessage(null)
                }}
                className="min-h-36 w-full resize-y rounded-[var(--radius)] border border-input bg-transparent px-3 py-2 text-base leading-relaxed outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm"
              />
              <p id="note-text-help" className="text-xs leading-relaxed text-muted-foreground">
                {formLocked
                  ? "Wait until the current note finishes preparing."
                  : "Writr saves this with your notes and reads it when you write or review."}
              </p>
              {textError ? (
                <p id="note-text-error" role="alert" className="text-xs text-destructive">
                  {textError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  formLocked || remainingSlots <= 0 || textUpload.isPending || noteText.trim().length === 0
                }
              >
                {textUpload.isPending || formLocked ? "Adding…" : "Add note"}
              </Button>
            </div>
          </form>
        </div>

        <div
          id="notes-panel-link"
          role="tabpanel"
          aria-labelledby="notes-tab-link"
          hidden={noteInput !== "link"}
          className="mt-4"
        >
          <form onSubmit={handleAddLink} className="flex flex-col gap-3" aria-disabled={formLocked}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note-link">Link</Label>
              <Input
                id="note-link"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com/article"
                value={noteLink}
                disabled={formLocked || remainingSlots <= 0}
                aria-invalid={linkError ? true : undefined}
                aria-describedby={linkError ? "note-link-help note-link-error" : "note-link-help"}
                onChange={(event) => {
                  setNoteLink(event.target.value)
                  if (linkError) setLinkError(null)
                  if (saveMessage) setSaveMessage(null)
                }}
              />
              <p id="note-link-help" className="text-xs leading-relaxed text-muted-foreground">
                {formLocked
                  ? "Wait until the current note finishes preparing."
                  : "A public page. Writr fetches it and saves it with your notes."}
              </p>
              {linkError ? (
                <p id="note-link-error" role="alert" className="text-xs text-destructive">
                  {linkError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={
                  formLocked || remainingSlots <= 0 || linkUpload.isPending || noteLink.trim().length === 0
                }
              >
                <Link2 data-icon="inline-start" />
                {linkUpload.isPending || formLocked ? "Adding…" : "Add link"}
              </Button>
            </div>
          </form>
        </div>

        <p
          className={saveMessage ? "mt-3 text-xs text-muted-foreground" : "sr-only"}
          aria-live="polite"
        >
          {saveMessage}
        </p>

        <div className="mt-5">
          <EmbeddingMonitor files={referenceDocuments} jobBanner={jobBanner} />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between gap-2 pb-3">
            <h3 className="text-xs font-semibold text-muted-foreground">
              Your notes ({totalFiles}/{libraryLimit})
            </h3>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {isLoading ? (
              <div className="px-2 py-10 text-center text-xs leading-relaxed text-muted-foreground">
                Loading your notes…
              </div>
            ) : referenceDocuments.length === 0 ? (
              <div className="px-2 py-10 text-center text-xs leading-relaxed text-muted-foreground">
                {formLocked
                  ? "Preparing your first note…"
                  : "No notes yet. Add a file, paste text, or save a link."}
              </div>
            ) : (
              referenceDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3 px-1 py-3 text-xs transition-colors hover:bg-muted/20"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-muted text-foreground">
                      {doc.source === "link" ? (
                        <Link2 className="size-4 text-primary" aria-hidden="true" />
                      ) : doc.source === "text" ? (
                        <AlignLeft className="size-4 text-primary" aria-hidden="true" />
                      ) : doc.name.endsWith(".md") || doc.name.endsWith(".txt") ? (
                        <FileCode2 className="size-4 text-primary" aria-hidden="true" />
                      ) : (
                        <FileText className="size-4 text-primary" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground" title={doc.name}>
                        {doc.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                        {doc.chunks > 0 ? `${doc.chunks} sections` : doc.size}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {doc.embeddingStatus === "queued" || doc.embeddingStatus === "embedding" ? (
                      jobBanner?.tone === "error" ? (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          <AlertTriangle data-icon="inline-start" />
                          error
                        </Badge>
                      ) : jobBanner?.tone === "ready" ? (
                        <Badge variant="secondary">
                          <CheckCircle2 data-icon="inline-start" />
                          ready
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <RefreshCw data-icon="inline-start" className="animate-spin" />
                          {jobBanner?.label ??
                            (doc.embeddingStatus === "embedding"
                              ? `Preparing ${doc.embeddingProgress}%`
                              : "Preparing")}
                        </Badge>
                      )
                    ) : doc.embeddingStatus === "error" ? (
                      <Badge variant="outline" className="border-destructive/40 text-destructive">
                        <AlertTriangle data-icon="inline-start" />
                        error
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
                      disabled={formLocked || isDeleting}
                      onClick={() => void deleteReferenceDocument(doc.id)}
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
        onConfirm={(files) => {
          void handleConfirmFiles(files)
        }}
      />
    </div>
  )
}
