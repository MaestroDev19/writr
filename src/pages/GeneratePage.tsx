import * as React from "react"
import { Link } from "react-router-dom"
import {
  Sparkles,
  ArrowRight,
  Settings,
  Copy,
  Check,
  Wand2,
  RefreshCw,
  RotateCcw,
  BookOpen,
  FileCheck,
  FileCode2,
  FileText,
  UploadCloud,
  Trash2,
  ArrowUpRight,
  AlertCircle,
} from "lucide-react"

import { useSettings, DEFAULT_GENERATE_CONFIG } from "@/contexts/settings-context"
import { useCorpus } from "@/contexts/corpus-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import type {
  TargetDocumentItem,
  GenerateRevisionsResponse,
} from "@/types/document-roles"
import {
  UploadConfirmDialog,
  type PendingUpload,
} from "@/components/upload-confirm-dialog"
import {
  generateRevisionsApi,
  formatFileSize,
} from "@/lib/api-client"

function getCreativityLabel(temp: number) {
  if (temp <= 0.3) {
    return {
      label: "Careful",
      description: "Stays close to your instructions.",
    }
  }
  if (temp <= 0.6) {
    return {
      label: "Balanced",
      description: "Natural tone with steady voice.",
    }
  }
  if (temp <= 0.85) {
    return {
      label: "Expressive",
      description: "Richer detail and varied rhythm.",
    }
  }
  return {
    label: "Bold",
    description: "More creative freedom with ideas.",
  }
}

const PROMPT_SUGGESTIONS = [
  "Deepen character feelings",
  "Add sensory detail",
  "Sharpen dialogue",
  "Tighten pacing",
  "Match my notes and lore",
]

export default function GeneratePage() {
  const { settings, activeModelDisplayName } = useSettings()
  const { referenceDocuments, totalFiles: totalRefFiles } = useCorpus()

  const config = settings.generateConfig || DEFAULT_GENERATE_CONFIG
  const creativity = getCreativityLabel(config.temperature)

  // Target draft stays local in Generate. Not added to the notes library.
  const [targetDraft, setTargetDraft] = React.useState<TargetDocumentItem | null>(null)
  const targetFileInputRef = React.useRef<HTMLInputElement>(null)
  const [isTargetDragging, setIsTargetDragging] = React.useState(false)

  const [pendingUpload, setPendingUpload] = React.useState<PendingUpload | null>(null)
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false)

  const [inputPrompt, setInputPrompt] = React.useState(PROMPT_SUGGESTIONS[0])
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [outputResult, setOutputResult] = React.useState<GenerateRevisionsResponse | null>(null)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  const canGenerate = Boolean(targetDraft) && Boolean(inputPrompt.trim()) && !isGenerating

  const handleTargetFilesSelected = (files: File[]) => {
    if (files.length === 0) return
    setPendingUpload({
      files: [files[0]],
      designatedRole: "target",
      mode: "generate-target",
      currentActiveTargetName: targetDraft?.name,
    })
    setIsConfirmOpen(true)
  }

  const handleConfirmTargetUpload = async (confirmedFiles: File[]) => {
    const file = confirmedFiles[0]
    if (!file) return

    let wordCount: number
    let characterCount: number

    try {
      const text = await file.text()
      wordCount = text.trim().split(/\s+/).filter(Boolean).length
      characterCount = text.length
    } catch {
      wordCount = Math.round(file.size / 6)
      characterCount = file.size
    }

    setTargetDraft({
      id: `target-${Date.now()}`,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      role: "target",
      wordCount,
      characterCount,
      uploadedAt: new Date(),
      status: "ready",
    })
  }

  const handleRemoveTarget = () => {
    setTargetDraft(null)
  }

  const handleGenerate = async () => {
    if (!targetDraft || !inputPrompt.trim() || isGenerating) return

    setIsGenerating(true)

    try {
      const response = await generateRevisionsApi(
        {
          target_file_id: targetDraft.id,
          prompt: inputPrompt.trim(),
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        },
        targetDraft.name,
        referenceDocuments.map((rf) => rf.name)
      )

      setOutputResult(response)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!outputResult) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(outputResult.revised_text)
      } else {
        const textarea = document.createElement("textarea")
        textarea.value = outputResult.revised_text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        document.body.removeChild(textarea)
      }
      setCopied(true)
    } catch {
      setCopied(true)
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Improve your story
        </h1>
        <p className="max-w-2xl text-pretty text-sm text-muted-foreground leading-relaxed">
          Open a chapter, say what to change, and Writr rewrites it using your notes from the Dashboard.
        </p>
      </header>

      <section
        aria-label="Your story and notes"
        className="grid gap-4 md:gap-5 lg:grid-cols-2"
      >
        {/* Your story (local draft only) */}
        <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                <FileText className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">Your story</h2>
                  <Badge variant="secondary">This session only</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The chapter or scene you want to rewrite.
                </p>
              </div>
            </div>

            {targetDraft ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => targetFileInputRef.current?.click()}
                className="self-start"
              >
                <RefreshCw data-icon="inline-start" />
                Change file
              </Button>
            ) : null}
          </div>

          <input
            type="file"
            ref={targetFileInputRef}
            className="hidden"
            accept=".md,.txt,.docx,.pdf,.epub"
            aria-label="Choose story file"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleTargetFilesSelected(Array.from(e.target.files))
                e.target.value = ""
              }
            }}
          />

          {targetDraft ? (
            <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-primary/25 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] border border-primary/20 bg-background text-primary">
                    {targetDraft.name.endsWith(".md") || targetDraft.name.endsWith(".txt") ? (
                      <FileCode2 className="size-5" aria-hidden="true" />
                    ) : (
                      <FileText className="size-5" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {targetDraft.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {targetDraft.size}
                      {" · "}
                      {(targetDraft.wordCount ?? 0).toLocaleString()} words
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleRemoveTarget}
                  aria-label="Remove story file"
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="flex items-center gap-1.5 border-t border-primary/15 pt-3 text-xs text-emerald-700 dark:text-emerald-400">
                <FileCheck className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Ready to rewrite</span>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Add your story file"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  targetFileInputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setIsTargetDragging(true)
              }}
              onDragLeave={() => setIsTargetDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsTargetDragging(false)
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleTargetFilesSelected(Array.from(e.dataTransfer.files))
                }
              }}
              onClick={() => targetFileInputRef.current?.click()}
              className={`flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-[var(--radius)] border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                isTargetDragging
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              }`}
            >
              <div className="flex size-12 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                <UploadCloud className="size-6" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-foreground">
                  Add your story file
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Markdown, Word, text, or PDF. On phones, use Choose file.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  targetFileInputRef.current?.click()
                }}
              >
                <UploadCloud data-icon="inline-start" />
                Choose file
              </Button>
            </div>
          )}
        </div>

        {/* Notes from Dashboard (read-only + link) */}
        <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-muted text-foreground">
                <BookOpen className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-bold text-foreground">Your notes</h2>
                  <Badge variant="outline">
                    {totalRefFiles} {totalRefFiles === 1 ? "file" : "files"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Character sheets, lore, and research from Dashboard.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              render={<Link to="/dashboard#notes" />}
              className="self-start"
            >
              Add notes
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Writr uses these notes to keep names, tone, and world details consistent.
          </p>

          <div className="max-h-[160px] overflow-y-auto overscroll-contain rounded-[var(--radius)] border border-border bg-muted/20">
            {referenceDocuments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
                <p className="text-xs text-muted-foreground">
                  No notes yet. Add them on the Dashboard first.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  render={<Link to="/dashboard#notes" />}
                >
                  Go to notes library
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {referenceDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs"
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">
                      {doc.name}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      Ready
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">Need more lore or guides?</span>
            <Link
              to="/dashboard#notes"
              className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              Open notes library
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
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
        onConfirm={(files) => handleConfirmTargetUpload(files)}
      />

      <Card className="rounded-[var(--radius-xl)] border-border bg-card shadow-xs">
        <CardHeader className="gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold normal-case tracking-normal text-pretty">
                  What should change?
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Pick a suggestion or type your own instructions.
                </CardDescription>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              render={<Link to="/settings" />}
              className="self-start text-muted-foreground"
            >
              <Settings data-icon="inline-start" />
              Settings
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-5">
          <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-muted/40 px-3.5 py-2.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">Style:</span>{" "}
              <span className="text-primary">{creativity.label}</span>
              {" · "}
              {creativity.description}
            </p>
            <span className="text-muted-foreground">{activeModelDisplayName}</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-foreground">Quick picks</span>
            <div className="flex flex-wrap gap-2">
              {PROMPT_SUGGESTIONS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setInputPrompt(chip)}
                  className={`min-h-10 rounded-[var(--radius)] border px-3 py-2 text-left text-xs transition-colors ${
                    inputPrompt === chip
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="revision-prompt" className="text-xs font-semibold text-foreground">
                Your instructions
              </label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {inputPrompt.length}
              </span>
            </div>

            <textarea
              id="revision-prompt"
              name="revision-prompt"
              rows={3}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="e.g. Build tension between Elena and Marcus…"
              autoComplete="off"
              className="w-full resize-y rounded-[var(--radius)] border border-border bg-background p-3 text-sm leading-relaxed outline-hidden transition-[border-color,box-shadow] focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              onClick={() => setInputPrompt("")}
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
            >
              <RotateCcw data-icon="inline-start" />
              Clear
            </Button>

            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
              {!targetDraft ? (
                <span className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 sm:justify-start">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  Add a story file first
                </span>
              ) : null}

              <Button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="w-full sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw data-icon="inline-start" className="animate-spin" />
                    Rewriting…
                  </>
                ) : (
                  <>
                    <Wand2 data-icon="inline-start" />
                    Rewrite story
                  </>
                )}
              </Button>
            </div>
          </div>

          {isGenerating ? (
            <div
              role="status"
              aria-live="polite"
              aria-label="Rewriting your story"
              className="flex flex-col gap-3 rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-4 sm:p-5"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <RefreshCw className="size-4 animate-spin text-primary" aria-hidden="true" />
                <span>Reading your story and notes…</span>
              </div>
              <div className="flex flex-col gap-2" aria-hidden="true">
                <div className="h-3 w-3/4 animate-pulse rounded-[var(--radius-sm)] bg-primary/15" />
                <div className="h-3 w-full animate-pulse rounded-[var(--radius-sm)] bg-primary/10" />
                <div className="h-3 w-5/6 animate-pulse rounded-[var(--radius-sm)] bg-primary/10" />
              </div>
            </div>
          ) : null}

          {outputResult && !isGenerating ? (
            <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] border border-primary/30 bg-primary/5 p-4 sm:p-5">
              <div className="flex flex-col gap-3 border-b border-primary/15 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
                    <FileCheck className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-foreground">
                      Revised: {outputResult.target_filename}
                    </h3>
                    <p className="truncate text-[11px] text-muted-foreground">
                      Used notes: {outputResult.referenced_documents.join(", ")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="tabular-nums">
                    {outputResult.word_count} words
                    {targetDraft?.wordCount !== undefined ? (
                      <span className="text-muted-foreground">
                        ({outputResult.word_count - targetDraft.wordCount >= 0 ? "+" : ""}
                        {outputResult.word_count - targetDraft.wordCount})
                      </span>
                    ) : null}
                  </Badge>

                  <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check data-icon="inline-start" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy data-icon="inline-start" />
                        Copy
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setOutputResult(null)}
                  >
                    Clear
                  </Button>
                </div>
              </div>

              <div className="max-h-[460px] overflow-y-auto overscroll-contain whitespace-pre-line rounded-[var(--radius)] border border-border/80 bg-background/90 p-4 text-sm leading-relaxed text-foreground sm:p-5">
                {outputResult.revised_text}
              </div>

              <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="size-3.5 shrink-0" aria-hidden="true" />
                Ready to paste into your manuscript
              </p>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-col items-start justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <span>Want a different writing style?</span>
          <Button
            variant="link"
            size="sm"
            render={<Link to="/settings" />}
            className="h-auto p-0"
          >
            Open Settings
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
