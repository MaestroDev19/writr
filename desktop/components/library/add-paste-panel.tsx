"use client"

import { useState, type FormEvent } from "react"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function AddPastePanel({
  open,
  onOpenChange,
  busy,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onAdd: (payload: {
    title: string
    body: string
  }) => Promise<"ok" | "duplicate" | "error">
}) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [emptyError, setEmptyError] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) {
      setEmptyError(true)
      return
    }
    setEmptyError(false)
    const result = await onAdd({
      title: title.trim() || "Pasted note",
      body: body.trim(),
    })
    if (result === "duplicate") {
      toast.message("Already in library.")
      return
    }
    if (result === "error") {
      toast.error("Could not add paste.")
      return
    }
    setTitle("")
    setBody("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>Paste note</DialogTitle>
          <DialogDescription>
            Title is optional. Empty body is blocked.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="paste-title">Title</FieldLabel>
              <Input
                id="paste-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Optional"
                disabled={busy}
              />
            </Field>
            <Field data-invalid={emptyError || undefined}>
              <FieldLabel htmlFor="paste-body">Body</FieldLabel>
              <Textarea
                id="paste-body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  if (emptyError) setEmptyError(false)
                }}
                aria-invalid={emptyError || undefined}
                rows={8}
                disabled={busy}
                placeholder="Paste text here…"
              />
              <FieldDescription>Stored locally on this machine.</FieldDescription>
              {emptyError ? <FieldError>Body is required.</FieldError> : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
