import * as React from "react"
import type { UploadedFileItem, DocumentRole } from "@/types/document-roles"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Target,
  BookOpen,
  UploadCloud,
  FileText,
  FileCode2,
  Trash2,
  MoreVertical,
  ArrowLeftRight,
  RefreshCw,
  Plus,
  CheckCircle2,
  FileUp,
} from "lucide-react"

interface DocumentBucketsProps {
  files: UploadedFileItem[]
  onFilesSelected: (files: File[], designatedRole: DocumentRole) => void
  onToggleRole: (fileId: string) => void
  onDeleteFile: (fileId: string) => void
}

export function DocumentBuckets({
  files,
  onFilesSelected,
  onToggleRole,
  onDeleteFile,
}: DocumentBucketsProps) {
  const targetFile = files.find((f) => f.role === "target")
  const referenceFiles = files.filter((f) => f.role === "reference")

  const targetInputRef = React.useRef<HTMLInputElement>(null)
  const referenceInputRef = React.useRef<HTMLInputElement>(null)

  const [isTargetDragging, setIsTargetDragging] = React.useState(false)
  const [isRefDragging, setIsRefDragging] = React.useState(false)

  const handleTargetDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsTargetDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Single active target: take the first file
      onFilesSelected([e.dataTransfer.files[0]], "target")
    }
  }

  const handleRefDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsRefDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files), "reference")
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ========================================================================= */}
      {/* BUCKET 1: TARGET DOCUMENT (YOUR DRAFT) */}
      {/* ========================================================================= */}
      <div
        className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs"
        aria-label="Target Document Bucket"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Target Document
                </h3>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0.5 px-2 font-semibold"
                >
                  My Work / Draft
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                The primary manuscript the AI will edit, rewrite, or expand (1 active).
              </p>
            </div>
          </div>

          {targetFile ? (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => targetInputRef.current?.click()}
              className="text-xs gap-1 cursor-pointer"
            >
              <RefreshCw className="size-3" />
              Replace
            </Button>
          ) : null}
        </div>

        {/* Hidden file input for Target */}
        <input
          type="file"
          ref={targetInputRef}
          className="hidden"
          accept=".md,.txt,.docx,.pdf,.epub"
          aria-label="Upload target manuscript file"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected([e.target.files[0]], "target")
              e.target.value = ""
            }
          }}
        />

        {/* Active Target Document Display OR Empty Dropzone */}
        <div className="mt-4 flex-1 flex flex-col justify-center">
          {targetFile ? (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background border border-primary/20 text-primary shadow-xs">
                    {targetFile.name.endsWith(".md") || targetFile.name.endsWith(".txt") ? (
                      <FileCode2 className="size-5" />
                    ) : (
                      <FileText className="size-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground text-xs sm:text-sm truncate max-w-[220px] sm:max-w-[280px]">
                        {targetFile.name}
                      </p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                        [Active Target]
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{targetFile.size}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" />
                        Ready in Write (not in notes library)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Switch role or Remove */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Document options"
                      />
                    }
                  >
                    <MoreVertical className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Role Management</DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => onToggleRole(targetFile.id)}
                      className="cursor-pointer gap-2"
                    >
                      <ArrowLeftRight className="size-3.5" />
                      <span>Switch to Reference</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => targetInputRef.current?.click()}
                      className="cursor-pointer gap-2"
                    >
                      <RefreshCw className="size-3.5" />
                      <span>Replace Document</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onDeleteFile(targetFile.id)}
                      className="cursor-pointer gap-2"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Remove Target</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Bottom bar with quick toggle & replace buttons */}
              <div className="mt-3 pt-3 border-t border-primary/15 flex items-center justify-between text-xs">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onToggleRole(targetFile.id)}
                  className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeftRight className="size-3" />
                  Convert to Reference Material
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onDeleteFile(targetFile.id)}
                  className="h-7 text-[11px] text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div
              role="region"
              aria-label="Upload target draft dropzone"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  targetInputRef.current?.click()
                }
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setIsTargetDragging(true)
              }}
              onDragLeave={() => setIsTargetDragging(false)}
              onDrop={handleTargetDrop}
              onClick={() => targetInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[160px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                isTargetDragging
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/60 hover:bg-muted/30"
              }`}
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
                <FileUp className="size-5.5" />
              </div>
              <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                Drop your Target Manuscript here
              </h4>
              <p className="mt-1 text-[11px] text-muted-foreground max-w-xs">
                Supports Markdown, TXT, DOCX, or PDF. This is the draft the AI will rewrite or expand.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground shadow-2xs">
                <Plus className="size-3 text-primary" />
                Select Target File
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BUCKET 2: REFERENCE LIBRARY (SOURCES & GUIDES) */}
      {/* ========================================================================= */}
      <div
        className="flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs"
        aria-label="Reference Library Bucket"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground">
              <BookOpen className="size-4.5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Reference Library
                </h3>
                <Badge
                  variant="outline"
                  className="bg-muted text-foreground border-border text-[10px] py-0.5 px-2 font-semibold"
                >
                  Sources & Guides ({referenceFiles.length})
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Background articles, lore, guides, or notes used for RAG grounding.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => referenceInputRef.current?.click()}
            className="text-xs gap-1 cursor-pointer"
          >
            <Plus className="size-3 text-primary" />
            Add Sources
          </Button>
        </div>

        {/* Hidden file input for References */}
        <input
          type="file"
          ref={referenceInputRef}
          className="hidden"
          multiple
          accept=".md,.txt,.docx,.pdf,.epub"
          aria-label="Upload reference source files"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFilesSelected(Array.from(e.target.files), "reference")
              e.target.value = ""
            }
          }}
        />

        {/* Dropzone Strip */}
        <div
          role="region"
          aria-label="Upload reference files dropzone"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              referenceInputRef.current?.click()
            }
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setIsRefDragging(true)
          }}
          onDragLeave={() => setIsRefDragging(false)}
          onDrop={handleRefDrop}
          onClick={() => referenceInputRef.current?.click()}
          className={`mt-4 rounded-xl border border-dashed py-3 px-4 text-center transition cursor-pointer flex items-center justify-center gap-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
            isRefDragging
              ? "border-primary bg-primary/10"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <UploadCloud className="size-4 text-primary" />
          <span className="text-xs text-foreground font-medium">
            Drag & drop multiple reference files here, or <span className="underline text-primary">browse</span>
          </span>
        </div>

        {/* Reference Files List */}
        <div className="mt-3 flex-1 overflow-y-auto max-h-[220px] divide-y divide-border/60">
          {referenceFiles.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No reference materials added yet. Upload articles, world lore, or character bibles to ground the assistant.
            </div>
          ) : (
            referenceFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between py-2.5 px-1 text-xs hover:bg-muted/20 transition rounded-md"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    {file.name.endsWith(".md") || file.name.endsWith(".txt") ? (
                      <FileCode2 className="size-3.5 text-primary" />
                    ) : (
                      <FileText className="size-3.5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-foreground truncate max-w-[170px] sm:max-w-[220px]">
                        {file.name}
                      </p>
                      <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-mono text-muted-foreground uppercase">
                        [Reference]
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span>{file.size}</span>
                      <span>•</span>
                      {file.embeddingStatus === "ready" ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {file.chunks} passages
                        </span>
                      ) : (
                        <span className="text-primary animate-pulse">
                          {file.embeddingProgress}% embedded
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {/* Role Switcher */}
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Switch role or actions"
                        />
                      }
                    >
                      <MoreVertical className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Role Actions</DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onToggleRole(file.id)}
                        className="cursor-pointer gap-2"
                      >
                        <Target className="size-3.5 text-primary" />
                        <span>Make Active Target</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDeleteFile(file.id)}
                        className="cursor-pointer gap-2"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Delete Reference</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Delete Icon Button */}
                  <button
                    type="button"
                    onClick={() => onDeleteFile(file.id)}
                    className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                    title={`Delete ${file.name}`}
                    aria-label={`Delete ${file.name}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
