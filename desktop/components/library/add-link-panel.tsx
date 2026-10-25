"use client"

import { useForm } from "react-hook-form"
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

interface AddLinkFormValues {
  url: string
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddLinkFormValues>({
    defaultValues: { url: "" },
  })

  const onSubmit = handleSubmit(async (data) => {
    const trimmed = data.url.trim()
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
    reset()
    onOpenChange(false)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset()
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add link</DialogTitle>
          <DialogDescription>
            Fetch and extract a page into the local library.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <FieldGroup>
            <Field data-invalid={errors.url ? true : undefined}>
              <FieldLabel htmlFor="link-url">URL</FieldLabel>
              <Input
                id="link-url"
                type="url"
                {...register("url", {
                  required: "URL is required.",
                  validate: (val) => isValidUrl(val.trim()) || "Enter a valid http(s) URL.",
                })}
                aria-invalid={errors.url ? true : undefined}
                placeholder="https://"
                disabled={busy}
                autoComplete="off"
              />
              {errors.url?.message ? <FieldError>{errors.url.message}</FieldError> : null}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-md" disabled={busy}>
              Fetch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
