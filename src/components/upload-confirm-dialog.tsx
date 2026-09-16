import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { DocumentRole } from "@/types/document-roles"
import { formatFileSize } from "@/lib/api-client"
import {
  FileText,
  FileCode2,
  Target,
  BookOpen,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react"

export interface PendingUpload {
  files: File[]
  designatedRole: DocumentRole
  currentActiveTargetName?: string
  mode?: "dashboard-reference" | "generate-target" | "flexible"
}

interface UploadConfirmDialogProps {
  pendingUpload: PendingUpload | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (files: File[], role: DocumentRole) => void
}

export function UploadConfirmDialog({
  pendingUpload,
  isOpen,
  onClose,
  onConfirm,
}: UploadConfirmDialogProps) {
  const [roleOverride, setRoleOverride] = React.useState<DocumentRole | null>(null)

  if (!pendingUpload) return null

  const mode = pendingUpload.mode || "flexible"
  const selectedRole = roleOverride ?? pendingUpload.designatedRole
  const fileCount = pendingUpload.files.length
  const totalBytes = pendingUpload.files.reduce((acc, f) => acc + f.size, 0)
  const isReplacingTarget =
    selectedRole === "target" &&
    Boolean(pendingUpload.currentActiveTargetName) &&
    pendingUpload.currentActiveTargetName !== pendingUpload.files[0]?.name

  const handleClose = () => {
    setRoleOverride(null)
    onClose()
  }

  const handleConfirm = () => {
    onConfirm(pendingUpload.files, selectedRole)
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-[var(--radius-xl)] border-border bg-card p-4 shadow-xl sm:max-w-lg sm:p-6">
        <DialogHeader className="gap-1.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
              {mode === "generate-target" || selectedRole === "target" ? (
                <Target className="size-4" aria-hidden="true" />
              ) : (
                <BookOpen className="size-4" aria-hidden="true" />
              )}
            </div>
            <DialogTitle className="font-sans text-base font-bold tracking-tight text-foreground normal-case">
              {mode === "dashboard-reference"
                ? "Add to notes library"
                : mode === "generate-target"
                  ? "Open this story?"
                  : "Confirm files"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {mode === "dashboard-reference"
              ? "Writr will read these notes and use them when you write or review."
              : mode === "generate-target"
                ? "This opens the file in Write for this session. It is not added to your notes library."
                : "Review your selected files."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <span>
              {fileCount === 1 ? "Selected file" : `Selected files (${fileCount})`}
            </span>
            <span className="tabular-nums">Total: {formatFileSize(totalBytes)}</span>
          </div>

          <div className="max-h-48 overflow-y-auto overscroll-contain rounded-[var(--radius)] border border-border bg-muted/30 p-2.5">
            <ul className="flex flex-col gap-1">
              {pendingUpload.files.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-background text-primary">
                      {file.name.endsWith(".md") || file.name.endsWith(".txt") ? (
                        <FileCode2 className="size-3.5" aria-hidden="true" />
                      ) : (
                        <FileText className="size-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <span className="truncate font-medium text-foreground">{file.name}</span>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatFileSize(file.size)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {mode === "flexible" ? (
            <div className="flex flex-col gap-2 pt-2">
              <span className="block text-xs font-semibold text-foreground">
                How should Writr use this?
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRoleOverride("target")}
                  className={`flex flex-col items-start rounded-[var(--radius)] border p-3 text-left transition-colors ${
                    selectedRole === "target"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Target
                      className={`size-4 ${
                        selectedRole === "target" ? "text-primary" : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-foreground">Story file</span>
                  </div>
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    The scene you want rewritten. Stays in Write only.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRoleOverride("reference")}
                  className={`flex flex-col items-start rounded-[var(--radius)] border p-3 text-left transition-colors ${
                    selectedRole === "reference"
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-background hover:bg-muted/40"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <BookOpen
                      className={`size-4 ${
                        selectedRole === "reference" ? "text-primary" : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-foreground">Note</span>
                  </div>
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    Background research and lore for the library.
                  </p>
                </button>
              </div>
            </div>
          ) : null}

          {mode === "dashboard-reference" ? (
            <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-primary/20 bg-primary/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
                <span>Saved to your notes</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Writr will prepare these files so it can match your world and tone when you write.
              </p>
            </div>
          ) : null}

          {mode === "generate-target" ? (
            <div className="flex flex-col gap-1 rounded-[var(--radius)] border border-border bg-muted/30 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Target className="size-3.5 text-primary" aria-hidden="true" />
                <span>Session story only</span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Your draft opens in Write for this session. It is not stored in the notes library.
              </p>
            </div>
          ) : null}

          {isReplacingTarget ? (
            <div className="flex items-start gap-2 rounded-[var(--radius)] border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                You already have <span className="font-semibold">{pendingUpload.currentActiveTargetName}</span> open. This will switch to the new file.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            className="w-full sm:w-auto"
          >
            {mode === "dashboard-reference"
              ? "Add to library"
              : mode === "generate-target"
                ? "Open in Write"
                : "Confirm"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
