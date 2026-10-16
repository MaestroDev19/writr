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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function isValidUrl(value: string) {
  try {
    const u = new URL(value)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export function AddLinkPanel({
  open,
  onOpenChange,
  busy,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onAdd: (payload: { url: string }) => Promise<"ok" | "duplicate" | "error" | "thin">
}) {
  const [url, setUrl] = useState("")
  const [invalid, setInvalid] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = url.trim()
    if (!trimmed || !isValidUrl(trimmed)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    const result = await onAdd({ url: trimmed })
    if (result === "duplicate") {
      toast.message("Already in library.")
      return
    }
    if (result === "thin") {
      toast.error("Page extract was too thin to index.")
      return
    }
    if (result === "error") {
      toast.error("Could not fetch link.")
      return
    }
    setUrl("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add link</DialogTitle>
          <DialogDescription>
            Fetch and extract a page into the local library.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
          <FieldGroup>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="link-url">URL</FieldLabel>
              <Input
                id="link-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  if (invalid) setInvalid(false)
                }}
                aria-invalid={invalid || undefined}
                placeholder="https://"
                disabled={busy}
                autoComplete="off"
              />
              {invalid ? <FieldError>Enter a valid http(s) URL.</FieldError> : null}
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
              Fetch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
