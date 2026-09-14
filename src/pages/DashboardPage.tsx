import * as React from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  Database,
  Sparkles,
  MessageSquareQuote,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UploadCloud,
  FileText,
  FileCode2,
  Trash2,
  Cpu,
  Cloud,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  HardDrive,
  Settings,
} from "lucide-react"
import { useSettings } from "@/contexts/settings-context"

type CorpusState = "up-to-date" | "stale" | "indexing"

interface CorpusDocument {
  id: string
  name: string
  size: string
  chunks: number
  updatedAt: string
  isStale?: boolean
}

const INITIAL_DOCUMENTS: CorpusDocument[] = [
  {
    id: "doc-1",
    name: "woolf_modern_fiction_1919.md",
    size: "14.2 KB",
    chunks: 42,
    updatedAt: "Today, 4:12 PM",
  },
  {
    id: "doc-2",
    name: "narrative_cadence_rubric.pdf",
    size: "1.8 MB",
    chunks: 310,
    updatedAt: "Today, 4:12 PM",
  },
  {
    id: "doc-3",
    name: "prose_style_corpus_ch1_ch5.docx",
    size: "820 KB",
    chunks: 195,
    updatedAt: "Today, 4:12 PM",
  },
  {
    id: "doc-4",
    name: "character_lexicon_and_motifs.txt",
    size: "45.6 KB",
    chunks: 78,
    updatedAt: "Today, 4:12 PM",
  },
]

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const { settings, updateSettings, toggleStorageMode, isLocal, activeModelDisplayName } = useSettings()
  const navigate = useNavigate()

  const displayName = profile?.author_name || user?.user_metadata?.author_name || "Author"

  // 1. Corpus Health state (§9.3 real states)
  const [corpusStatus, setCorpusStatus] = React.useState<CorpusState>("up-to-date")
  const [documents, setDocuments] = React.useState<CorpusDocument[]>(INITIAL_DOCUMENTS)
  const [indexingProgress, setIndexingProgress] = React.useState(0)
  const [lastIngestedTime, setLastIngestedTime] = React.useState("Today, 4:12 PM")

  // 2. Active Model (§9.2) & Rate-limit status (§7B.3)
  const requestCount = 142
  const maxRequests = 14400

  // File drag & drop state
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Derived state without effects (vercel-react-best-practices: rerender-derived-state-no-effect)
  const totalFiles = documents.length
  const totalChunks = documents.reduce((acc, doc) => acc + doc.chunks, 0)
  const rateLimitPercentage = Math.min(100, Math.max(4, (requestCount / maxRequests) * 100))

  // Re-index simulation with timer cleanup
  const handleReindex = React.useCallback(() => {
    setCorpusStatus("indexing")
    setIndexingProgress(15)

    const timer1 = setTimeout(() => setIndexingProgress(48), 400)
    const timer2 = setTimeout(() => setIndexingProgress(85), 900)
    const timer3 = setTimeout(() => {
      setIndexingProgress(100)
      setCorpusStatus("up-to-date")
      setDocuments((prev) => prev.map((d) => ({ ...d, isStale: false })))
      const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      setLastIngestedTime(`Today, ${now}`)
    }, 1400)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [])

  // Handle uploading / adding sample document
  const handleAddSampleDoc = React.useCallback(() => {
    const sampleNames = [
      "thematic_motifs_supplement.md",
      "pacing_dialogue_notes_v2.txt",
      "historical_milieu_notes.pdf",
    ]
    const nextName = sampleNames[Math.floor(Math.random() * sampleNames.length)]
    const newDoc: CorpusDocument = {
      id: `doc-${Date.now()}`,
      name: nextName,
      size: "62.4 KB",
      chunks: 85,
      updatedAt: "Just now",
      isStale: true,
    }

    setDocuments((prev) => [newDoc, ...prev])
    setCorpusStatus("stale")
  }, [])

  const handleDeleteDoc = React.useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    setCorpusStatus("stale")
  }, [])

  const scrollToCorpus = React.useCallback(() => {
    const el = document.getElementById("corpus")
    if (el) {
      el.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
      {/* Writer Orientation Header */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Writer Orientation
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Welcome, {displayName}
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Single corpus • Two modes • Instant retrieval
        </p>
      </header>

      {/* 1. TOP OF SCREEN: CORPUS HEALTH (§9.3) */}
      <section
        aria-label="Corpus Health Overview"
        aria-live="polite"
        className={`rounded-2xl border p-5 sm:p-6 transition-all duration-200 ${
          corpusStatus === "stale"
            ? "border-amber-500/40 bg-amber-500/5 dark:border-amber-400/30 dark:bg-amber-950/20"
            : corpusStatus === "indexing"
              ? "border-primary/40 bg-primary/5"
              : "border-border bg-card"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div
              className={`mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                corpusStatus === "stale"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : corpusStatus === "indexing"
                    ? "bg-primary/15 text-primary"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {corpusStatus === "stale" ? (
                <AlertTriangle className="size-5" />
              ) : corpusStatus === "indexing" ? (
                <span className="inline-flex animate-spin">
                  <RefreshCw className="size-5" />
                </span>
              ) : (
                <Database className="size-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Corpus Health
                </span>

                {/* Status Badge with ternary rendering (rendering-conditional-render) */}
                {corpusStatus === "up-to-date" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    Up to date
                  </span>
                ) : null}

                {corpusStatus === "stale" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="size-3.5" />
                    Stale — Re-index recommended
                  </span>
                ) : null}

                {corpusStatus === "indexing" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                    <span className="inline-flex animate-spin mr-1">
                      <RefreshCw className="size-3" />
                    </span>
                    Re-indexing chunks ({indexingProgress}%)
                  </span>
                ) : null}

                {/* Storage Engine Pill */}
                <button
                  type="button"
                  onClick={toggleStorageMode}
                  title="Click to toggle storage engine (Local DB vs. Cloud Sync)"
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  <HardDrive className="size-3 text-primary" />
                  <span>{isLocal ? "Local DB (Private)" : "Cloud Sync (Supabase)"}</span>
                </button>
              </div>

              <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-foreground">
                  {totalFiles} {totalFiles === 1 ? "document" : "documents"}
                </span>
                <span className="text-muted-foreground text-xs" aria-hidden="true">•</span>
                <span className="text-muted-foreground">
                  {totalChunks} vectorized chunks
                </span>
                <span className="text-muted-foreground text-xs" aria-hidden="true">•</span>
                <span className="text-xs text-muted-foreground">
                  Last ingested: <span className="font-medium text-foreground">{lastIngestedTime}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions for Corpus */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            {corpusStatus === "stale" ? (
              <Button
                onClick={handleReindex}
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-xs"
              >
                <RefreshCw className="size-3.5" />
                Re-index Now
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReindex}
                disabled={corpusStatus === "indexing"}
                className="text-xs"
              >
                {corpusStatus === "indexing" ? (
                  <span className="inline-flex animate-spin">
                    <RefreshCw className="size-3.5" />
                  </span>
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                Sync Corpus
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={scrollToCorpus}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Manage Sources
            </Button>
          </div>
        </div>

        {/* Indexing Progress Bar */}
        {corpusStatus === "indexing" ? (
          <div className="mt-4 w-full" role="progressbar" aria-valuenow={indexingProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Corpus indexing progress">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${indexingProgress}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Embedding documents with 512-token chunks and cosine similarity vectors...
            </p>
          </div>
        ) : null}
      </section>

      {/* 2. ACTIVE MODEL & RATE LIMIT (§9.2 & §7B.3) */}
      <section
        aria-label="Active Model and Inference Status"
        className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3.5 sm:flex-row sm:items-center sm:justify-between text-xs"
      >
        {/* Active Model Indicator */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {settings.modelProvider === "ollama" ? <Cpu className="size-3.5" /> : <Cloud className="size-3.5" />}
          </div>
          <div>
            <span className="text-muted-foreground">Active Model: </span>
            <span className="font-semibold text-foreground">
              {activeModelDisplayName}
            </span>
            <span className="ml-2 rounded border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {settings.modelProvider === "ollama" ? "Local Machine" : "Cloud Inference"}
            </span>
          </div>
        </div>

        {/* Quiet Rate-Limit Readout or Local Status */}
        <div className="flex items-center justify-between sm:justify-end gap-3">
          {settings.modelProvider === "ollama" ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Unlimited local inference • Zero network latency</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rate limit:</span>
              <span className="font-medium text-foreground">
                {requestCount.toLocaleString()} of ~{maxRequests.toLocaleString()} requests today
              </span>
              <div
                className="h-2 w-12 rounded-full bg-muted overflow-hidden"
                title={`${((requestCount / maxRequests) * 100).toFixed(1)}% consumed`}
              >
                <div
                  className="h-full bg-primary"
                  style={{ width: `${rateLimitPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Quick Provider Switcher */}
          <button
            type="button"
            onClick={() => updateSettings({ modelProvider: settings.modelProvider === "ollama" ? "gemini" : "ollama" })}
            className="rounded border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            title="Switch model provider"
            aria-label={`Switch to ${settings.modelProvider === "ollama" ? "Gemini Online" : "Local Ollama"} provider`}
          >
            Switch to {settings.modelProvider === "ollama" ? "Gemini" : "Local"}
          </button>

          {/* Direct link to App Settings */}
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            title="Configure App Settings"
          >
            <Settings className="size-3 text-muted-foreground" />
            <span>Settings</span>
          </button>
        </div>
      </section>

      {/* 3. TWO CLEAR ENTRY POINTS (§6) */}
      <section aria-label="Creative Workspaces" className="mt-8">
        <div className="mb-3">
          <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Start A Session
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose your retrieval strategy based on creative intent.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Card 1: "New idea" -> Generate */}
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
            aria-label="New idea workspace - Open Narrative Studio"
            className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition hover:border-primary/60 hover:shadow-md cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Sparkles className="size-5.5" />
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Broad Recall
                </span>
              </div>

              <div className="mt-5">
                <h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  New idea
                  <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Draft unconstrained narrative scenes, explore creative prose variations, and brainstorm concepts. Retrieves thematic resonances across your entire corpus.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Open Narrative Studio
              </span>
              <span className="text-[11px] text-muted-foreground" aria-hidden="true">
                → Generate
              </span>
            </div>
          </article>

          {/* Card 2: "Check my structure" -> Critique */}
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
            aria-label="Check my structure workspace - Run Manuscript Critique"
            className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-xs transition hover:border-primary/60 hover:shadow-md cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
                  <MessageSquareQuote className="size-5.5" />
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  Targeted Rubric
                </span>
              </div>

              <div className="mt-5">
                <h3 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Check my structure
                  <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Inspect prose cadence, identify pacing dips, verify tone consistency, and audit chapter transitions directly against indexed reference standards.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-xs font-semibold text-primary">
                Run Manuscript Critique
              </span>
              <span className="text-[11px] text-muted-foreground" aria-hidden="true">
                → Critique
              </span>
            </div>
          </article>
        </div>
      </section>

      {/* 4. MERGED INGESTION CONSOLE (Directly in Dashboard) */}
      <section
        id="corpus"
        aria-label="Knowledge Ingestion and Corpus Management"
        className="mt-12 rounded-2xl border border-border bg-card p-6 scroll-mt-20"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <Database className="size-4 text-primary" />
              <h2 className="text-lg font-bold text-foreground">
                Corpus & Knowledge Ingestion
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Single-corpus grounding store. Reference manuscripts, research notes, and style guidelines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSampleDoc}
              className="text-xs"
            >
              <Plus className="size-3.5" />
              Add Sample Doc
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleReindex}
              disabled={corpusStatus === "indexing"}
              className="text-xs"
            >
              {corpusStatus === "indexing" ? (
                <span className="inline-flex animate-spin">
                  <RefreshCw className="size-3.5" />
                </span>
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Re-index All
            </Button>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div
          role="region"
          aria-label="Manuscript file dropzone"
          tabIndex={0}
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
            handleAddSampleDoc()
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-6 rounded-xl border-2 border-dashed p-8 text-center transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
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
            aria-label="Upload reference files"
            accept=".pdf,.docx,.txt,.md,.epub"
            onChange={() => handleAddSampleDoc()}
          />
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UploadCloud className="size-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">
            Drop manuscript files or click to browse
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Supports PDF, DOCX, TXT, EPUB and Markdown (up to 50MB per file)
          </p>
        </div>

        {/* Indexed Documents Table */}
        <div className="mt-6">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Indexed Documents ({documents.length})
            </h3>
            <span className="text-[11px] text-muted-foreground">
              Vector embedding: OKLCH Cosine 1536-dim
            </span>
          </div>

          <div className="divide-y divide-border border-y border-border">
            {documents.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No documents currently indexed. Add files above to build your grounding corpus.
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between py-3 px-1 text-xs hover:bg-muted/20 transition rounded-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                      {doc.name.endsWith(".md") || doc.name.endsWith(".txt") ? (
                        <FileCode2 className="size-4 text-primary" />
                      ) : (
                        <FileText className="size-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.size} • {doc.chunks} chunks • {doc.updatedAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {doc.isStale ? (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Needs Re-index
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        Indexed
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteDoc(doc.id)}
                      className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                      title="Remove document from corpus"
                      aria-label={`Remove ${doc.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
