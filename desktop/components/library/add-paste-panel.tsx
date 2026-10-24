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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface AddPasteFormValues {
  title: string
  body: string
}

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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPasteFormValues>({
    defaultValues: {
      title: "",
      body: "",
    },
  })

  const onSubmit = handleSubmit(async (data) => {
    const trimmedBody = data.body.trim()
    if (!trimmedBody) return

    const result = await onAdd({
      title: data.title.trim() || "Pasted note",
      body: trimmedBody,
    })
    if (result === "duplicate") {
      toast.message("Already in library.")
      return
    }
    if (result === "error") {
      toast.error("Could not add paste.")
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
      <DialogContent className="sm:max-w-[32rem]">
        <DialogHeader>
          <DialogTitle>Paste note</DialogTitle>
          <DialogDescription>
            Title is optional. Empty body is blocked.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="paste-title">Title</FieldLabel>
              <Input
                id="paste-title"
                {...register("title")}
                placeholder="Optional"
                disabled={busy}
              />
            </Field>
            <Field data-invalid={errors.body ? true : undefined}>
              <FieldLabel htmlFor="paste-body">Body</FieldLabel>
              <Textarea
                id="paste-body"
                {...register("body", {
                  required: "Body is required.",
                  validate: (val) => val.trim().length > 0 || "Body is required.",
                })}
                aria-invalid={errors.body ? true : undefined}
                rows={8}
                disabled={busy}
                placeholder="Paste text here…"
              />
              <FieldDescription>Stored locally on this machine.</FieldDescription>
              {errors.body?.message ? <FieldError>{errors.body.message}</FieldError> : null}
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
