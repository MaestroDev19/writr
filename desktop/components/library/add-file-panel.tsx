"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const ALLOWED = [".docx", ".txt", ".md"] as const

function isAllowedPath(path: string) {
  const lower = path.toLowerCase()
  return ALLOWED.some((ext) => lower.endsWith(ext))
}

function basename(path: string) {
  const parts = path.replace(/\\/g, "/").split("/")
  return parts[parts.length - 1] || path
}

export function AddFilePanel({
  open,
  onOpenChange,
  busy,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onAdd: (payload: { path: string; title: string }) => Promise<"ok" | "duplicate" | "error">
}) {
  const [rejectMessage, setRejectMessage] = useState<string | null>(null)

  async function pickFile() {
    setRejectMessage(null)
    try {
      const { open } = await import("@tauri-apps/plugin-dialog")
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Notes", extensions: ["docx", "txt", "md"] },
          { name: "All", extensions: ["*"] },
        ],
      })
      if (!selected || Array.isArray(selected)) return

      const path = selected
      if (path.toLowerCase().endsWith(".pdf")) {
        setRejectMessage("PDF is not supported. Use .docx, .txt, or .md.")
        return
      }
      if (!isAllowedPath(path)) {
        setRejectMessage("Unsupported type. Allowed: .docx, .txt, .md.")
        return
      }

      const title = basename(path)
      const result = await onAdd({ path, title })
      if (result === "duplicate") {
        toast.message("Already in library.")
        return
      }
      if (result === "error") {
        toast.error("Could not add file.")
        return
      }
      onOpenChange(false)
    } catch {
      // Browser / no Tauri: fall back to file input
      const input = document.createElement("input")
      input.type = "file"
      input.accept = ".docx,.txt,.md,text/plain,text/markdown"
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        if (file.name.toLowerCase().endsWith(".pdf")) {
          setRejectMessage("PDF is not supported. Use .docx, .txt, or .md.")
          return
        }
        if (!isAllowedPath(file.name)) {
          setRejectMessage("Unsupported type. Allowed: .docx, .txt, .md.")
          return
        }
        const result = await onAdd({ path: file.name, title: file.name })
        if (result === "duplicate") toast.message("Already in library.")
        else if (result === "error") toast.error("Could not add file.")
        else onOpenChange(false)
      }
      input.click()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add file</DialogTitle>
          <DialogDescription>
            Pick a local .docx, .txt, or .md. PDF is rejected.
          </DialogDescription>
        </DialogHeader>
        {rejectMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {rejectMessage}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void pickFile()}>
            Choose file
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
