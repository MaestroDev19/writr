import * as React from "react"
import type { ReferenceDocumentItem, UploadedFileItem } from "@/types/document-roles"
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface EmbeddingMonitorProps {
  files: ReferenceDocumentItem[] | UploadedFileItem[]
  /** Live upload-job label. In-flight notes use this instead of local progress. */
  jobBanner?: { tone: "ready" | "updating" | "needs-update" | "error"; label: string } | null
}

export function EmbeddingMonitor({ files, jobBanner = null }: EmbeddingMonitorProps) {
  const [isExpanded, setIsExpanded] = React.useState(true)

  const preparingFiles = files.filter(
    (f) => f.embeddingStatus === "embedding" || f.embeddingStatus === "queued"
  )
  const readyFiles = files.filter((f) => f.embeddingStatus === "ready")
  const isPreparing = jobBanner ? jobBanner.tone === "updating" : preparingFiles.length > 0
  const jobFailed = jobBanner?.tone === "error"
  const headline = jobBanner?.label ?? (isPreparing ? "Preparing notes" : "Notes ready")

  if (files.length === 0) return null

  const totalProgress =
    files.reduce(
      (acc, f) =>
        acc + (f.embeddingStatus === "ready" ? 100 : (f.embeddingProgress ?? 0)),
      0
    ) / files.length

  return (
    <div
      aria-label="Notes status"
      className={`rounded-[var(--radius-xl)] border p-4 transition-colors ${
        jobFailed
          ? "border-destructive/40 bg-destructive/5"
          : isPreparing
            ? "border-primary/40 bg-primary/5"
            : "border-border bg-card/60"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] ${
              jobFailed
                ? "bg-destructive/15 text-destructive"
                : isPreparing
                  ? "bg-primary/15 text-primary"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {jobFailed ? (
              <AlertTriangle className="size-4" aria-hidden="true" />
            ) : isPreparing ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-foreground">
                {headline}
              </span>
              {jobFailed ? (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  error
                </Badge>
              ) : isPreparing ? (
                <Badge variant="secondary">
                  Reading {preparingFiles.length}…
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <CheckCircle2 data-icon="inline-start" />
                  {jobBanner?.tone === "ready" ? "ready" : "Ready"}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {jobFailed
                ? "This note could not be prepared."
                : isPreparing
                  ? "Getting your notes ready for writing…"
                  : `${jobBanner?.tone === "ready" ? files.filter((f) => f.embeddingStatus !== "error").length : readyFiles.length} of ${files.length} ready to use`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden text-end sm:block">
            <span className="block text-xs font-semibold text-foreground tabular-nums">
              {jobBanner?.tone === "ready" ? 100 : jobFailed ? 0 : Math.round(totalProgress)}%
            </span>
            <span className="text-[10px] text-muted-foreground">
              {readyFiles.length}/{files.length}
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? "Hide note details" : "Show note details"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </div>

      {isPreparing ? (
        <div
          className="mt-3 w-full"
          role="progressbar"
          aria-valuenow={Math.round(totalProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full bg-primary transition-[width] duration-300"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      {isExpanded ? (
        <ul className="mt-3 flex flex-col gap-0 border-t border-border/60 pt-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-2 py-2 text-xs"
            >
              <span className="min-w-0 truncate font-medium text-foreground">
                {file.name}
              </span>

              <div className="flex shrink-0 items-center gap-2">
                {jobBanner &&
                (file.embeddingStatus === "queued" || file.embeddingStatus === "embedding") ? (
                  jobBanner.tone === "error" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-destructive">
                      error
                    </span>
                  ) : jobBanner.tone === "ready" ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
                      ready
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3" aria-hidden="true" />
                      {jobBanner.label}
                    </span>
                  )
                ) : file.embeddingStatus === "embedding" ? (
                  <span className="flex items-center gap-1.5 tabular-nums text-primary">
                    <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:w-20">
                      <span
                        className="block h-full bg-primary transition-[width] duration-200"
                        style={{ width: `${file.embeddingProgress}%` }}
                      />
                    </span>
                    {file.embeddingProgress}%
                  </span>
                ) : null}

                {file.embeddingStatus === "queued" && !jobBanner ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    Waiting
                  </span>
                ) : null}

                {file.embeddingStatus === "ready" ? (
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
                    Ready
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
